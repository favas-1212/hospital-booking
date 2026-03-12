"""
MedQueue Booking Views
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils.dateparse import parse_date
from django.utils.timezone import now, localtime
from django.core.mail import send_mail
from datetime import timedelta
from django.db.models import Q

from .models import (
    District, Hospital, Department,
    Booking, OPDDay, OPDSession,
    BookingStatus, PaymentStatus,
    ONLINE_RANGE, WALKIN_RANGE,
    MAX_TOKENS_PER_SESSION, ONLINE_TOKEN_START, ONLINE_TOKEN_END,
)
from .serializers import (
    DistrictSerializer, HospitalSerializer, DepartmentSerializer,
    DoctorListSerializer, BookingSerializer, WalkinBookingSerializer,
    BookingDetailSerializer, BookingHistorySerializer, PatientTokenStatusSerializer,
)
from .utils import (
    send_opd_ticket_email,
    send_reminder_email,
    compute_queue_position,
    get_doctor_or_403,
    get_patient_or_403,
)
from accounts.models import Patient, Doctor


# ═══════════════════════════════════════════════════════
# 1. PUBLIC / LOOKUP APIs
# ═══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([AllowAny])
def district_list(request):
    districts = District.objects.all()
    return Response(DistrictSerializer(districts, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def hospital_list(request):
    district_id = request.GET.get("district_id")
    if not district_id:
        return Response({"error": "district_id is required"}, status=400)
    hospitals = Hospital.objects.filter(district_id=district_id)
    return Response(HospitalSerializer(hospitals, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def department_list(request):
    hospital_id = request.GET.get("hospital_id")
    if not hospital_id:
        return Response({"error": "hospital_id is required"}, status=400)
    departments = Department.objects.filter(hospital_id=hospital_id)
    return Response(DepartmentSerializer(departments, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def opd_sessions(request):
    return Response([{"value": s[0], "label": s[1]} for s in OPDSession.choices])


@api_view(["GET"])
@permission_classes([AllowAny])
def doctors_by_department(request):
    department_id = request.GET.get("department_id")
    if not department_id:
        return Response({"error": "department_id is required"}, status=400)
    doctors = Doctor.objects.filter(
        department_id=department_id, is_approved=True
    ).select_related("hospital", "department")
    return Response(DoctorListSerializer(doctors, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def approved_doctors(request):
    qs = Doctor.objects.filter(is_approved=True).select_related("hospital", "department")
    hospital_id   = request.GET.get("hospital_id")
    department_id = request.GET.get("department_id")
    if hospital_id:
        qs = qs.filter(hospital_id=hospital_id)
    if department_id:
        qs = qs.filter(department_id=department_id)
    return Response(DoctorListSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def fetch_tokens(request):
    doctor_id = request.GET.get("doctor_id")
    session   = request.GET.get("session")
    date_str  = request.GET.get("date")

    if not all([doctor_id, session, date_str]):
        return Response({"error": "doctor_id, session, and date are required"}, status=400)

    booking_date = parse_date(date_str)
    if not booking_date:
        return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=400)

    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or not approved."}, status=404)

    bookings      = Booking.objects.filter(doctor=doctor, session=session, booking_date=booking_date)
    booked_tokens = list(bookings.values_list("token_number", flat=True))

    booked_online    = [t for t in booked_tokens if t in ONLINE_RANGE]
    booked_walkin    = [t for t in booked_tokens if t in WALKIN_RANGE]
    available_walkin = [t for t in WALKIN_RANGE if t not in booked_walkin]
    available_online = len(ONLINE_RANGE) - len(booked_online)

    from datetime import time
    cutoffs      = {"morning": time(8, 0), "evening": time(13, 0)}
    current_time = localtime().time()
    is_today     = booking_date == now().date()
    booking_open = not (is_today and current_time >= cutoffs.get(session, time(23, 59)))

    return Response({
        "doctor": {
            "id": doctor.id, "name": doctor.full_name,
            "hospital": doctor.hospital.name, "department": doctor.department.name,
        },
        "date": booking_date, "session": session, "booking_open": booking_open,
        "online_tokens": {
            "range": [ONLINE_TOKEN_START, ONLINE_TOKEN_END],
            "booked": booked_online, "available": available_online,
        },
        "walkin_tokens": {"booked": booked_walkin, "available": available_walkin},
        "max_tokens_per_session": MAX_TOKENS_PER_SESSION,
    })


# ═══════════════════════════════════════════════════════
# 2. PATIENT APIs
# ═══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def book_token(request):
    patient, err = get_patient_or_403(request.user)
    if err:
        return err

    serializer = BookingSerializer(data=request.data, context={"request": request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    booking = serializer.save()

    from .tasks import send_ticket_email_task
    send_ticket_email_task.delay(booking.id)

    return Response(BookingDetailSerializer(booking).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def booking_history(request):
    patient, err = get_patient_or_403(request.user)
    if err:
        return err
    bookings = Booking.objects.filter(patient=patient).order_by("-created_at")
    return Response(BookingHistorySerializer(bookings, many=True).data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def cancel_booking(request, booking_id):
    patient, err = get_patient_or_403(request.user)
    if err:
        return err

    try:
        booking = Booking.objects.get(id=booking_id, patient=patient)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)

    if booking.status in [BookingStatus.CONSULTING, BookingStatus.DONE]:
        return Response({"error": "Cannot cancel a booking already in progress or completed."}, status=400)

    booking.delete()
    return Response({"message": "Booking cancelled successfully."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def patient_token_status(request):
    patient, err = get_patient_or_403(request.user)
    if err:
        return err

    today   = now().date()
    booking = Booking.objects.filter(
        patient=patient, booking_date=today,
    ).select_related("doctor").order_by("-created_at").first()

    if not booking:
        return Response({"error": "No booking found for today."}, status=200)

    try:
        opd_day = OPDDay.objects.get(doctor=booking.doctor, date=today)
    except OPDDay.DoesNotExist:
        return Response({"error": "OPD has not started yet for your doctor."}, status=200)

    if not opd_day.is_active:
        return Response({"error": "OPD has not started yet."}, status=200)

    return Response(PatientTokenStatusSerializer(booking).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def patient_confirm_attendance(request, booking_id):
    patient, err = get_patient_or_403(request.user)
    if err:
        return err

    try:
        booking = Booking.objects.select_for_update().get(id=booking_id, patient=patient)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)

    if booking.is_confirmed:
        return Response({"error": "You have already confirmed your attendance."}, status=400)

    if booking.status not in [BookingStatus.PENDING, BookingStatus.WAITING]:
        return Response({"error": f"Cannot confirm a booking with status '{booking.status}'."}, status=400)

    try:
        opd_day = OPDDay.objects.get(doctor=booking.doctor, date=booking.booking_date)
    except OPDDay.DoesNotExist:
        return Response({"error": "OPD has not started yet."}, status=400)

    if not opd_day.is_active:
        return Response({"error": "OPD is not currently active."}, status=400)

    position_info = compute_queue_position(booking)

    booking.is_confirmed      = True
    booking.confirmation_time = now()
    booking.queue_insert_time = now()
    booking.status            = BookingStatus.WAITING
    booking.save()

    return Response({
        "message"       : "Attendance confirmed! You have been added to the queue.",
        "token_number"  : booking.token_number,
        "queue_position": position_info["position"],
        "tokens_ahead"  : position_info["tokens_ahead"],
        "estimated_wait": position_info["estimated_wait_minutes"],
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def patient_reject_booking(request, booking_id):
    patient, err = get_patient_or_403(request.user)
    if err:
        return err

    try:
        booking = Booking.objects.get(id=booking_id, patient=patient)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)

    if booking.status not in [BookingStatus.PENDING, BookingStatus.WAITING]:
        return Response({"error": "Cannot reject a booking already in progress."}, status=400)

    booking.delete()
    return Response({"message": "Booking rejected and removed."})


# ═══════════════════════════════════════════════════════
# 3. DOCTOR APIs
# ═══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctor_dashboard(request):
    date_str       = request.GET.get("date", str(now().date()))
    session_filter = request.GET.get("session")
    booking_date   = parse_date(date_str)

    if not booking_date:
        return Response({"error": "Invalid date."}, status=400)

    doctor, err = get_doctor_or_403(request.user)
    if err:
        return err

    try:
        opd_day = OPDDay.objects.get(doctor=doctor, date=booking_date)
    except OPDDay.DoesNotExist:
        return Response({
            "opd_started": False,
            "message"    : "OPD has not been started yet.",
            "date"       : booking_date,
        })

    qs = Booking.objects.filter(
        doctor=doctor, booking_date=booking_date
    ).select_related("patient__user").order_by("token_number")

    if session_filter:
        qs = qs.filter(session=session_filter)

    current = qs.filter(status=BookingStatus.CONSULTING).first()

    tokens = []
    for b in qs:
        tokens.append({
            "id"                   : b.id,
            "token"                : b.token_number,
            "patient_name"         : b.display_name,
            "type"                 : "online" if b.token_number in ONLINE_RANGE else "walkin",
            "session"              : b.session,
            "status"               : b.status,
            "is_confirmed"         : b.is_confirmed,
            "confirmation_time"    : b.confirmation_time,
            "queue_insert_time"    : b.queue_insert_time,
            "consulting_started_at": b.consulting_started_at,
        })

    return Response({
        "opd_started"        : True,
        "date"               : booking_date,
        "doctor"             : doctor.full_name,
        "started_at"         : opd_day.started_at,
        "avg_consult_minutes": opd_day.avg_consult_minutes,
        "current_token"      : current.token_number if current else None,
        "total_tokens"       : qs.count(),
        "tokens"             : tokens,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def doctor_next_token(request):
    date_str     = request.GET.get("date", str(now().date()))
    session      = request.GET.get("session")
    booking_date = parse_date(date_str)

    if not booking_date:
        return Response({"error": "Invalid date."}, status=400)

    doctor, err = get_doctor_or_403(request.user)
    if err:
        return err

    try:
        opd_day = OPDDay.objects.get(doctor=doctor, date=booking_date)
    except OPDDay.DoesNotExist:
        return Response({"error": "OPD has not been started."}, status=400)

    late_cutoff = opd_day.started_at + timedelta(minutes=10)

    # ── All bookings queryset ────────────────────────────
    all_qs = Booking.objects.select_for_update().filter(
        doctor=doctor, booking_date=booking_date
    )
    if session:
        all_qs = all_qs.filter(session=session)

    # ── Mark current as DONE ─────────────────────────────
    current    = all_qs.filter(status=BookingStatus.CONSULTING).first()
    tokens_done = all_qs.filter(status=BookingStatus.DONE).count()

    if current:
        current.status              = BookingStatus.DONE
        current.consulting_ended_at = now()
        current.save()
        tokens_done += 1
        _update_avg_consult_time(doctor, booking_date)

    # ── Waiting queryset ─────────────────────────────────
    waiting = all_qs.filter(status=BookingStatus.WAITING)

    # 1. MAIN QUEUE — walk-ins (by token#) + early online confirmers (by token#)
    walkin_ids       = list(waiting.filter(
        token_number__in=WALKIN_RANGE
    ).values_list("id", flat=True))

    early_online_ids = list(waiting.filter(
        token_number__range=(ONLINE_TOKEN_START, ONLINE_TOKEN_END),
        is_confirmed=True,
        confirmation_time__lte=late_cutoff,
    ).values_list("id", flat=True))

    main_queue = waiting.filter(
        id__in=walkin_ids + early_online_ids
    ).order_by("token_number")

    # 2. LATE QUEUE — online confirmed after 10 mins (by confirmation time)
    late_queue = waiting.filter(
        token_number__range=(ONLINE_TOKEN_START, ONLINE_TOKEN_END),
        is_confirmed=True,
        confirmation_time__gt=late_cutoff,
    ).order_by("confirmation_time")

    # 3. UNCONFIRMED — online not yet confirmed (fallback only)
    unconfirmed_q = waiting.filter(
        token_number__range=(ONLINE_TOKEN_START, ONLINE_TOKEN_END),
        is_confirmed=False,
    ).order_by("token_number")

    # ── Pick next ────────────────────────────────────────
    insert_late_now = (
        late_queue.exists()
        and tokens_done > 0
        and tokens_done % 5 == 0
    )

    next_booking = None

    if insert_late_now:
        next_booking = late_queue.first()
    elif main_queue.exists():
        next_booking = main_queue.first()
    elif late_queue.exists():
        next_booking = late_queue.first()
    elif unconfirmed_q.exists():
        next_booking = unconfirmed_q.first()
        next_booking.is_confirmed      = True
        next_booking.confirmation_time = now()
        next_booking.queue_insert_time = now()
    else:
        return Response({
            "message"   : "No patients in queue.",
            "done_token": current.token_number if current else None,
        })

    next_booking.status                = BookingStatus.CONSULTING
    next_booking.consulting_started_at = now()
    next_booking.save()

    return Response({
        "message"   : f"Now consulting Token #{next_booking.token_number}",
        "done_token": current.token_number if current else None,
        "next_token": next_booking.token_number,
        "patient"   : next_booking.display_name,
    })

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def start_opd(request):
    """
    Start OPD.
    - Doctor calls without doctor_id (uses own account).
    - OPD Staff calls with doctor_id in body.
    Body: { "date": "YYYY-MM-DD", "doctor_id": <int> (optional for staff) }
    """
    date_str     = request.data.get("date", str(now().date()))
    doctor_id    = request.data.get("doctor_id")
    booking_date = parse_date(date_str)

    if not booking_date:
        return Response({"error": "Invalid date."}, status=400)

    # Staff passes doctor_id; doctor uses own account
    if doctor_id:
        try:
            doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
        except Doctor.DoesNotExist:
            return Response({"error": "Doctor not found or not approved."}, status=404)
    else:
        doctor, err = get_doctor_or_403(request.user)
        if err:
            return err

    opd_day, created = OPDDay.objects.get_or_create(doctor=doctor, date=booking_date)
    if opd_day.is_active:
        return Response({"message": "OPD is already active.", "started_at": opd_day.started_at})

    opd_day.started_at = now()
    opd_day.is_active  = True
    opd_day.save()

    online_bookings = Booking.objects.filter(
        doctor=doctor,
        booking_date=booking_date,
        token_number__gte=ONLINE_TOKEN_START,
        token_number__lte=ONLINE_TOKEN_END,
        payment_status=PaymentStatus.PAID,
    )

    notified = 0
    for b in online_bookings:
        if b.patient and b.patient.user.email:
            send_mail(
                subject=f"[MedQueue] OPD Started – Dr. {doctor.full_name} | Token #{b.token_number}",
                message=(
                    f"Dear {b.display_name},\n\n"
                    f"Dr. {doctor.full_name}'s OPD has started.\n"
                    f"Your Token: #{b.token_number}\n"
                    f"Date: {booking_date}\n\n"
                    "Please log in to MedQueue and CONFIRM your attendance to join the active queue.\n\n"
                    "– MedQueue Team"
                ),
                from_email="no-reply@medqueue.com",
                recipient_list=[b.patient.user.email],
                fail_silently=True,
            )
            notified += 1
        b.status = BookingStatus.WAITING
        b.save()

    return Response({
        "message"        : f"OPD started. {notified} patient(s) notified.",
        "started_at"     : opd_day.started_at,
        "online_bookings": online_bookings.count(),
    })




@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def skip_token(request, booking_id):
    doctor, err = get_doctor_or_403(request.user)
    if err:
        return err

    try:
        booking = Booking.objects.get(id=booking_id, doctor=doctor)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)

    booking.status = BookingStatus.SKIPPED
    booking.save()
    return Response({"message": f"Token #{booking.token_number} skipped."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def end_opd(request):
    date_str     = request.data.get("date", str(now().date()))
    booking_date = parse_date(date_str)

    doctor, err = get_doctor_or_403(request.user)
    if err:
        return err

    try:
        opd_day = OPDDay.objects.get(doctor=doctor, date=booking_date, is_active=True)
    except OPDDay.DoesNotExist:
        return Response({"error": "No active OPD found for this date."}, status=404)

    opd_day.is_active = False
    opd_day.ended_at  = now()
    opd_day.save()

    return Response({"message": "OPD ended successfully.", "ended_at": opd_day.ended_at})


# ═══════════════════════════════════════════════════════
# 4. OPD STAFF / ADMIN APIs
# ═══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def book_walkin_token(request):
    serializer = WalkinBookingSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    booking = serializer.save()
    return Response({
        "message"     : f"Walk-in token #{booking.token_number} booked successfully.",
        "token_number": booking.token_number,
        "patient_name": booking.walkin_name,
        "id"          : booking.id,
        "session"     : booking.session,
        "date"        : booking.booking_date,
    }, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tokens_by_date(request):
    doctor_id    = request.GET.get("doctor_id")
    session      = request.GET.get("session")
    booking_date = request.GET.get("booking_date")

    if not all([doctor_id, session, booking_date]):
        return Response({"error": "doctor_id, session, and booking_date are required."}, status=400)

    bookings = Booking.objects.filter(
        doctor_id=doctor_id, session=session, booking_date=booking_date,
    ).select_related("patient__user", "doctor__hospital", "doctor__department").order_by("token_number")

    return Response(BookingDetailSerializer(bookings, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def opd_dashboard(request):
    date_str     = request.GET.get("date")
    booking_date = parse_date(date_str) if date_str else now().date()

    doctors = Doctor.objects.filter(is_approved=True).select_related("hospital", "department")
    data    = []

    for doctor in doctors:
        try:
            opd_day    = OPDDay.objects.get(doctor=doctor, date=booking_date)
            opd_status = {"is_active": opd_day.is_active, "started_at": opd_day.started_at}
        except OPDDay.DoesNotExist:
            opd_status = {"is_active": False, "started_at": None}

        bookings = Booking.objects.filter(
            doctor=doctor, booking_date=booking_date
        ).order_by("token_number")

        # Always initialize BOTH sessions
        sessions = {
            "morning": {"online": [], "walkin": [], "available_walkin": list(WALKIN_RANGE), "total_booked": 0},
            "evening": {"online": [], "walkin": [], "available_walkin": list(WALKIN_RANGE), "total_booked": 0},
        }

        for b in bookings:
            sess  = b.session
            entry = {
                "id"          : b.id,
                "token"       : b.token_number,
                "patient_name": b.display_name,
                "status"      : b.status,
                "is_confirmed": b.is_confirmed,
                "payment"     : b.payment_status,
                "type"        : "online" if b.token_number in ONLINE_RANGE else "walkin",
            }
            if b.token_number in ONLINE_RANGE:
                sessions[sess]["online"].append(entry)
            else:
                sessions[sess]["walkin"].append(entry)
                if b.token_number in sessions[sess]["available_walkin"]:
                    sessions[sess]["available_walkin"].remove(b.token_number)
            sessions[sess]["total_booked"] += 1

        data.append({
            "doctor_id" : doctor.id,
            "doctor_name": doctor.full_name,
            "hospital"  : doctor.hospital.name,
            "department": doctor.department.name,
            "opd_status": opd_status,
            "date"      : booking_date,
            "sessions"  : sessions,
        })

    return Response(data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def approve_booking(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)

    if booking.status != BookingStatus.WAITING:
        return Response({"error": f"Booking is '{booking.status}', cannot approve."}, status=400)

    booking.status                = BookingStatus.CONSULTING
    booking.consulting_started_at = now()
    booking.save()

    if booking.patient and booking.patient.user.email:
        send_mail(
            subject=f"[MedQueue] Token #{booking.token_number} – Now Consulting",
            message=f"Dear {booking.display_name}, your token #{booking.token_number} is now being called.",
            from_email="no-reply@medqueue.com",
            recipient_list=[booking.patient.user.email],
            fail_silently=True,
        )

    return Response({"message": f"Token #{booking.token_number} approved for consulting."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reject_booking(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id, status=BookingStatus.WAITING)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found or not in waiting status."}, status=404)

    booking.delete()
    return Response({"message": "Booking rejected and removed."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctor_tokens_by_date(request):
    doctor_id = request.GET.get("doctor_id")
    date_str  = request.GET.get("date")

    if not doctor_id or not date_str:
        return Response({"error": "doctor_id and date are required."}, status=400)

    booking_date = parse_date(date_str)
    if not booking_date:
        return Response({"error": "Invalid date format."}, status=400)

    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found."}, status=404)

    bookings = Booking.objects.filter(
        doctor=doctor, booking_date=booking_date
    ).select_related("patient__user").order_by("session", "token_number")

    sessions = {}
    for b in bookings:
        if b.session not in sessions:
            sessions[b.session] = []
        sessions[b.session].append({
            "id": b.id, "token": b.token_number,
            "patient_name": b.display_name,
            "type": "online" if b.is_online else "walkin",
            "status": b.status, "is_confirmed": b.is_confirmed,
            "payment": b.payment_status,
        })

    return Response({
        "doctor": DoctorListSerializer(doctor).data,
        "date": booking_date, "sessions": sessions,
    })


# ── NEW: Doctor Registration Approval ───────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pending_doctors(request):
    """List all unapproved doctor registrations."""
    doctors = Doctor.objects.filter(is_approved=False).select_related(
        "user", "hospital", "department"
    )
    data = []
    for d in doctors:
        data.append({
            "id"        : d.id,
            "name"      : d.full_name or d.user.get_full_name() or d.user.username,
            "email"     : d.user.email,
            "hospital"  : d.hospital.name  if d.hospital   else "—",
            "department": d.department.name if d.department else "—",
            "joined"    : d.user.date_joined,
        })
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_doctor(request, doctor_id):
    """Approve a pending doctor registration."""
    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=False)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or already approved."}, status=404)

    doctor.is_approved = True
    doctor.save()

    send_mail(
        subject="[MedQueue] Your registration has been approved",
        message=(
            f"Dear Dr. {doctor.full_name},\n\n"
            "Your MedQueue doctor registration has been approved.\n"
            "You can now log in and start managing your OPD sessions.\n\n"
            "– MedQueue Team"
        ),
        from_email="no-reply@medqueue.com",
        recipient_list=[doctor.user.email],
        fail_silently=True,
    )
    return Response({"message": f"Dr. {doctor.full_name} approved successfully."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_doctor(request, doctor_id):
    """Reject and remove a pending doctor registration."""
    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=False)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or already approved."}, status=404)

    name = doctor.full_name
    doctor.user.delete()  # cascades to Doctor record
    return Response({"message": f"Dr. {name}'s registration rejected and removed."})


# ── NEW: Consultation History ────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def consultation_history(request):
    date_str  = request.GET.get("date")
    doctor_id = request.GET.get("doctor_id")

    qs = Booking.objects.filter(
        status=BookingStatus.DONE,
    ).select_related(
        "patient__user", "doctor__hospital", "doctor__department"
    ).order_by("-booking_date", "session", "token_number")

    if date_str:
        bd = parse_date(date_str)
        if bd:
            qs = qs.filter(booking_date=bd)
    # No date filter = return ALL history

    if doctor_id:
        qs = qs.filter(doctor_id=doctor_id)

    data = []
    for b in qs:
        data.append({
            "id"                   : b.id,
            "token"                : b.token_number,
            "patient_name"         : b.display_name,
            "doctor_name"          : b.doctor.full_name,
            "hospital"             : b.doctor.hospital.name,
            "department"           : b.doctor.department.name,
            "session"              : b.session,
            "booking_date"         : b.booking_date,
            "consulting_started_at": b.consulting_started_at,
            "consulting_ended_at"  : b.consulting_ended_at,
            "duration_minutes"     : b.consulting_duration_minutes,
            "payment_status"       : b.payment_status,
            "type"                 : "online" if b.token_number in ONLINE_RANGE else "walkin",
        })
    return Response(data)


# ═══════════════════════════════════════════════════════
# 5. REAL-TIME STATUS API
# ═══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([AllowAny])
def queue_status(request):
    doctor_id    = request.GET.get("doctor_id")
    session      = request.GET.get("session")
    date_str     = request.GET.get("date", str(now().date()))
    booking_date = parse_date(date_str)

    if not all([doctor_id, session]):
        return Response({"error": "doctor_id and session are required."}, status=400)

    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found."}, status=404)

    try:
        opd_day = OPDDay.objects.get(doctor=doctor, date=booking_date)
    except OPDDay.DoesNotExist:
        return Response({"opd_active": False, "current_token": None, "queue_length": 0})

    current = Booking.objects.filter(
        doctor=doctor, session=session, booking_date=booking_date,
        status=BookingStatus.CONSULTING,
    ).first()

    waiting_count = Booking.objects.filter(
        doctor=doctor, session=session, booking_date=booking_date,
        status=BookingStatus.WAITING, is_confirmed=True,
    ).count()

    done_count = Booking.objects.filter(
        doctor=doctor, session=session, booking_date=booking_date,
        status=BookingStatus.DONE,
    ).count()

    return Response({
        "opd_active"         : opd_day.is_active,
        "started_at"         : opd_day.started_at,
        "current_token"      : current.token_number if current else None,
        "current_patient"    : current.display_name if current else None,
        "queue_length"       : waiting_count,
        "done_count"         : done_count,
        "avg_consult_minutes": opd_day.avg_consult_minutes,
        "server_time"        : now().isoformat(),
    })


# ═══════════════════════════════════════════════════════
# PRIVATE HELPERS
# ═══════════════════════════════════════════════════════

def _update_avg_consult_time(doctor, booking_date):
    done_bookings = Booking.objects.filter(
        doctor=doctor, booking_date=booking_date,
        status=BookingStatus.DONE,
        consulting_started_at__isnull=False,
        consulting_ended_at__isnull=False,
    )
    if done_bookings.count() >= 3:
        total_minutes = sum(
            b.consulting_duration_minutes for b in done_bookings
            if b.consulting_duration_minutes is not None
        )
        avg = total_minutes / done_bookings.count()
        OPDDay.objects.filter(doctor=doctor, date=booking_date).update(
            avg_consult_minutes=max(1, round(avg))
        )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_opd_notification(request, booking_id):
    """Staff resends OPD start notification email to a specific patient."""
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)

    if not booking.patient or not booking.patient.user.email:
        return Response({"error": "No email address for this patient."}, status=400)

    try:
        opd_day = OPDDay.objects.get(doctor=booking.doctor, date=booking.booking_date)
    except OPDDay.DoesNotExist:
        return Response({"error": "OPD has not started for this doctor."}, status=400)

    if not opd_day.is_active:
        return Response({"error": "OPD is not currently active."}, status=400)

    send_mail(
        subject=f"[MedQueue] Reminder — OPD Started | Token #{booking.token_number}",
        message=(
            f"Dear {booking.display_name},\n\n"
            f"This is a reminder that Dr. {booking.doctor.full_name}'s OPD has started.\n"
            f"Your Token: #{booking.token_number}\n"
            f"Date: {booking.booking_date}\n\n"
            "Please log in to MedQueue and CONFIRM your attendance to join the active queue.\n\n"
            "– MedQueue Team"
        ),
        from_email="no-reply@medqueue.com",
        recipient_list=[booking.patient.user.email],
        fail_silently=False,
    )

    return Response({"message": f"Notification resent to {booking.patient.user.email}"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def staff_confirm_attendance(request, booking_id):
    """Staff manually confirms attendance for a patient."""
    try:
        booking = Booking.objects.select_for_update().get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)

    if booking.is_confirmed:
        return Response({"error": "Patient is already confirmed."}, status=400)

    if booking.status not in [BookingStatus.PENDING, BookingStatus.WAITING]:
        return Response({"error": f"Cannot confirm booking with status '{booking.status}'."}, status=400)

    try:
        opd_day = OPDDay.objects.get(doctor=booking.doctor, date=booking.booking_date)
    except OPDDay.DoesNotExist:
        return Response({"error": "OPD has not started."}, status=400)

    if not opd_day.is_active:
        return Response({"error": "OPD is not currently active."}, status=400)

    booking.is_confirmed      = True
    booking.confirmation_time = now()
    booking.queue_insert_time = now()
    booking.status            = BookingStatus.WAITING
    booking.save()

    return Response({
        "message"     : f"Token #{booking.token_number} confirmed.",
        "token_number": booking.token_number,
        "patient_name": booking.display_name,
    })