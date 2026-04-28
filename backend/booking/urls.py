"""
MedQueue Booking URL Configuration
"""

from django.urls import path
from .views import (
    # ── Public / Lookup ──
    district_list,
    hospital_list,
    department_list,
    opd_sessions,
    doctors_by_department,
    approved_doctors,
    fetch_tokens,
    queue_status,

    # ── Patient ──
    book_token,
    booking_history,
    cancel_booking,
    patient_token_status,
    patient_confirm_attendance,
    patient_reject_booking,

    # ── Doctor ──
    doctor_dashboard,
    start_opd,
    doctor_next_token,
    skip_token,
    end_opd,
    pause_opd,
    resume_opd,

    # ── Staff / Admin ──
    book_walkin_token,
    tokens_by_date,
    opd_dashboard,
    approve_booking,
    reject_booking,
    doctor_tokens_by_date,

    # ── Doctor Approvals (OPD Staff) ──
    pending_doctors,
    approve_doctor,
    reject_doctor,

    # ── Consultation History ──
    consultation_history,
    resend_opd_notification,
    staff_confirm_attendance,
    available_booking_dates,

    # ── [NEW] STAFF — Doctor Leave Management ──
    staff_apply_leave,
    staff_cancel_leave,
    staff_list_leaves,
    patient_prescriptions,
    doctor_get_prescription,
    doctor_save_prescription
)

urlpatterns = [

    # ════════════════════════════════════════
    # PUBLIC / LOOKUP
    # ════════════════════════════════════════
    path("districts/",           district_list,         name="district-list"),
    path("hospitals/",           hospital_list,         name="hospital-list"),
    path("departments/",         department_list,       name="department-list"),
    path("opd-sessions/",        opd_sessions,          name="opd-sessions"),
    path("doctors/",             doctors_by_department, name="doctors-by-department"),
    path("doctors/all/",         approved_doctors,      name="approved-doctors"),
    path("tokens/availability/", fetch_tokens,          name="fetch-tokens"),
    path("queue/status/",        queue_status,          name="queue-status"),
    path("opd/pause/",           pause_opd,             name="pause_opd"),
    path("opd/resume/",          resume_opd,            name="resume_opd"),

    # ════════════════════════════════════════
    # PATIENT
    # ════════════════════════════════════════
    path("patient/book/",                        book_token,                 name="book-token"),
    path("patient/history/",                     booking_history,            name="booking-history"),
    path("patient/cancel/<int:booking_id>/",     cancel_booking,             name="cancel-booking"),
    path("patient/token-status/",                patient_token_status,       name="patient-token-status"),
    path("patient/confirm/<int:booking_id>/",    patient_confirm_attendance, name="patient-confirm"),
    path("patient/reject/<int:booking_id>/",     patient_reject_booking,     name="patient-reject"),

    # ════════════════════════════════════════
    # DOCTOR
    # ════════════════════════════════════════
    path("doctor/dashboard/",                    doctor_dashboard,  name="doctor-dashboard"),
    path("doctor/start-opd/",                    start_opd,         name="start-opd"),
    path("doctor/next-token/",                   doctor_next_token, name="doctor-next-token"),
    path("doctor/skip/<int:booking_id>/",        skip_token,        name="skip-token"),
    path("doctor/end-opd/",                      end_opd,           name="end-opd"),

    # ════════════════════════════════════════
    # STAFF / ADMIN
    # ════════════════════════════════════════
    path("staff/walkin/",                        book_walkin_token,     name="book-walkin"),
    path("staff/tokens/",                        tokens_by_date,        name="tokens-by-date"),
    path("staff/opd-dashboard/",                 opd_dashboard,         name="opd-dashboard"),
    path("staff/doctor-tokens/",                 doctor_tokens_by_date, name="doctor-tokens-by-date"),
    path("staff/approve/<int:booking_id>/",      approve_booking,       name="approve-booking"),
    path("staff/reject/<int:booking_id>/",       reject_booking,        name="reject-booking"),
    path("available-dates/",                     available_booking_dates),

    # Doctor registration approvals
    path("staff/pending-doctors/",               pending_doctors,  name="pending-doctors"),
    path("staff/approve-doctor/<int:doctor_id>/", approve_doctor,  name="approve-doctor"),
    path("staff/reject-doctor/<int:doctor_id>/",  reject_doctor,   name="reject-doctor"),
    path("doctor/prescription/<int:booking_id>/",       doctor_get_prescription,  name="doctor-get-prescription"),
    path("doctor/prescription/<int:booking_id>/save/",  doctor_save_prescription, name="doctor-save-prescription"),
    path("patient/prescriptions/",                       patient_prescriptions,    name="patient-prescriptions"),

    # Consultation history
    path("staff/consultation-history/",                 consultation_history,     name="consultation-history"),
    path("staff/resend-notification/<int:booking_id>/", resend_opd_notification,  name="resend-notification"),
    path("staff/confirm-attendance/<int:booking_id>/",  staff_confirm_attendance, name="staff-confirm-attendance"),

    # ── [NEW] Doctor Leave Management (OPD STAFF) ──
    path("staff/leave/apply/",  staff_apply_leave,  name="staff-apply-leave"),
    path("staff/leave/cancel/", staff_cancel_leave, name="staff-cancel-leave"),
    path("staff/leave/list/",   staff_list_leaves,  name="staff-list-leaves"),
]
