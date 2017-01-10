from __future__ import unicode_literals

from django.db import models
from django.db.models import Q, Avg
from collections import Counter
import numpy as np

class GradeManager(models.Manager):

	#returns a full list of all courses in the database, no filtering
	def uniqueClassList(self):
		unique_class_list = sorted([g["course"] for g in Grade.objects.values('course').distinct()])
		return unique_class_list

	#returns mean, median, mode, std dev as a dictionary, given a dictionary of id, grade key-value pairs
	def returnGradeDistDict(self, grade_dict):
		out = {}
		gradevalues = grade_dict.values()
		#print(gradevalues)
		grades = Counter(gradevalues)
		out['grades'] = grades

		numeric_grades = []
		for gv in gradevalues:
			try:
				numeric_grades.append(int(gv))
			except ValueError:
				#print str(gv) + " is not a numeric grade. Skipping."
				#do nothing
				pass
		
		numeric_grade_counts = [0]*41;
		for grade in numeric_grades:
			numeric_grade_counts[grade] += 1
		
		out['numeric_grade_counts'] = numeric_grade_counts
		mean = np.mean(numeric_grades)
		out['grade_avg'] = mean if not np.isnan(mean) else None
		sd = np.std(numeric_grades)
		out['grade_stddev'] = sd if not np.isnan(sd) else None

		return out

	
	#basic query for all grades of a certain course number within a date range
	def gradeDistByClass(self, course, yearstart, yearend, fname, lname, qmin, qmax):
		q = self.filter(course__exact = course)
		if fname != '' and lname != '':
			class_ids = Eval.objects.filter(Q(course__exact = course), Q(lname__exact = lname), Q(fname__exact = fname)).values('class_id').distinct()
			q = q.filter(class_id__in = class_ids)
		q = q.filter(Q(tran_yr__lt = yearend) | (Q(tran_yr__exact = yearend) & Q(tran_qtr__lte = qmax)))
		q = q.filter(Q(tran_yr__gt = yearstart) | (Q(tran_yr__exact = yearstart) & Q(tran_qtr__gte = qmin)))
		
		#resp = {}
		#resp["grade_avg"] = q.filter(grade__regex=r'^[0-9]+$').aggregate(Avg('grade'))["grade__avg"]
		#resp["grade_avg"] = 0
		#resp["grades"] = Counter(q.values_list('grade', flat=True))
		
		#populate dictionary of id, grade key-value associations.
		results = q.values_list('system_key', 'tran_yr' , 'tran_qtr', 'grade')
		resultDict = {}
		for r in results:
			resultDict[str(r[0]) + ' ' + str(r[1]) + ' ' + str(r[2])] = r[3]

		#print resultDict.values()
		resp = self.returnGradeDistDict(resultDict)

		return resp
	
	#Same as above but filters for results who have also taken every class in the prereq list prior to taking the query class.
	#prereq is a list of courses
	#concurrent is 0, 1, or 2. 0 means prereq only (strictly before) 1 is concurrent only, 2 is union of both
	def gradeDistByClassAdv (self, course, yearstart, yearend, fname, lname, qmin, qmax, prereqs, concurrent):
		q = self.filter(course__exact = course)
		if fname != '' and lname != '':
			class_ids = Eval.objects.filter(Q(course__exact = course), Q(lname__exact = lname), Q(fname__exact = fname)).values('class_id').distinct()
			q = q.filter(class_id__in = class_ids)
		q = q.filter(Q(tran_yr__lt = yearend) | (Q(tran_yr__exact = yearend) & Q(tran_qtr__lte = qmax)))
		q = q.filter(Q(tran_yr__gt = yearstart) | (Q(tran_yr__exact = yearstart) & Q(tran_qtr__gte = qmin)))
		#make a query set for every class in prereqs
		prqs = []
		intersect = q

		for pr in prereqs:
			qpr = self.filter(course__exact = pr)
			qpr = qpr.filter(Q(tran_yr__lt = yearend) | (Q(tran_yr__exact = yearend) & Q(tran_qtr__lte = qmax)))
			#qpr = qpr.filter(Q(tran_yr__gt = yearstart) | (Q(tran_yr__exact = yearstart) & Q(tran_qtr__gte = qmin)))
			#make this a list, not a query so all future operations are done in memory
			
			eval_qpr = list(qpr)
			idlist = []
			for entry in eval_qpr:
				idlist.append(entry.system_key)

			intersect = intersect.filter(system_key__in = idlist)
			prqs.append(list(eval_qpr))

		#intersect each prereq query now to speed up next step
		intersectlist = list(intersect.values_list('system_key', 'tran_yr', 'tran_qtr', 'grade'))
		#print intersectlist
		intersectDict = {}
		idlist = []

		for il in intersectlist:
			idlist.append(il[0])
			#keyed by id + yr + qtr, value grade
			intersectDict[str(il[0]) + ' ' + str(il[1]) + ' ' + str(il[2])] = il[3]
			#print intersectDict[str(il[0]) + ' ' + str(il[1]) + ' ' + str(il[2])] 


		for pri in range (0, len(prqs)):
			#Do this in memory instead
			##prqs[pri] = prqs[pri].filter(system_key__in = idlist).values_list('system_key', 'tran_yr', 'tran_qtr', 'course')

			#make a dictionary out of the prereqs keyed by ID for quicker access
			prereqDict = {}
			#keyed by id, value is course, yr, qtr
			for prtuple in prqs[pri]:
				if prtuple.system_key in idlist:
					#handle case where someone took the same class twice. 
					retake = prereqDict.has_key(prtuple.system_key)
					if retake:
						prereqDict[prtuple.system_key].append((prtuple.course, prtuple.tran_yr, prtuple.tran_qtr))
					#	currentValue = prereqDict[prtuple.system_key]
					#	if currentValue[1] < prtuple.tran_yr or (currentValue[1] == prtuple.tran_yr and currentValue[2] < prtuple.tran_qtr):
					#		#overwrite if the current entry was taken before this one
					#		prereqDict[prtuple.system_key] = (prtuple.course, prtuple.tran_yr, prtuple.tran_qtr)	
					#first time taking course
					else:
						prereqDict[prtuple.system_key] = [(prtuple.course, prtuple.tran_yr, prtuple.tran_qtr)]
			prqs[pri] = dict(prereqDict)
	
		i = 0
		#now check for order of classes taken
		#do no queries in the loop
		exclusions = []
		for s in intersectlist:
			before_yr = s[1]
			before_qtr = s[2]
			student = s[0]
			#now for each class...QuerySets are lazy so this isn't too bad I think. maybe some way to make this more efficient?
			satisfied = True
			for pri in range(0, len(prereqs)):
				#Too slow, does not reuse previously cached queries
				#satisfied = prqs[pri].filter(Q(tran_yr__lt = before_yr) | (Q(tran_yr__exact = before_yr) & Q(tran_qtr__lt = before_qtr)), system_key__exact = student, course__exact = prereqs[pri] ).exists()	
				studentExists = prqs[pri].has_key(student)
				if studentExists:
					atleastone = False
					for sameStudent in prqs[pri][student]:
						#strictly taken before
						if concurrent == 0:
							takenBefore = sameStudent[1] < before_yr or (sameStudent[1] == before_yr and sameStudent[2] < before_qtr)
							#course check should be redundant
							atleastone = atleastone or (takenBefore and sameStudent[0] == prereqs[pri])
						#strictly taken concurrently
						elif concurrent == 1:
							takenDuring = sameStudent[1] == before_yr and sameStudent[2] == before_qtr
							atleastone = atleastone or (takenDuring and sameStudent[0] == prereqs[pri])
						#Taken before or during
						elif concurrent == 2:
							takenDuringorBefore = sameStudent[1] < before_yr or (sameStudent[1] == before_yr and sameStudent[2] <= before_qtr)
							atleastone = atleastone or (takenDuringorBefore and sameStudent[0] == prereqs[pri])
					satisfied = atleastone
				else:
					satisfied = False

				if not satisfied:
					#this student did not take all the specified pre reqs before they took the query class, so remove it from the query set
					exclusions.append(str(student) + ' ' + str(before_yr) + ' ' + str(before_qtr))
					break
			i += 1
		#return Counter(intersect.exclude(system_key__in = exclusions).values_list('grade', flat=True))
		#do this locally in memory to avoid database hit

		for e in exclusions:
			intersectDict.pop(e)
		#print intersectDict.values()
		return self.returnGradeDistDict(intersectDict)

	#A is matrix of dimensions p x n where p is the number of prereqs and n is the number of people who have taken all prereqs and query class
	#y is n vector of grades obtained by n people
	
	def predict_grade_ridge_regression(A, y):
		w =  ( np.linalg.inv(A.T.dot(A) + alpha * np.identity(A.shape[0])) ).dot(A.T.dot(y))
		return w

	#v is 1 x p array of prereq grades of query student
	#prereqs are sorted, doesnt matter how as long as its always the same. Default python order by.
	def ridgeResult(w, v):
		return v.dot(w)

	#prereqDicts and queryDicts filtered to only include id , grade kvpairs from students who have taken all the prereqs.
	def build_ml_matrix(prereqDicts, queryDicts):
		return None


	def mostTakenWith(self, course):
		q = self.filter(course__exact = course)
		studentDict = {}
		for s in q:
			studentDict[s.system_key] = (s.tran_yr, s.tran_qtr)

		ids = q.values_list('system_key', flat=True)

		conc_courses = self.filter(system_key__in = ids).exclude(course = course)
		
		#all courses that were in fact taken at the same time as the query course
		conc_courses_filtered = []

		for c in conc_courses:
			record = studentDict[c.system_key]
			if record[0] == c.tran_yr and record[1] == c.tran_qtr:
				conc_courses_filtered.append(c.course)
				
		return Counter(conc_courses_filtered).most_common(8)
		
class EvalManager(models.Manager):
	#returns the relevant grade data based on the passed filter parameters
	#The queries for each bit of info is almost exactly the same so everything is bundled 
	#into one method that returns a dictionary
	def evalData(self, course, yearstart, yearend, fname, lname, qmin, qmax):
		q = self.filter(course__exact = course)
		q = q.filter(Q(year__lt = yearend) | (Q(year__exact = yearend) & Q(qtr__lte = qmax)))
		q = q.filter(Q(year__gt = yearstart) | (Q(year__exact = yearstart) & Q(qtr__gte = qmin)))
		if fname != '' and lname != '':
			q = q.filter(Q(lname__exact = lname), Q(fname__exact = fname))
		
		dict = {}
		dict['class_size'] = q.aggregate(Avg('enroll'))["enroll__avg"]
		if q.order_by('year', 'qtr').last() != None:
			dict['hours_taken'] = q.order_by('year', 'qtr').last().median28
		else:
			dict['hours_taken'] = q.order_by('year', 'qtr').last()
		dict['instructors'] = [t[1] + ', ' + t[0] for t in q.order_by('lname').values_list('fname', 'lname').distinct()]
		dict['years'] = [y for y in q.order_by('year').values_list('year', flat=True).distinct()]
		dict['quarters'] = [y for y in q.order_by('qtr').values_list('qtr', flat=True).distinct()]
		
		dict['minyear'] = q.order_by('year', 'qtr').first()
		if (dict['minyear'] != None):
			dict['minyear'] = dict['minyear'].year
		
		dict['maxyear'] = q.order_by('year', 'qtr').last()
		if (dict['maxyear'] != None):
			dict['maxyear'] = dict['maxyear'].year
		
		dict['minqtr'] = q.order_by('year', 'qtr').first()
		if (dict['minqtr'] != None):
			dict['minqtr'] = dict['minqtr'].qtr
		
		dict['maxqtr'] = q.order_by('year', 'qtr').last()
		if (dict['maxqtr'] != None):
			dict['maxqtr'] = dict['maxqtr'].qtr
		
		return dict
				
class Grade(models.Model):
	system_key = models.IntegerField()
	tran_yr = models.IntegerField()
	tran_qtr = models.IntegerField()
	course = models.CharField(max_length=20,default='')
	section_id = models.CharField(max_length=10)
	grade = models.CharField(max_length=6)
	class_id = models.CharField(max_length=50,default='')
	objects = GradeManager()

class Eval(models.Model):
	year = models.IntegerField()
	qtr = models.IntegerField()
	course = models.CharField(max_length=20,default='')
	section = models.CharField(max_length=10)
	lname = models.CharField(max_length=50)
	fname = models.CharField(max_length=50)
	enroll = models.IntegerField(default=0)
	class_id = models.CharField(max_length=50,default='')
	survey = models.IntegerField(default=0.0)
	median1 = models.FloatField(default=0.0)
	median2 = models.FloatField(default=0.0)
	median3 = models.FloatField(default=0.0)
	median4 = models.FloatField(default=0.0)
	median5 = models.FloatField(default=0.0)
	median6 = models.FloatField(default=0.0)
	median7 = models.FloatField(default=0.0)
	median8 = models.FloatField(default=0.0)
	median9 = models.FloatField(default=0.0)
	median10 = models.FloatField(default=0.0)
	median11 = models.FloatField(default=0.0)
	median12 = models.FloatField(default=0.0)
	median13 = models.FloatField(default=0.0)
	median14 = models.FloatField(default=0.0)
	median15 = models.FloatField(default=0.0)
	median16 = models.FloatField(default=0.0)
	median17 = models.FloatField(default=0.0)
	median18 = models.FloatField(default=0.0)
	median19 = models.FloatField(default=0.0)
	median20 = models.FloatField(default=0.0)
	median21 = models.FloatField(default=0.0)
	median22 = models.FloatField(default=0.0)
	median23 = models.FloatField(default=0.0)
	median24 = models.FloatField(default=0.0)
	median25 = models.FloatField(default=0.0)
	median26 = models.FloatField(default=0.0)
	median27 = models.FloatField(default=0.0)
	median28 = models.FloatField(default=0.0)
	median29 = models.FloatField(default=0.0)
	median30 = models.FloatField(default=0.0)
	median31 = models.FloatField(default=0.0)
	median32 = models.FloatField(default=0.0)
	objects = EvalManager()
	
class Comment(models.Model):
	date = models.DateTimeField('date published')
	name = models.CharField(max_length=50)
	body = models.CharField(max_length=5000)
	#more fields here
