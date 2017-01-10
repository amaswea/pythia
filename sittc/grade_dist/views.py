from django.shortcuts import render
from django.http import HttpResponse
from parse_transcript import *
import json
import time
import os

from .models import Grade, Eval

def about_us(request):
	return render(request, 'grade_dist/about.html')

def index(request):
	#create the query to get the unique list of full class codes (like 'CSE_510') here
	context = {
		'class_list': json.dumps(Grade.objects.uniqueClassList()),
	}
	return render(request, 'grade_dist/index.html', context)

def classfilter(request, course):
    #grades = sorted([g['grade'] for g in Grade.objects.filter(course=course).values('grade')])
    g = Grade.objects.gradeDistByClass(course, 2000, 2016, '', '', 0, 4)
    context = {
		'class_list': json.dumps(Grade.objects.uniqueClassList()), 
        'course': course,
	}

    return render(request, 'grade_dist/class.html', context)

def grades(request):
	#start = time.time()
	
	course = request.GET.get('course')
	if course is None:
		return HttpResponseBadRequest()
	
	fname = request.GET.get('fname', '')
	lname = request.GET.get('lname', '')
	minyr = request.GET.get('minyr', 1999)
	qmin = request.GET.get('minqtr', 0)
	maxyr = request.GET.get('maxyr', 2020)
	qmax = request.GET.get('maxqtr', 4)
	prereqs = request.GET.getlist('prereqs[]')
	
	resp = {}
	if (len(prereqs) == 0):
		resp = Grade.objects.gradeDistByClass(course, minyr, maxyr, fname, lname, qmin, qmax)
	else:
		resp = Grade.objects.gradeDistByClassAdv(course, minyr, maxyr, fname, lname, qmin, qmax, prereqs, 2)
	
	resp.update(Eval.objects.evalData(course, minyr, maxyr, fname, lname, qmin, qmax))
	
	#print "grade query took " + str(time.time() - start) + " seconds"
	return HttpResponse(json.dumps(resp))

def parse_transc(request):
    html = request.POST.get('html')
	
    script_dir = os.path.dirname(__file__)
	
    #write the text to a file
    fname = script_dir + '/transcripthtml_files/' + str(time.time()) + '.html'
    print fname
    f = open(fname, 'w')
    print ' the html  is ' + str(html)
    f.write(html)
    f.close()
    return HttpResponse(json.dumps(parse_transcript_html(fname)))
	
	

def concurrent(request):
	#start = time.time()
	course = request.GET.get('course')
	if course is None:
		return HttpResponseBadRequest()
	
	resp = Grade.objects.mostTakenWith(course)
	#print "concurrent query took " + str(time.time() - start) + " seconds"
	return HttpResponse(json.dumps(resp))
	
def template(request):
	return render(request, 'grade_dist/template.html')
