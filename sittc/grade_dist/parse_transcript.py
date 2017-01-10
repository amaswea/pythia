
#deal with how to pass the file in at the front end
#returns dictionary where key is class and value is grade
def parse_transcript_html(filename):
    transcript_html = open(filename, "r")
    quarter_opts = ["Autumn", "Winter", "Spring", "Summer"]
    line = None
    while line == None or "<h1>Grade Report - All Quarters</h1>" not in line:
        line = transcript_html.readline()
        if line == '':
            print "Not a valid transcript html. Please ensure All Quarters is selected."
            print "EOF"
            return None

    #list of tuples of course, grade.
    courses_and_grades = []

    while True:
        line = transcript_html.readline()
        if not line:
            courses_and_grades.sort() #sort the courses alphabetically before returning
            return courses_and_grades
        read = True
        if '\t<th>Course</th>' in line:
			line = transcript_html.readline()
			read = read and '\t<th>Course Title</th>' in line
			line = transcript_html.readline()
			read = read and '\t<th>Credits</th>' in line
			line = transcript_html.readline()
			read = read and '\t<th>Grade</th>' in line
			line = transcript_html.readline()
			read = read and '\t<th>Grade' in line and 'Points</th>' in line
			transcript_html.readline()
			transcript_html.readline()
			if not read:
					continue
			endquarter = False
			while not endquarter:
				
				#now at the start of course information
				# read past <td align="left"><tt>
				coursename = ""
				graderecv = ""

				#differences in html
				courseline = transcript_html.readline()
				if courseline[-2:] == "\r\n":
					coursename = courseline[22:-12]
				if courseline[-2:] == ">\n":
					coursename = courseline[22:-11]
				transcript_html.readline()
				transcript_html.readline()
				gradeline = transcript_html.readline()
				if gradeline[-2:] == "\r\n":
					graderecv = gradeline[24:-12]
				if gradeline[-2:] == ">\n":
					graderecv = gradeline[24:-11]

				print coursename
				print graderecv
				courses_and_grades.append(coursename)
				transcript_html.readline()
				transcript_html.readline()
				next = transcript_html.readline()
				if next == '</tbody></table>\n' or '</table>' in next:
					endquarter = True

if __name__ == "__main__":
	#parse_transcript_html("transcripthtml.html")
	x = parse_transcript_html("../sample_transcript.html")
	print x