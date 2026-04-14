from django.urls import path
from . import views

urlpatterns = [
    path('', views.quiz_view, name='quiz'),
    path('submit/', views.quiz_submit, name='quiz_submit'),
    path('buy-addon/<slug:slug>/', views.buy_addon, name='buy_addon'),
    path('addon-success/', views.addon_success, name='addon_success'),
    path('addon-webhook/', views.addon_webhook, name='addon_webhook'),
]
