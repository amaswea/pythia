 $(document).ready(function () {
     var csrftoken = Cookies.get('csrftoken');

     function csrfSafeMethod(method) {
         // these HTTP methods do not require CSRF protection
         return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
     }

     $.ajaxSetup({
         beforeSend: function (xhr, settings) {
             if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                 xhr.setRequestHeader("X-CSRFToken", csrftoken);
             }
         }
     });

     $.ajax({
         url: "/grades/",
         data: {
             course: course
         },
         dataType: "json",
         success: receivedNewData
     });

     //separate query for the classes most often taken concurrently with the main page class
     $.ajax({
         url: "/concurrent/",
         data: {
             course: course
         },
         dataType: "json",
         success: function (resp) {
             //pick the top three classes
             for (var i = 0; i < 3; i++) {
                 $('#concClass' + (i + 1)).append("<a class='conc-class-course' href='/" + resp[i][0] + "/'>" + resp[i][0] + "</a><br />");

				 $('#concClass' + (i + 1)).click(function () {
					 window.location.href = "/" + resp[i][0] + "/";
				 });
                 
                 (function (iter, course) {
                     //now make a separate request for each concurrent class to get the class' size and hours required
                     $.ajax({
                         url: "/grades/",
                         data: {
                             course: course
                         },
                         dataType: "json",
                         success: function (gradeData) {
                             $('#concClass' + (iter + 1)).append("<span><span class='avg-size-value'>" + Math.round(gradeData.class_size) + "</span>" +
									 " average size</span><br />" +
									 "<span><span class='hours-value'>" + Math.round(gradeData.hours_taken) + "</span> hours per week</span>");
                         }
                     });
                 })(i, resp[i][0]);
             }
         }
     });

     //set up the initial date range slider
     $("#date-slider").jqxSlider({
         step: .25,
         ticksFrequency: .25,
         tooltip: false,
         rangeSlider: true,
         showRange: true,
         mode: 'fixed',
         ticksPosition: 'top'
     });

     //create initial instructor dropdown
     $("#instructor-dropdown").jqxDropDownList({
         placeHolder: 'Filter by instructor',
         width: '74%',
         height: 22
     });

     // Create initial course filtering dropdown 
     $("#course-dropdown").jqxDropDownList({
         placeHolder: 'Filter by prerequisite',
         width: '74%',
         height: 22
     });

     // Initialize the customize button
     $('#btn-customize').jqxButton({
         width: '150',
         height: '22'
     });

     $("#btn-non-numerical").jqxToggleButton({
         width: '150',
         height: '22'
     });

     $('#btn-non-numerical').on('click', function () {
         var btnNonNumerical = $('#btn-non-numerical');
         if (!btnNonNumerical.jqxToggleButton('disabled')) {
             var dist = $distribution.distributionGraph;
             if (btnNonNumerical.jqxToggleButton('toggled')) {
                 dist.updateDistribution(false);
                 btnNonNumerical.jqxToggleButton({
                     toggled: true
                 });
             } else {
                 dist.updateDistribution(true);
             }
         }
     });

     // Intialize tooltip for the prerequisites dropdown
     $('#btn-customize').qtip({
         content: {
             text: "Click here to create a customized filter based on the classes you have taken in the past."
         },
         style: {
             classes: 'qtip-bootstrap'
         },
         position: {
             my: 'left center',
             at: 'right center',
             viewport: $(window),
             adjust: {
                 scroll: true,
                 resize: true
             }
         },
         hide: {
             event: 'click mouseleave'
         }
     });

     $('#btn-non-numerical-box').qtip({
         content: {
             text: "Show the grades assigned non-standard grading scores (CR/NC)."
         },
         style: {
             classes: 'qtip-bootstrap'
         },
         position: {
             my: 'left center',
             at: 'right center',
             viewport: $(window),
             adjust: {
                 scroll: true,
                 resize: true
             }
         },
         hide: {
             event: 'click mouseleave'
         }
     });

     // Register event handlers for the comments button
     $('#commentsSubmit').click(function () {
         // Hacking the comments area to just show the text entered below!
         var textValue = $('#commentsArea')[0].value;
         if (textValue != '') {
             var newComments = $('#commentsPanel').clone();
             newComments.attr('id', '');
             newComments.children('.panel-body').text(textValue);
             $('#commentsList').append(newComments);
         }
     });

     // Initialize the submit button for the upload form
     $('#btn-customize-submit').click(function () {
         //make the updated filter request
         // Get the value from the text field
         var textValue = $('#modal-html-textField')[0].value;
         if (textValue != '') {
             $.ajax({
                 type: 'POST',
                 url: '/parse/',
                 data: {
                     html: textValue
                 },
                 dataType: 'json',
                 success: function (resp) {
                     if (resp != null) {
                         updateCustomize(resp);
                         // hide the modal dialog
                         $('#uploadModal').modal('hide');
                     } else {
                         $('#modal-dialog-alert').show();
                     }
                 },
                 error: function () {
                     $('#modal-dialog-alert').show();
                 }
             });
         } else {
             $('#modal-dialog-alert').show();
         }
     });

     $distribution.distributionGraph = new $distribution.Graph();
 });

 var ranOnce = false;

 //when any filter control changes this function is called
 //creates a new filter and sends an ajax request for updated data
 function requestNewData(ignoreFilter) {
     var filter = {
         course: course
     }

     if (!ignoreFilter) {
         //fetch the instructor name if one is selected
         var instr = $("#instructor-dropdown").jqxDropDownList('getSelectedItem');
         if (instr !== 'All instructors' && instr !== null) {
             var parts = instr.label.split(", ");
             filter.fname = parts[1];
             filter.lname = parts[0];
         }

         var values = $("#date-slider").jqxSlider('values');
         filter.minyr = Math.floor(values[0]);
         filter.minqtr = (values[0] % 1) * 4 + 1;
         filter.maxyr = Math.floor(values[1]);
         filter.maxqtr = (values[1] % 1) * 4 + 1;

         // Get the courses that are currently selected in the advanced filtering dropdown
         var checkedItems = $("#course-dropdown").jqxDropDownList('getCheckedItems');
         var prereqs = [];
         if (checkedItems) {
             for (var i = 0; i < checkedItems.length; i++) {
                 var item = checkedItems[i];
                 prereqs.push(item.value);
             }

             filter.prereqs = prereqs;
         }
     }

     //make the updated filter request
     $.ajax({
         url: "/grades",
         data: filter,
         dataType: "json",
         success: receivedNewData
     });
 };

 // This is called when the parsed HTML has been submitted, and the list of classes is returned from the parser
 function updateCustomize(resp) {
     $('#course-dropdown').off('checkChange');
     $("#course-dropdown").jqxDropDownList({
         source: resp,
         checkboxes: true,
         placeHolder: 'Filter by prerequisite',
         enableHover: false
     });

     $("#course-dropdown").on('checkChange', function (event) {
         if (event.args) {
             var item = event.args.item;
             var value = item.value;
             if (value == "Clear all") {
                 $('#course-dropdown').jqxDropDownList('uncheckAll');
             }
         }
         requestNewData(false);
     });

     $('#course-dropdown').show();

     // TODO: restructure removing the col classes not needed
     $('#course-dropdown').parent().removeClass('col-md-3');
     $('#course-dropdown').parent().addClass('col-md-4');

     $('#btn-customize').hide();
 };

 //this is called when new filter data comes in
 //updates the range of values of the filter controls
 function receivedNewData(resp) {
     //create the 4 quarters for each year
     var sliderValues = [];
     for (var tick = resp.minyear + (resp.minqtr - 1) * .25; tick < resp.maxyear + resp.maxqtr * .25; tick += .25) {
         sliderValues.push(tick);
     }

     if (!ranOnce) {
         $('#date-slider').off('slideEnd');
         $('#date-slider').on('change');
         $("#date-slider").jqxSlider({
             showTickLabels: true,
             tickLabelFormatFunction: sliderValues.length < 15 ? verboseTicks : (sliderValues.length < 30 ? partialTicks : shortTicks),
             values: sliderValues,
             min: sliderValues[0],
             max: sliderValues[sliderValues.length - 1]
         });
         $("#date-slider").jqxSlider('values', [sliderValues[0], sliderValues[sliderValues.length - 1]]);
         $('#date-slider').on('slideEnd', function () {
             requestNewData(false);
         });
         $('#date-slider').on('change', function () {
             requestNewData(false);
         });

         $('#instructor-dropdown').off('select');
         resp.instructors.unshift("All instructors")
         $("#instructor-dropdown").jqxDropDownList({
             source: resp.instructors,
             placeHolder: 'Filter by instructor'
         });
         $('#instructor-dropdown').on('select', function () {
             requestNewData(false);
         });

         ranOnce = true;
     }

     // Update the grade distributions graph with the new data
     var dist = $distribution.distributionGraph;
     dist.setNumerical(resp.numeric_grade_counts);
     dist.setData(resp.grades);
     dist.setMean(resp.grade_avg);
     dist.formatNonNumericalValues.call(dist);
     dist.formatNumericalValues.call(dist);

     // Initialize with the numerical values.
     // Default to non-numerical if there are no numerical grades
     var numerical = dist.getNumericalData();
     var nonNumerical = dist.getNonNumericalData();
     var defaultFormat = numerical && numerical.length > 0 ? true : false;
     var btnNonNumerical = $('#btn-non-numerical');

     if ((defaultFormat && nonNumerical && nonNumerical.length <= 0) || (!defaultFormat && numerical && numerical.length <= 0)) {
         btnNonNumerical.jqxToggleButton({
             disabled: true
         });
         btnNonNumerical.addClass('disabled');
     } else {
         btnNonNumerical.jqxToggleButton({
             disabled: false
         });
         btnNonNumerical.removeClass('disabled');
     }

     if (dist.getInitialized()) {
         dist.updateDistribution(defaultFormat);
     } else {
         dist.initDistribution(defaultFormat);
     }

     $('#hours-taken-label').text(Math.round(resp.hours_taken));
     $('#size-label').text(Math.round(resp.class_size));
 };

 function verboseTicks(value) {
     switch (value % 1) {
     case 0:
         return 'W' + value;
     case .25:
         return 'Sp' + Math.floor(value);
     case .5:
         return 'Su' + Math.floor(value);
     case .75:
         return 'F' + Math.floor(value);
     }
 };

 function partialTicks(value) {
     switch (value % 1) {
     case 0:
         return 'W' + ("0" + value).slice(-2);
     case .25:
         return 'Sp' + ("0" + Math.floor(value)).slice(-2);
     case .5:
         return 'Su' + ("0" + Math.floor(value)).slice(-2);
     case .75:
         return 'F' + ("0" + Math.floor(value)).slice(-2);
     }
 };

 function shortTicks(value) {
     switch (value % 1) {
     case 0:
         return value;
     default:
         return '';
     }
 };

 var $distribution = $distribution || {};
 var distributionGraph = (function ($distribution) {
     $distribution.Graph = function () {
         this.tooltip = undefined;;
         this.x = undefined;
         this.y = undefined;
         this.svg = undefined;
         this.data = undefined;
         this.mean = undefined;
         this.initialized = false;
         this.numericalData = undefined;
         this.nonNumericalData = undefined;
     };

     $distribution.Graph.prototype.getInitialized = function () {
         return this.initialized;
     };

     $distribution.Graph.prototype.getNumericalData = function () {
         return this.numericalData;
     };

     $distribution.Graph.prototype.getNonNumericalData = function () {
         return this.nonNumericalData;
     };

     $distribution.Graph.prototype.setNumerical = function (numericalData) {
         this.numerical = numericalData;
     };

     $distribution.Graph.prototype.setData = function (dataValue) {
         this.data = dataValue;
     };

     $distribution.Graph.prototype.setMean = function (meanValue) {
         // Hack! We should convert these to decimal value before sending
         this.mean = meanValue / 10;
     };

     // Format a list of the numerical values from the data passed in
     $distribution.Graph.prototype.formatNumericalValues = function () {
         var gradesList = [];
         for (var i = 0; i < this.numerical.length; i++) {
             var gradeObj = {};
             // number is an intege
             var gradeNumber = (i / 10);
             var gradeFloor = Math.floor(gradeNumber);
             if (gradeNumber === gradeFloor) {
                 // Integer value
                 gradeNumber = gradeNumber + '.0';
             } else {
                 // Decimal value
                 gradeNumber = gradeNumber + '';
             }
             // Convert 40, 39 etc to 4.0, 3.9, etc. 
             var gradeTotal = this.numerical[i];
             gradeObj.gradeString = gradeNumber;
             gradeObj.total = gradeTotal;
             gradesList.push(gradeObj);
         }

         this.numericalData = gradesList;
     };

     // Format a list of the non-numerical values from the data passed in
     $distribution.Graph.prototype.formatNonNumericalValues = function () {
         var gradesList = [];
         for (var item in this.data) {
             var itemValue = parseInt(item)
             if (isNaN(itemValue) && item.length > 0) {
                 var gradeObj = {};
                 var gradeString = item;
                 // Convert 40, 39 etc to 4.0, 3.9, etc. 
                 var gradeTotal = this.data[item];
                 gradeObj.gradeString = gradeString;
                 gradeObj.total = gradeTotal;
                 gradesList.push(gradeObj);
             }
         }

         this.nonNumericalData = gradesList;
     };

     // Update the distribution graph given the new data
     $distribution.Graph.prototype.updateDistribution = function (numerical) {
         var self = this;
         var gradesList = numerical ? self.numericalData : self.nonNumericalData;
         var x = self.x;
         var y = self.y;
         var svg = self.svg;
         var tip = self.tooltip;

         // Update the axes
         removeAxes(svg);

         // Update the bars in the distribution graph
         var bars = svg.selectAll("rect").data(gradesList);
         drawAxes(x, y, svg, height, gradesList);
         generateBars(x, y, bars, tip);
         updateBars(x, y, bars);
         removeBars(x, y, bars);

         if (numerical) {
             appendMeanLine(x, y, svg, self.mean);
         }

         if (!numerical) {
             generateLegend(svg, height);
         }
     };

     // Intialize the distribution graph
     $distribution.Graph.prototype.initDistribution = function (numerical) {
         var self = this;
         self.initialized = true;

         // Format the data 
         var gradesList = numerical ? self.numericalData : self.nonNumericalData;
         var margin = {
             top: 20,
             right: 20,
             bottom: 30,
             left: 40
         };
         width = $('.grade-dist').width() - 56;
         height = 400 - margin.top - margin.bottom;

         // Initialize the X and Y axes
         var x = d3.scale.ordinal()
             .rangeRoundBands([0, width], .1);

         var y = d3.scale.linear()
             .range([height, 0]);

         // Initialize the tooltips
         var tip = d3.tip()
             .attr('class', 'd3-tip')
             .offset([-10, 0])
             .html(function (d) {
                 return "<strong>Students:</strong> " + d.total + "";
             })
         self.tooltip = tip;

         // Initialize the SVG
         var svg = d3.select(".grade-dist").append("svg")
             .attr("class", "dist-graph")
             .attr("width", width)
             .attr("height", height + margin.top + margin.bottom)
             .append("g")
             .attr("transform", "translate(" + (margin.left + 10) + ",0)");
         svg.call(tip);

         var bars = svg.selectAll("rect").data(gradesList);

         drawAxes(x, y, svg, height, gradesList);
         generateBars(x, y, bars, tip);
         appendMeanLine(x, y, svg, self.mean);

         // Set the variables to be used by the update function
         self.svg = svg;
         self.x = x;
         self.y = y;

         function type(d) {
             d.total = +d.total;
             return d;
         }
     };

     // Draw the X and Y Axes onto the graph
     var drawAxes = function (x, y, svg, height, data) {
         x.domain(data.map(function (d) {
             return d.gradeString;
         }));
         y.domain([0, d3.max(data, function (d) {
             return d.total;
         })]);

         var xAxis = d3.svg.axis()
             .scale(x)
             .orient("bottom");

         var yAxis = d3.svg.axis()
             .scale(y)
             .orient("left")
             .ticks(5);

         svg.append("g")
             .attr("class", "x axis")
             .attr("transform", "translate(0," + height + ")")
             .call(xAxis);

         svg.append("g")
             .attr("class", "y axis")
             .call(yAxis)
             .append("text")
             .attr("transform", "rotate(-90)")
             .attr("y", -40)
             .attr("x", -150)
             .attr("dy", ".5em")
             .attr("class", "y-axis-label")
             .style("text-anchor", "end")
             .text("Number of Students");
     };

     // Remove the previous axes and mean line
     var removeAxes = function (svg) {
         svg.select(".y.axis").remove();
         svg.select(".x.axis").remove();
         svg.select(".mean-line").remove();
         svg.select(".mean-line-label").remove();
         svg.select(".mean-line-value").remove();
     };

     // Remove the bars not needed to represent the new data
     var removeBars = function (x, y, bars) {
         bars.exit()
             .transition()
             .duration(500)
             .attr("y", y(0))
             .attr("height", height - y(0))
             .remove();
     };

     // Update the current bars for the new data
     var updateBars = function (x, y, bars) {
         bars.transition()
             .duration(1000)
             .attr("x", function (d) {
                 return x(d.gradeString);
             })
             .attr("width", x.rangeBand())
             .attr("y", function (d) {
                 return y(d.total);
             })
             .attr("height", function (d) {
                 return height - y(d.total);
             });

     };

     // Generates the bars to add to the graph
     var generateBars = function (x, y, bars, tip) {
         bars
             .enter()
             .append("rect")
             .attr("class", "bar")
             .attr("x", function (d) {
                 return x(d.gradeString);
             })
             .attr("width", x.rangeBand())
             .attr("y", function (d) {
                 return y(d.total);
             })
             .attr("height", function (d) {
                 return height - y(d.total);
             })
             .on('mouseover', tip.show)
             .on('mouseout', tip.hide);
     };

     // Appends the mean line to the graph 
     var appendMeanLine = function (x, y, svg, mean) {
         // Computes the X coordinates of the mean line
         var xCoord = computeMeanCoordinate(x, y, mean);
         svg.append("line")
             .attr("class", "line")
             .attr("class", "mean-line")
             .attr("id", "meanLine")
             .attr("y1", 0)
             .attr("x1", function (d) {
                 return xCoord;
             })
             .attr("y2", height)
             .attr("x2", function (d) {
                 return xCoord;
             })
             .transition()
             .duration(1000); // Not working!

         var labelCoord = xCoord - 45;
         svg.append("text")
             .attr("class", "mean-line-label")
             .text("Mean")
             .attr("transform", "translate(" + labelCoord + ", 10)");

         var valCoord = xCoord + 5;
         svg.append("text")
             .attr("class", "mean-line-value")
             .text(Math.round(mean * 100) / 100)
             .attr("transform", "translate(" + valCoord + ", 10)");
     };

     // Generate the legend to show the grading codes and their meanings
     var generateLegend = function (svg, height) {
         var text = svg.append("text")
             .attr("class", "legend")
             .attr("xml:space", "preserve")
             .attr("transform", "translate(-15, 390)");

         text.append("tspan")
             .attr("class", "legend-label")
             .attr("dx", 10)
             .text("N")

         text.append("tspan")
             .attr("class", "legend-value")
             .text("- In Progress");

         text.append("tspan")
             .attr("class", "legend-label")
             .attr("dx", 10)
             .text("I")

         text.append("tspan")
             .attr("class", "legend-value")
             .text("- Incomplete");

         text.append("tspan")
             .attr("class", "legend-label")
             .attr("dx", 10)
             .text("S")

         text.append("tspan")
             .attr("class", "legend-value")
             .text("- Satisfactory");

         text.append("tspan")
             .attr("class", "legend-label")
             .attr("dx", 10)
             .text("NS")

         text.append("tspan")
             .attr("class", "legend-value")
             .text("- Not-satisfactory");

         text.append("tspan")
             .attr("class", "legend-label")
             .attr("dx", 10)
             .text("C")

         text.append("tspan")
             .attr("class", "legend-value")
             .text("- Credit");

         text.append("tspan")
             .attr("class", "legend-label")
             .attr("dx", 10)
             .text("NC")

         text.append("tspan")
             .attr("class", "legend-value")
             .text("- No-Credit");

         text.append("tspan")
             .attr("class", "legend-label")
             .attr("dx", 10)
             .text("W(1-7)")

         text.append("tspan")
             .attr("class", "legend-value")
             .text("- Withdrew (Week of quarter)");

         text.append("tspan")
             .attr("class", "legend-label")
             .attr("dx", 10)
             .text("HW")

         text.append("tspan")
             .attr("class", "legend-value")
             .text("- Hardship Withdrawal");
     };

     // Computes the X coordinates of the mean line
     var computeMeanCoordinate = function (x, y, mean) {
         var roundedUp = Math.ceil(mean * 10) / 10;
         var roundedDown = Math.floor(mean * 10) / 10;

         var upString = Math.floor(roundedUp) === roundedUp ? roundedUp + '.0' : roundedUp + '';
         var downString = Math.floor(roundedDown) == roundedDown ? roundedDown + '.0' : roundedDown + '';
         var upCoord = x(upString);
         var downCoord = x(downString);
         var proportion = (mean - roundedDown) * 10;
         var xCoord = downCoord + (upCoord - downCoord) * proportion;
         return xCoord;
     };
 })($distribution);