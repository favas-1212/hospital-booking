from django.urls import path

from .views import (
    district_list,
    hospital_list,
    department_list,
    opd_sessions,
    available_tokens,
    book_token,
    booking_history,
    cancel_booking
)

urlpatterns = [

    path("districts/", district_list),

    path("hospitals/", hospital_list),

    path("departments/", department_list),

    path("opd-sessions/", opd_sessions),

    path("available-tokens/", available_tokens),

    path("book-token/", book_token),

    path("booking-history/", booking_history),

    path("cancel-booking/<int:booking_id>/", cancel_booking),

]
