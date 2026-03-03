from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils.dateparse import parse_date
from django.utils.timezone import now

from .models import (
    District,
    Hospital,
    Department,
    Booking,
    OPDSession,
    OPDDay
)

from .serializers import (
    DistrictSerializer,
    HospitalSerializer,
    DepartmentSerializer,
    BookingSerializer,
    BookingHistorySerializer
)

from accounts.models import Patient, Doctor


# =====================================================
# HELPER FUNCTIONS (NO DUPLICATION)
# =====================================================

def get_doctor(user):
    try:
        return Doctor.objects.get(user=user)
    except Doctor.DoesNotExist:
        return None


def process_next_token(queryset):
    """
    Handles token transition safely:
    consulting -> done
    waiting -> consulting
    """

    current = queryset.filter(status="consulting").first()
    if current:
        current.status = "done"
        current.save()

    next_booking = queryset.filter(status="waiting").first()
    if next_booking:
        next_booking.status = "consulting"
        next_booking.save()
        return next_booking

    return None


# =====================================================
# DISTRICT LIST
# =====================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def district_list(request):
    districts = District.objects.all()
    serializer = DistrictSerializer(districts, many=True)
    return Response(serializer.data)


# =====================================================
# HOSPITAL LIST
# =====================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def hospital_list(request):
    district_id = request.GET.get("district_id")

    if not district_id:
        return Response({"error": "district_id is required"}, status=400)

    hospitals = Hospital.objects.filter(district_id=district_id)
    serializer = HospitalSerializer(hospitals, many=True)
    return Response(serializer.data)


# =====================================================
# DEPARTMENT LIST
# =====================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def department_list(request):
    hospital_id = request.GET.get("hospital_id")

    if not hospital_id:
        return Response({"error": "hospital_id is required"}, status=400)

    departments = Department.objects.filter(hospital_id=hospital_id)
    serializer = DepartmentSerializer(departments, many=True)
    return Response(serializer.data)


# =====================================================
# OPD SESSION LIST
# =====================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def opd_sessions(request):
    return Response([
        {"value": session[0], "label": session[1]}
        for session in OPDSession.choices
    ])


# =====================================================
# AVAILABLE TOKENS
# =====================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def available_tokens(request):
    department_id = request.GET.get("department_id")
    session = request.GET.get("session")
    booking_date = request.GET.get("booking_date")

    if not all([department_id, session, booking_date]):
        return Response({"error": "Missing parameters"}, status=400)

    MAX_TOKENS = 20

    booked = Booking.objects.filter(
        department_id=department_id,
        session=session,
        booking_date=booking_date
    ).count()

    return Response({
        "max_tokens": MAX_TOKENS,
        "booked": booked,
        "available": max(0, MAX_TOKENS - booked)
    })


# =====================================================
# BOOK TOKEN
# =====================================================
# @api_view(["POST"])
# @permission_classes([IsAuthenticated])
# @transaction.atomic
# def book_token(request):

#     serializer = BookingSerializer(
#         data=request.data,
#         context={"request": request}
#     )

#     if serializer.is_valid():
#         booking = serializer.save()
#         return Response(
#             BookingSerializer(booking).data,
#             status=status.HTTP_201_CREATED
#         )

#     return Response(serializer.errors, status=400)


# =====================================================
# BOOKING HISTORY
# =====================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def booking_history(request):

    try:
        patient = Patient.objects.get(user=request.user)
    except Patient.DoesNotExist:
        return Response({"error": "Not a patient account"}, status=403)

    bookings = Booking.objects.filter(
        patient=patient
    ).order_by("-created_at")

    serializer = BookingHistorySerializer(bookings, many=True)
    return Response(serializer.data)


# =====================================================
# CANCEL BOOKING
# =====================================================
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def cancel_booking(request, booking_id):

    try:
        patient = Patient.objects.get(user=request.user)
    except Patient.DoesNotExist:
        return Response({"error": "Not a patient account"}, status=403)

    try:
        booking = Booking.objects.get(
            id=booking_id,
            patient=patient
        )
        booking.delete()
        return Response({"message": "Booking cancelled successfully"})

    except Booking.DoesNotExist:
        return Response({"error": "Booking not found"}, status=404)


# =====================================================
# TOKENS BY DATE (ADMIN/STAFF)
# =====================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tokens_by_date(request):

    department_id = request.GET.get("department_id")
    session = request.GET.get("session")
    booking_date = request.GET.get("booking_date")

    bookings = Booking.objects.filter(
        department_id=department_id,
        session=session,
        booking_date=booking_date
    ).select_related(
        "patient",
        "department",
        "department__hospital"
    ).order_by("token_number")

    return Response([
        {
            "token_number": b.token_number,
            "patient_name": b.patient.user.username,
            "hospital": b.department.hospital.name,
            "department": b.department.name,
            "session": b.session,
            "booking_date": b.booking_date,
            "status": b.status
        }
        for b in bookings
    ])


# =====================================================
# DOCTOR DASHBOARD
# =====================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctor_dashboard(request):
    date_str = request.GET.get("date")
    booking_date = parse_date(date_str)

    if not booking_date:
        return Response({"error": "Invalid date"}, status=400)

    doctor = get_doctor(request.user)
    if not doctor:
        return Response({"error": "Not a doctor account"}, status=403)

    # Include all bookings
    bookings = Booking.objects.filter(
        doctor=doctor,
        booking_date=booking_date
    ).select_related("patient").order_by("token_number")

    tokens_list = []
    for b in bookings:
        tokens_list.append({
            "token": b.token_number,
            "patient": b.patient.user.username if b.patient else None,
            "walkin_name": b.walkin_name if b.walkin_name else None,
            "status": b.status if b.status else "waiting"
        })

    return Response({
        "date": booking_date,
        "total_tokens": bookings.count(),
        "tokens": tokens_list
    })
# =====================================================
# START OPD
# =====================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def start_opd(request):

    date_str = request.GET.get("date")
    booking_date = parse_date(date_str)

    if not booking_date:
        return Response({"error": "Invalid date"}, status=400)

    doctor = get_doctor(request.user)
    if not doctor:
        return Response({"error": "Not a doctor account"}, status=403)

    opd_day, created = OPDDay.objects.get_or_create(
        doctor=doctor,
        date=booking_date
    )

    if opd_day.is_active:
        return Response({"message": "OPD already started"})

    opd_day.started_at = now()
    opd_day.is_active = True
    opd_day.save()

    return Response({
        "message": "OPD started successfully",
        "started_at": opd_day.started_at
    })


# =====================================================
# DOCTOR NEXT TOKEN
# =====================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def doctor_next_token(request):

    date_str = request.GET.get("date")
    booking_date = parse_date(date_str)

    if not booking_date:
        return Response({"error": "Invalid date"}, status=400)

    doctor = get_doctor(request.user)
    if not doctor:
        return Response({"error": "Not a doctor account"}, status=403)

    bookings = Booking.objects.select_for_update().filter(
        doctor=doctor,
        booking_date=booking_date
    ).order_by("token_number")

    if not bookings.exists():
        return Response({"message": "No tokens booked"})

    # Finish current consulting
    current = bookings.filter(status="consulting").first()
    if current:
        current.status = "done"
        current.save()

    # 🔥 Only call APPROVED patients
    next_booking = bookings.filter(
        status="approved"
    ).first()

    if not next_booking:
        return Response({"message": "No approved tokens remaining"})

    next_booking.status = "consulting"
    next_booking.consulting_started_at = now()
    next_booking.save()

    return Response({
        "message": f"Now consulting token {next_booking.token_number}",
        "token": next_booking.token_number
    })

from rest_framework.decorators import api_view
from rest_framework.response import Response
from accounts.models import Doctor
from .serializers import DoctorListSerializer

from rest_framework.permissions import AllowAny

@api_view(["GET"])
@permission_classes([AllowAny])
def doctors_by_department(request):
    department_id = request.GET.get("department_id")

    if not department_id:
        return Response({"detail": "department_id required"}, status=400)

    doctors = Doctor.objects.filter(
        department_id=department_id,
        is_approved=True
    )

    serializer = DoctorListSerializer(doctors, many=True)
    return Response(serializer.data)

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils.dateparse import parse_date
from django.db.models import Count
from accounts.models import Doctor
from booking.models import Booking, OPDDay
from booking.serializers import DoctorListSerializer

# =====================================================
# ALL APPROVED DOCTORS LIST
# =====================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def approved_doctors(request):
    """
    Returns all approved doctors with their hospital and department info
    """
    doctors = Doctor.objects.filter(is_approved=True).select_related("hospital", "department")
    serializer = DoctorListSerializer(doctors, many=True)
    return Response(serializer.data)


# =====================================================
# DOCTOR TOKENS BY DATE
# =====================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctor_tokens_by_date(request):
    """
    Show token info for a doctor by date
    Query params:
    - doctor_id
    - date (YYYY-MM-DD)
    """

    doctor_id = request.GET.get("doctor_id")
    date_str = request.GET.get("date")

    if not doctor_id or not date_str:
        return Response({"error": "doctor_id and date are required"}, status=400)

    booking_date = parse_date(date_str)
    if not booking_date:
        return Response({"error": "Invalid date format"}, status=400)

    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or not approved"}, status=404)

    # Get all bookings for this doctor and date
    bookings = Booking.objects.filter(
        doctor=doctor,
        booking_date=booking_date,
        payment_status="paid"
    ).select_related("patient", "department").order_by("token_number")

    # Group by session
    sessions = {}
    for b in bookings:
        if b.session not in sessions:
            sessions[b.session] = []
        sessions[b.session].append({
            "token": b.token_number,
            "patient_name": b.patient.user.username,
            "status": b.status
        })

    return Response({
        "doctor": {
            "id": doctor.id,
            "name": doctor.full_name,
            "hospital": doctor.hospital.name,
            "department": doctor.department.name,
            "is_approved": doctor.is_approved
        },
        "date": booking_date,
        "sessions": sessions
    })


# =====================================================
# OPD DASHBOARD (ALL DOCTORS WITH TOKENS)
# =====================================================
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils.dateparse import parse_date
from django.utils.timezone import now
from booking.models import Booking
from accounts.models import Doctor

MAX_TOKENS_PER_SESSION = 60
ONLINE_START = 16
ONLINE_END = 35

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def opd_dashboard(request):
    """
    Shows OPD dashboard for admin/OPD staff with token allocation.
    Query params:
    - date (optional, default today)
    """

    date_str = request.GET.get("date")
    booking_date = parse_date(date_str) if date_str else now().date()

    doctors = Doctor.objects.filter(is_approved=True).select_related("hospital", "department")

    data = []

    for doctor in doctors:
        # Get all online bookings for this doctor and date
        bookings = Booking.objects.filter(
            doctor=doctor,
            booking_date=booking_date,
            payment_status="paid"
        ).order_by("token_number")

        # Session-wise structure
        sessions = {}

        for b in bookings:
            if b.session not in sessions:
                sessions[b.session] = {
                    "online_tokens": [],
                    "walkin_tokens": [],
                    "available_walkin_tokens": list(range(1, 16)) + list(range(36, MAX_TOKENS_PER_SESSION + 1))
                }
            # Online token assignment
            token_num = b.token_number
            if ONLINE_START <= token_num <= ONLINE_END:
                sessions[b.session]["online_tokens"].append({
                    "token": token_num,
                    "patient_name": b.patient.user.username,
                    "status": b.status
                })
                # Remove allocated token from available walk-in
                if token_num in sessions[b.session]["available_walkin_tokens"]:
                    sessions[b.session]["available_walkin_tokens"].remove(token_num)

        data.append({
            "doctor_id": doctor.id,
            "doctor_name": doctor.full_name,
            "hospital": doctor.hospital.name,
            "department": doctor.department.name,
            "date": booking_date,
            "sessions": sessions,
            "total_tokens": MAX_TOKENS_PER_SESSION
        })

    return Response(data)


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework import serializers
from django.db import transaction
from django.utils.dateparse import parse_date
from booking.models import Booking
from accounts.models import Doctor
from booking.serializers import BookingSerializer

# =========================
# CONSTANTS
# =========================



# =====================================================
# ONLINE TOKEN BOOKING
# =====================================================
from datetime import time
from django.utils.timezone import localtime

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def book_token(request):
    """
    Book an online token (16–35)
    Disable:
    - Morning after 9:00 AM
    - Evening after 2:00 PM
    """

    session = request.data.get("session")
    today = localtime().time()

    MORNING_START = time(9, 0)
    EVENING_START = time(14, 0)

    if session == "morning" and today >= MORNING_START:
        return Response(
            {"error": "Morning session booking closed after 9:00 AM"},
            status=400
        )

    if session == "evening" and today >= EVENING_START:
        return Response(
            {"error": "Evening session booking closed after 2:00 PM"},
            status=400
        )

    serializer = BookingSerializer(
        data=request.data,
        context={"request": request}
    )

    if serializer.is_valid():
        booking = serializer.save(
            is_confirmed=False,
            status="waiting"
        )
        return Response(
            BookingSerializer(booking).data,
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=400)
# =====================================================
# WALK-IN / OFFLINE TOKEN BOOKING
# =====================================================
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils.dateparse import parse_date

from accounts.models import Doctor
from booking.models import Booking

MAX_TOKENS_PER_SESSION = 60
ONLINE_RANGE = list(range(16, 36))
WALKIN_RANGE = list(range(1, 16)) + list(range(36, MAX_TOKENS_PER_SESSION + 1))

@api_view(["POST"])
@permission_classes([AllowAny])
@transaction.atomic
def book_walkin_token(request):
    """
    Book a walk-in (offline) token
    """
    doctor_id = request.data.get("doctor_id")
    session = request.data.get("session")
    booking_date_str = request.data.get("booking_date")
    token_number = request.data.get("token_number")
    walkin_name = request.data.get("patient_name")

    # Validate inputs
    if not all([doctor_id, session, booking_date_str, token_number, walkin_name]):
        return Response({"error": "Missing parameters"}, status=400)

    booking_date = parse_date(booking_date_str)
    if not booking_date:
        return Response({"error": "Invalid date"}, status=400)

    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or not approved"}, status=404)

    # Ensure token is within the valid range
    if int(token_number) not in WALKIN_RANGE:
        return Response({"error": f"Token must be in walk-in range: {WALKIN_RANGE}"}, status=400)

    # Check token availability across all bookings (online + offline)
    if Booking.objects.filter(
        doctor=doctor,
        session=session,
        booking_date=booking_date,
        token_number=token_number
    ).exists():
        return Response({"error": "Token already booked"}, status=400)

    # Create booking
    booking = Booking.objects.create(
        doctor=doctor,
        session=session,
        booking_date=booking_date,
        token_number=token_number,
        walkin_name=walkin_name,
        payment_status="offline",  # now valid
        patient=None,
        status="approved",
        is_confirmed=True           # must be None for walk-in
)

    return Response({
        "message": f"Walk-in token #{token_number} booked successfully",
        "token_number": booking.token_number,
        "patient_name": booking.walkin_name,
        "id": booking.id
    })

@api_view(["GET"])
@permission_classes([AllowAny])
def fetch_tokens(request):
    doctor_id = request.GET.get("doctor_id")
    session = request.GET.get("session")
    date_str = request.GET.get("date")

    if not all([doctor_id, session, date_str]):
        return Response({"error": "doctor_id, session, and date are required"}, status=400)

    booking_date = parse_date(date_str)
    if not booking_date:
        return Response({"error": "Invalid date format"}, status=400)

    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or not approved"}, status=404)

    bookings = Booking.objects.filter(
        doctor=doctor,
        session=session,
        booking_date=booking_date
    )

    booked_online_tokens = [b.token_number for b in bookings if b.token_number in ONLINE_RANGE]
    booked_walkin_tokens = [b.token_number for b in bookings if b.token_number in WALKIN_RANGE]
    available_walkin_tokens = [t for t in WALKIN_RANGE if t not in booked_walkin_tokens]

    return Response({
        "doctor": {
            "id": doctor.id,
            "name": doctor.full_name,
            "hospital": doctor.hospital.name,
            "department": doctor.department.name
        },
        "date": booking_date,
        "session": session,
        "booked_online_tokens": booked_online_tokens,
        "booked_walkin_tokens": booked_walkin_tokens,
        "available_walkin_tokens": available_walkin_tokens,
        "max_tokens_per_session": MAX_TOKENS_PER_SESSION
    })


from django.core.mail import send_mail
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils.timezone import now
from booking.models import Booking, OPDDay
from accounts.models import Doctor
from django.db import transaction


from rest_framework import status
from django.db import transaction
from django.utils.dateparse import parse_date
from django.core.mail import send_mail



@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def start_opd_with_notifications(request):
    """
    Start OPD for a doctor and send emails to all online-booked patients.
    Online tokens: 16-35
    After sending emails, all online tokens are set to 'waiting'.
    """

    doctor_id = request.data.get("doctor_id")
    date_str = request.data.get("date")

    if not doctor_id or not date_str:
        return Response({"error": "doctor_id and date are required"}, status=400)

    # Fetch doctor
    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or not approved"}, status=404)

    # Parse booking date
    booking_date = parse_date(date_str)
    if not booking_date:
        return Response({"error": "Invalid date format"}, status=400)

    # Get or create OPD day
    opd_day, created = OPDDay.objects.get_or_create(doctor=doctor, date=booking_date)

    if opd_day.is_active:
        return Response({"message": "OPD already started"})

    opd_day.started_at = now()
    opd_day.is_active = True
    opd_day.save()

    # Notify online-booked patients (tokens 16-35)
    online_bookings = Booking.objects.filter(
        doctor=doctor,
        booking_date=booking_date,
        token_number__gte=16,
        token_number__lte=35,
        payment_status="paid"
    )

    notified_count = 0
    for booking in online_bookings:
        patient = booking.patient
        if patient and patient.user.email:
            send_mail(
                subject=f"Your OPD session with Dr. {doctor.full_name} has started",
                message=(
                    f"Dear {patient.user.username},\n\n"
                    f"Your appointment token #{booking.token_number} is now active. "
                    "Consulting has officially started. Please check your token status."
                    "Thank you."
                ),
                from_email="no-reply@medqueue.com",
                recipient_list=[patient.user.email],
                fail_silently=True,
            )
            notified_count += 1

        # Set status to waiting
        booking.status = "waiting"
        booking.save()

    return Response({
        "message": f"OPD started for Dr. {doctor.full_name}. {notified_count} patients notified."
    }, status=status.HTTP_200_OK)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def approve_booking(request, booking_id):
    """
    Approve a waiting booking -> move to consulting
    """
    try:
        booking = Booking.objects.get(id=booking_id, status="waiting")
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found or already processed"}, status=404)

    booking.status = "consulting"
    booking.consulting_started_at = now()
    booking.save()

    # Optionally send approval email
    if booking.patient:
        send_mail(
            subject=f"Your token {booking.token_number} is approved",
            message=f"Dear {booking.patient.user.username}, your token {booking.token_number} is now approved for consulting.",
            from_email="no-reply@medqueue.com",
            recipient_list=[booking.patient.user.email],
            fail_silently=True,
        )

    return Response({"message": f"Booking {booking.token_number} approved"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reject_booking(request, booking_id):
    """
    Reject a waiting booking -> delete or mark canceled
    """
    try:
        booking = Booking.objects.get(id=booking_id, status="waiting")
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found or already processed"}, status=404)

    booking.delete()
    return Response({"message": "Booking rejected and removed"})

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils.timezone import now
from .models import Patient, Booking

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def patient_token_status(request):

    try:
        patient = Patient.objects.get(user=request.user)
    except Patient.DoesNotExist:
        return Response({"error": "Not a patient account"}, status=403)

    today = now().date()

    booking = Booking.objects.filter(
        patient=patient,
        booking_date=today
    ).order_by("-created_at").first()

    if not booking:
        return Response({"error": "No active booking today"}, status=404)

    # 🔹 Current consulting token
    current = Booking.objects.filter(
        doctor=booking.doctor,
        booking_date=today,
        status="consulting"
    ).first()

    current_token = current.token_number if current else 0

    # 🔹 Count tokens ahead
    tokens_ahead_count = Booking.objects.filter(
        doctor=booking.doctor,
        booking_date=today,
        token_number__lt=booking.token_number,
        status__in=["waiting", "consulting"]
    ).count()

    AVERAGE_TIME_PER_PATIENT = 7
    estimated_wait = tokens_ahead_count * AVERAGE_TIME_PER_PATIENT

    return Response({
        "booking_id": booking.id,  # 🔥🔥 THIS WAS MISSING
        "my_token": booking.token_number,
        "current_token": current_token,
        "tokens_ahead": tokens_ahead_count,
        "estimated_wait_minutes": estimated_wait,
        "status": booking.status
    })

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def patient_approve_booking(request, booking_id):

    try:
        patient = Patient.objects.get(user=request.user)
        booking = Booking.objects.get(id=booking_id, patient=patient)
    except (Patient.DoesNotExist, Booking.DoesNotExist):
        return Response({"error": "Invalid booking"}, status=404)

    if booking.status != "pending":
        return Response({"error": "Booking already processed"}, status=400)

    booking.status = "approved"
    booking.save()

    return Response({
        "message": "Token approved successfully",
        "token_number": booking.token_number
    })

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def patient_reject_booking(request, booking_id):

    try:
        patient = Patient.objects.get(user=request.user)
        booking = Booking.objects.get(id=booking_id, patient=patient)
    except (Patient.DoesNotExist, Booking.DoesNotExist):
        return Response({"error": "Invalid booking"}, status=404)

    if booking.status != "pending":
        return Response({"error": "Cannot reject processed booking"}, status=400)

    booking.delete()

    return Response({
        "message": "Booking rejected and deleted successfully"
    })

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def cancel_booking(request):

    try:
        patient = Patient.objects.get(user=request.user)

        booking = Booking.objects.get(
            patient=patient,
            status__in=["approved", "pending"]
        )

    except (Patient.DoesNotExist, Booking.DoesNotExist):
        return Response({"error": "No active booking found"}, status=404)

    booking.delete()

    return Response({"message": "Booking cancelled successfully"})