from django.urls import path
from .views import opd_sessions, available_tokens, book_token, district_list, hospital_list, department_list

urlpatterns = [
    path('opd-sessions/', opd_sessions),
    path('available-tokens/', available_tokens),
    path('book-token/', book_token),
    path('districts/', district_list),
    path('hospitals/', hospital_list),
    path('departments/', department_list),
]
