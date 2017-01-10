$(document).ready(function () {
    $('#classSearchBar').jqxInput({
        placeHolder: 'Search for a class...',
        source: class_list,
        searchMode: 'startswithignorecase'
    });
    $('#classSearchBar').on('select', function () {
        var course = $(this).val();
        var calculated_url = view_class_generic_url.replace('AAA999', course);
        document.location.href = calculated_url;
    });
});