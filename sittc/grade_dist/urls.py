from django.conf.urls import url

from . import views

urlpatterns = [
	url(r'^$', views.index, name='index'),
    url(r'^template$', views.template, name='template'),
	url(r'^(?P<course>[A-Z0-9 ]+)', views.classfilter, name='class'),
    url(r'^grades/$', views.grades, name='grades'),
    url(r'^concurrent/$', views.concurrent, name='concurrent'),
    url(r'^parse/$', views.parse_transc, name='parse'),
    url(r'^about/$', views.about_us, name='about')
]
