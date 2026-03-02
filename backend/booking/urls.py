from django.urls import path
from .views import (
    district_list,
    hospital_list,
    department_list,
    opd_sessions,
    available_tokens,
    book_token,
    booking_history,
    cancel_booking,
    tokens_by_date,
    doctor_dashboard,
    start_opd_with_notifications,   # ✅ updated
    doctor_next_token,
    doctors_by_department,
    approved_doctors,
    doctor_tokens_by_date,
    opd_dashboard,
    book_walkin_token,
    fetch_tokens,
    approve_booking,
    reject_booking,
    patient_token_status
)

urlpatterns = [

    # =============================
    # PUBLIC APIs
    # =============================
    path("districts/", district_list),
    path("hospitals/", hospital_list),
    path("departments/", department_list),
    path("opd-sessions/", opd_sessions),
    path("available-tokens/", available_tokens),

    # =============================
    # PATIENT APIs
    # =============================
    path("book-token/", book_token),
    path("booking-history/", booking_history),
    path("cancel-booking/<int:booking_id>/", cancel_booking),

    # =============================
    # STAFF / ADMIN APIs
    # =============================
    path("booking/tokens/", tokens_by_date),
    path("opd/doctors/", approved_doctors),
    path("opd/doctor-tokens/", doctor_tokens_by_date),
    path("opd/dashboard/", opd_dashboard),

    # =============================
    # DOCTOR APIs
    # =============================
    path("doctor/dashboard/", doctor_dashboard),
    path("doctor/start-opd/", start_opd_with_notifications),  # ✅ updated here
    path("doctor/next-token/", doctor_next_token),
    path("doctors/", doctors_by_department),
    path("book-walkin-token/", book_walkin_token),
    path("fetch-tokens/", fetch_tokens),

    # =============================
    # ONLINE TOKEN APPROVAL
    # =============================
    path("booking/approve_booking/<int:booking_id>/", approve_booking),
    path("booking/reject_booking/<int:booking_id>/", reject_booking),
    path("patient/token-status/", patient_token_status),
]