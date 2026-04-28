"""
MedQueue Booking Views
======================
Features:
  - Per-session OPD: OPDDay keyed by (doctor, date, session)
  - Bookings allowed for today / tomorrow / day-after-tomorrow
  - Pre-confirm attendance 30 min before OPD starts
  - Pre-confirmed patients auto-join on-time queue when OPD starts
  - 2-tokens-ahead email + in-app notification
  - OPD pause / resume by doctor (blocks next_token while paused)
  - Late-confirmed patient status with queue position & wait estimate
  - Wait time returned as hours + minutes (e.g. "1h 30m")
  - Doctor LEAVE feature — managed by OPD STAFF, freezes bookings
  - Doctor PRESCRIPTION — save diagnosis + medicines per consultation
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils.dateparse import parse_date
from django.utils.timezone import now, localtime
from django.core.mail import send_mail
from datetime import timedelta, time as dt_time
from django.db.models import Q

from .models import (
    District, Hospital, Department,
    Booking, OPDDay, OPDSession,
    BookingStatus, PaymentStatus,
    ONLINE_RANGE, WALKIN_RANGE,
    MAX_TOKENS_PER_SESSION, ONLINE_TOKEN_START, ONLINE_TOKEN_END,
    Prescription,                           # [NEW]
)
try:
    from .models import DoctorLeave
except ImportError:
    DoctorLeave = None  # migration not yet applied

from .serializers import (
    DistrictSerializer, HospitalSerializer, DepartmentSerializer,
    DoctorListSerializer, BookingSerializer, WalkinBookingSerializer,
    BookingDetailSerializer, BookingHistorySerializer, PatientTokenStatusSerializer,
    PrescriptionSerializer,                 # [NEW]
    ONLINE_BOOKING_CUTOFF,
)
from .utils import (
    send_opd_ticket_email,
    send_reminder_email,
    compute_queue_position,
    get_doctor_or_403,
    get_patient_or_403,
    get_opdstaff_or_403,
)
from accounts.models import Patient, Doctor


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_allowed_booking_dates():
    today = now().date()
    return {
        "today"             : today,
        "tomorrow"          : today + timedelta(days=1),
        "day_after_tomorrow": today + timedelta(days=2),
    }

def is_allowed_booking_date(d):
    return d in get_allowed_booking_dates().values()

SESSION_START_TIMES = {
    "morning": dt_time(10, 0),
    "evening": dt_time(14, 0),
}


# ── Staff permission check ────────────────────────────────────────────────────

def _ensure_staff(user):
    staff, err = get_opdstaff_or_403(user)
    if err:
        return False, err
    return True, None


# ── Hours + minutes formatter ─────────────────────────────────────────────────

def format_wait_time(total_minutes):
    """90 → {'hours':1,'minutes':30,'total_minutes':90,'display':'1h 30m'}"""
    if total_minutes is None:
        return None
    try:
        total = int(round(float(total_minutes)))
    except (TypeError, ValueError):
        return None
    if total < 0:
        total = 0

    hours   = total // 60
    minutes = total %  60

    if hours == 0:
        display = f"{minutes}m"
    elif minutes == 0:
        display = f"{hours}h"
    else:
        display = f"{hours}h {minutes}m"

    return {"hours": hours, "minutes": minutes, "total_minutes": total, "display": display}


# ── Doctor-leave lookup helper ────────────────────────────────────────────────

def _is_doctor_on_leave(doctor, booking_date, session):
    """Returns (on_leave: bool, reason: str|None)."""
    if DoctorLeave is None:
        return False, None
    leave = DoctorLeave.objects.filter(
        doctor=doctor, date=booking_date, is_active=True,
    ).filter(Q(session=session) | Q(session="all")).first()
    if leave:
        return True, leave.reason
    return False, None


# ── Shared queue-builder ──────────────────────────────────────────────────────

def _build_ordered_queue(all_qs, opd_day, current_token_num=0):
    late_cutoff   = opd_day.started_at + timedelta(minutes=10)
    waiting       = all_qs.filter(status=BookingStatus.WAITING)

    main_queue_qs = waiting.filter(
        Q(token_number__in=WALKIN_RANGE) |
        Q(token_number__range=(ONLINE_TOKEN_START, ONLINE_TOKEN_END),
          is_confirmed=True, confirmation_time__lte=late_cutoff) |
        Q(token_number__range=(ONLINE_TOKEN_START, ONLINE_TOKEN_END),
          is_confirmed=True, confirmation_time__gt=late_cutoff,
          token_number__gte=current_token_num)
    ).order_by("token_number")

    late_missed_qs = waiting.filter(
        token_number__range=(ONLINE_TOKEN_START, ONLINE_TOKEN_END),
        is_confirmed=True, confirmation_time__gt=late_cutoff,
        token_number__lt=current_token_num,
    ).order_by("token_number")

    main_list = list(main_queue_qs)
    for i, lb in enumerate(late_missed_qs):
        main_list.insert(min(5, len(main_list)) + i, lb)
    return main_list


def _notify_two_ahead(remaining_queue):
    if len(remaining_queue) < 2:
        return
    target = remaining_queue[1]
    if target.is_walkin or not target.patient or not target.patient.user.email:
        return
    if getattr(target, "two_ahead_notified", False):
        return
    send_mail(
        subject=f"[MedQueue] Almost your turn – Token #{target.token_number}",
        message=(
            f"Dear {target.display_name},\n\n"
            f"Only 2 patients are ahead of you in Dr. {target.doctor.full_name}'s "
            f"{target.session.capitalize()} OPD.\n\n"
            f"Your Token : #{target.token_number}\n"
            f"Date       : {target.booking_date}\n\n"
            "Please make your way to the consultation room now so you don't miss your turn.\n\n"
            "– MedQueue Team"
        ),
        from_email="no-reply@medqueue.com",
        recipient_list=[target.patient.user.email],
        fail_silently=True,
    )
    Booking.objects.filter(pk=target.pk).update(two_ahead_notified=True)


def _resolve_confirmed_type(booking, opd_day):
    if not booking.is_confirmed:
        return None
    if opd_day is None or booking.confirmation_time is None:
        return "pre_confirmed"
    late_cutoff = opd_day.started_at + timedelta(minutes=10)
    if booking.confirmation_time <= opd_day.started_at:
        return "pre_confirmed"
    if booking.confirmation_time <= late_cutoff:
        return "on_time"
    return "late"


# ═══════════════════════════════════════════════════════
# 1. PUBLIC / LOOKUP
# ═══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([AllowAny])
def district_list(request):
    return Response(DistrictSerializer(District.objects.all(), many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def hospital_list(request):
    district_id = request.GET.get("district_id")
    if not district_id:
        return Response({"error": "district_id is required"}, status=400)
    return Response(HospitalSerializer(Hospital.objects.filter(district_id=district_id), many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def department_list(request):
    hospital_id = request.GET.get("hospital_id")
    if not hospital_id:
        return Response({"error": "hospital_id is required"}, status=400)
    return Response(DepartmentSerializer(Department.objects.filter(hospital_id=hospital_id), many=True).data)


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
    doctors = Doctor.objects.filter(department_id=department_id, is_approved=True).select_related("hospital", "department")
    return Response(DoctorListSerializer(doctors, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def approved_doctors(request):
    qs = Doctor.objects.filter(is_approved=True).select_related("hospital", "department")
    if request.GET.get("hospital_id"):
        qs = qs.filter(hospital_id=request.GET["hospital_id"])
    if request.GET.get("department_id"):
        qs = qs.filter(department_id=request.GET["department_id"])
    return Response(DoctorListSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def available_booking_dates(request):
    dates = get_allowed_booking_dates()
    return Response([
        {"date": str(dates["today"]),              "label": "Today",              "value": "today"},
        {"date": str(dates["tomorrow"]),            "label": "Tomorrow",           "value": "tomorrow"},
        {"date": str(dates["day_after_tomorrow"]),  "label": "Day After Tomorrow", "value": "day_after_tomorrow"},
    ])


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

    if not is_allowed_booking_date(booking_date):
        return Response({"error": "Bookings only allowed for today, tomorrow, or day after tomorrow."}, status=400)

    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or not approved."}, status=404)

    on_leave, leave_reason = _is_doctor_on_leave(doctor, booking_date, session)
    if on_leave:
        return Response({
            "error"        : f"Dr. {doctor.full_name} is on leave for the {session} session on {booking_date}.",
            "on_leave"     : True,
            "leave_reason" : leave_reason,
            "doctor"       : {"id": doctor.id, "name": doctor.full_name},
            "date"         : booking_date,
            "session"      : session,
        }, status=400)

    is_today     = booking_date == now().date()
    booking_open = localtime().time() < ONLINE_BOOKING_CUTOFF.get(session, dt_time(23, 59)) if is_today else True

    bookings         = Booking.objects.filter(doctor=doctor, session=session, booking_date=booking_date)
    booked_tokens    = list(bookings.values_list("token_number", flat=True))
    booked_online    = [t for t in booked_tokens if t in ONLINE_RANGE]
    booked_walkin    = [t for t in booked_tokens if t in WALKIN_RANGE]
    available_walkin = [t for t in WALKIN_RANGE if t not in booked_walkin]
    available_online = len(ONLINE_RANGE) - len(booked_online)

    freed_as_walkin = []
    if not booking_open:
        freed_as_walkin  = [t for t in ONLINE_RANGE if t not in booked_online]
        available_walkin = available_walkin + freed_as_walkin
        available_online = 0

    return Response({
        "doctor"                : {"id": doctor.id, "name": doctor.full_name, "hospital": doctor.hospital.name, "department": doctor.department.name},
        "date"                  : booking_date,
        "session"               : session,
        "booking_open"          : booking_open,
        "on_leave"              : False,
        "online_tokens"         : {"range": [ONLINE_TOKEN_START, ONLINE_TOKEN_END], "booked": booked_online, "available": available_online},
        "walkin_tokens"         : {"booked": booked_walkin, "available": available_walkin, "freed_from_online": freed_as_walkin},
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

    date_str     = request.data.get("booking_date") or request.data.get("date")
    booking_date = parse_date(str(date_str)) if date_str else None
    if not booking_date:
        return Response({"error": "booking_date is required."}, status=400)

    if not is_allowed_booking_date(booking_date):
        d = get_allowed_booking_dates()
        return Response({"error": f"Only today ({d['today']}), tomorrow ({d['tomorrow']}), or day after tomorrow ({d['day_after_tomorrow']}) are allowed."}, status=400)

    doctor_id = request.data.get("doctor_id") or request.data.get("doctor")
    session   = request.data.get("session")
    if doctor_id and session:
        try:
            doctor_obj = Doctor.objects.get(id=doctor_id, is_approved=True)
            on_leave, leave_reason = _is_doctor_on_leave(doctor_obj, booking_date, session)
            if on_leave:
                return Response({
                    "error"       : f"Dr. {doctor_obj.full_name} is on leave for the {session} session on {booking_date}. Booking is frozen.",
                    "on_leave"    : True,
                    "leave_reason": leave_reason,
                }, status=400)
        except Doctor.DoesNotExist:
            pass

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
    booking = (
        Booking.objects
        .filter(patient=patient, booking_date=today)
        .select_related("doctor")
        .order_by("-created_at")
        .first()
    )
    if not booking:
        return Response({"error": "No booking found for today."}, status=200)

    opd_started  = False
    opd_paused   = False
    pause_reason = None
    opd_day      = None

    try:
        opd_day      = OPDDay.objects.get(doctor=booking.doctor, date=today, session=booking.session)
        opd_started  = opd_day.is_active
        opd_paused   = getattr(opd_day, "is_paused",    False)
        pause_reason = getattr(opd_day, "pause_reason", None)
    except OPDDay.DoesNotExist:
        pass

    data = PatientTokenStatusSerializer(booking).data
    data["opd_started"]  = opd_started
    data["opd_paused"]   = opd_paused
    data["pause_reason"] = pause_reason

    on_leave, leave_reason = _is_doctor_on_leave(booking.doctor, today, booking.session)
    data["doctor_on_leave"] = on_leave
    data["leave_reason"]    = leave_reason

    confirmed_type         = _resolve_confirmed_type(booking, opd_day)
    data["confirmed_type"] = confirmed_type

    data["late_queue_position"]     = None
    data["late_tokens_ahead"]       = None
    data["late_estimated_wait_min"] = None
    data["late_estimated_wait"]     = None
    data["late_notice"]             = None

    if confirmed_type == "late" and booking.status == BookingStatus.WAITING and opd_day:
        current = Booking.objects.filter(
            doctor=booking.doctor, booking_date=today,
            session=booking.session, status=BookingStatus.CONSULTING,
        ).first()
        current_token_num = current.token_number if current else 0

        all_qs    = Booking.objects.filter(doctor=booking.doctor, booking_date=today, session=booking.session)
        ordered_q = _build_ordered_queue(all_qs, opd_day, current_token_num)
        token_ids = [b.pk for b in ordered_q]

        try:
            position       = token_ids.index(booking.pk) + 1
            tokens_ahead   = position - 1
            avg_min        = getattr(opd_day, "avg_consult_minutes", None) or 7
            estimated_wait = tokens_ahead * avg_min
        except ValueError:
            position = tokens_ahead = estimated_wait = None

        data["late_queue_position"]     = position
        data["late_tokens_ahead"]       = tokens_ahead
        data["late_estimated_wait_min"] = estimated_wait
        data["late_estimated_wait"]     = format_wait_time(estimated_wait)
        data["late_notice"] = (
            "You confirmed late. You have been placed after the first 5 patients "
            "in the main queue. Your current estimated position is shown above."
        )

    return Response(data)


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

    current_time = localtime()
    today        = now().date()

    # Scenario 1: Pre-OPD
    if booking.status == BookingStatus.PENDING:
        if booking.booking_date != today:
            return Response({"error": "Pre-confirmation is only available on the day of your appointment."}, status=400)

        session_start = SESSION_START_TIMES.get(booking.session)
        if not session_start:
            return Response({"error": "Unknown session."}, status=400)

        session_start_dt = current_time.replace(hour=session_start.hour, minute=session_start.minute, second=0, microsecond=0)
        window_open      = session_start_dt - timedelta(minutes=30)

        if not (window_open <= current_time <= session_start_dt):
            return Response({
                "error": (
                    f"Pre-confirmation is open from {window_open.strftime('%I:%M %p')} "
                    f"to {session_start_dt.strftime('%I:%M %p')} "
                    f"(30 minutes before OPD starts)."
                )
            }, status=400)

        booking.is_confirmed      = True
        booking.confirmation_time = now()
        booking.save()

        return Response({
            "message"       : "Pre-confirmation successful! You will be placed at the front of the queue when the OPD starts.",
            "token_number"  : booking.token_number,
            "confirmed_type": "pre_confirmed",
        })

    # Scenario 2 & 3: OPD active
    try:
        opd_day = OPDDay.objects.get(doctor=booking.doctor, date=booking.booking_date, session=booking.session)
    except OPDDay.DoesNotExist:
        return Response({"error": "OPD has not started yet."}, status=400)

    if not opd_day.is_active:
        return Response({"error": "OPD is not currently active."}, status=400)

    late_cutoff    = opd_day.started_at + timedelta(minutes=10)
    is_on_time     = now() <= late_cutoff
    confirmed_type = "on_time" if is_on_time else "late"

    booking.is_confirmed      = True
    booking.confirmation_time = now()
    booking.queue_insert_time = now()
    booking.save()

    position_info = compute_queue_position(booking)
    wait_minutes  = position_info["estimated_wait_minutes"]

    response_data = {
        "message"           : "Attendance confirmed! You have been added to the queue.",
        "token_number"      : booking.token_number,
        "queue_position"    : position_info["position"],
        "tokens_ahead"      : position_info["tokens_ahead"],
        "estimated_wait_min": wait_minutes,
        "estimated_wait"    : format_wait_time(wait_minutes),
        "confirmed_type"    : confirmed_type,
    }

    if not is_on_time:
        response_data["late_notice"] = (
            "You confirmed late. You have been placed after the first 5 patients "
            "in the current queue. Please proceed to the waiting area."
        )

    return Response(response_data)


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def patient_prescriptions(request):
    """
    Returns all prescriptions for the logged-in patient, newest first.
    """
    patient, err = get_patient_or_403(request.user)
    if err:
        return err

    prescriptions = (
        Prescription.objects
        .filter(booking__patient=patient)
        .select_related("booking__doctor__hospital", "booking__doctor__department")
        .order_by("-created_at")
    )
    return Response(PrescriptionSerializer(prescriptions, many=True).data)


# ═══════════════════════════════════════════════════════
# 3. DOCTOR APIs
# ═══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctor_dashboard(request):
    date_str     = request.GET.get("date", str(now().date()))
    booking_date = parse_date(date_str)
    if not booking_date:
        return Response({"error": "Invalid date."}, status=400)

    doctor, err = get_doctor_or_403(request.user)
    if err:
        return err

    opd_days = {row.session: row for row in OPDDay.objects.filter(doctor=doctor, date=booking_date)}

    opd_sessions_data = {}
    for sess in ["morning", "evening"]:
        day = opd_days.get(sess)
        on_leave, leave_reason = _is_doctor_on_leave(doctor, booking_date, sess)
        opd_sessions_data[sess] = {
            "is_active"   : day.is_active  if day else False,
            "started_at"  : day.started_at if day else None,
            "is_paused"   : getattr(day, "is_paused",    False) if day else False,
            "pause_reason": getattr(day, "pause_reason", None)  if day else None,
            "paused_at"   : getattr(day, "paused_at",    None)  if day else None,
            "on_leave"    : on_leave,
            "leave_reason": leave_reason,
        }

    morning_day = opd_days.get("morning")
    any_day     = morning_day or next(iter(opd_days.values()), None)

    qs      = Booking.objects.filter(doctor=doctor, booking_date=booking_date).select_related("patient__user").order_by("token_number")
    current = qs.filter(status=BookingStatus.CONSULTING).first()

    tokens = [{
        "id"                   : b.id,
        "token"                : b.token_number,
        "patient_name"         : b.display_name,
        "patient_type"         : "walkin" if b.is_walkin else "online",
        "session"              : b.session,
        "status"               : b.status,
        "is_confirmed"         : b.is_confirmed,
        "confirmation_time"    : b.confirmation_time,
        "queue_insert_time"    : b.queue_insert_time,
        "consulting_started_at": b.consulting_started_at,
        "confirmed_type"       : _resolve_confirmed_type(b, opd_days.get(b.session)),
        "two_ahead_notified"   : getattr(b, "two_ahead_notified", False),
        "has_prescription"     : Prescription.objects.filter(booking=b).exists(),  # [NEW]
    } for b in qs]

    avg_min = any_day.avg_consult_minutes if any_day else 7

    return Response({
        "opd_sessions"       : opd_sessions_data,
        "opd_started"        : morning_day.is_active  if morning_day else False,
        "started_at"         : morning_day.started_at if morning_day else None,
        "date"               : booking_date,
        "doctor"             : doctor.full_name,
        "avg_consult_minutes": avg_min,
        "avg_consult_time"   : format_wait_time(avg_min),
        "current_token"      : current.token_number if current else None,
        "current_patient"    : current.display_name if current else None,
        "total_tokens"       : qs.count(),
        "confirmed_in_queue" : qs.filter(status=BookingStatus.WAITING, is_confirmed=True).count(),
        "unconfirmed_count"  : qs.filter(status=BookingStatus.WAITING, is_confirmed=False).count(),
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
    if not session:
        return Response({"error": "session parameter is required."}, status=400)

    doctor, err = get_doctor_or_403(request.user)
    if err:
        return err

    try:
        opd_day = OPDDay.objects.get(doctor=doctor, date=booking_date, session=session)
    except OPDDay.DoesNotExist:
        return Response({"error": f"OPD has not been started for {session} session."}, status=400)

    if not opd_day.is_active:
        return Response({"error": f"{session.capitalize()} OPD is not currently active."}, status=400)

    if getattr(opd_day, "is_paused", False):
        return Response({
            "error"       : f"{session.capitalize()} OPD is currently paused. Resume before calling the next patient.",
            "pause_reason": getattr(opd_day, "pause_reason", None),
            "paused_at"   : getattr(opd_day, "paused_at",    None),
        }, status=400)

    all_qs = Booking.objects.select_for_update().filter(doctor=doctor, booking_date=booking_date, session=session)

    current = all_qs.filter(status=BookingStatus.CONSULTING).first()
    if current:
        # [NEW] Block "Next Token" if no prescription saved.
        # Pass force=true in body to bypass (e.g. patient walked out).
        force  = str(request.data.get("force", "")).lower() in ("1", "true", "yes")
        has_rx = Prescription.objects.filter(booking=current).exists()
        if not has_rx and not force:
            return Response({
                "error"              : "Please add diagnosis & prescription before calling the next patient.",
                "needs_prescription" : True,
                "current_booking_id" : current.id,
                "current_token"      : current.token_number,
                "current_patient"    : current.display_name,
            }, status=400)

        current.status              = BookingStatus.DONE
        current.consulting_ended_at = now()
        current.save()
        _update_avg_consult_time(doctor, booking_date, session)

    current_token_num = current.token_number if current else 0

    all_qs.filter(token_number__in=WALKIN_RANGE, status=BookingStatus.WAITING, is_confirmed=False).update(
        is_confirmed=True, confirmation_time=now(), queue_insert_time=now(),
    )

    ordered_queue = _build_ordered_queue(all_qs, opd_day, current_token_num)

    unconfirmed_q = all_qs.filter(
        status=BookingStatus.WAITING,
        token_number__range=(ONLINE_TOKEN_START, ONLINE_TOKEN_END),
        is_confirmed=False,
    ).order_by("token_number")

    if not ordered_queue:
        if unconfirmed_q.exists():
            return Response({
                "message"          : "No confirmed patients in queue.",
                "unconfirmed_count": unconfirmed_q.count(),
                "hint"             : "Use Confirm or Skip on unconfirmed patients.",
                "done_token"       : current.token_number if current else None,
            })
        return Response({"message": "No patients in queue.", "done_token": current.token_number if current else None})

    nxt                       = ordered_queue[0]
    nxt.status                = BookingStatus.CONSULTING
    nxt.consulting_started_at = now()
    nxt.save()

    _notify_two_ahead(ordered_queue[1:])

    return Response({
        "message"      : f"Now consulting Token #{nxt.token_number}",
        "done_token"   : current.token_number if current else None,
        "next_token"   : nxt.token_number,
        "patient"      : nxt.display_name,
        "patient_type" : "walkin" if nxt.is_walkin else "online",
        "still_waiting": all_qs.filter(status=BookingStatus.WAITING, is_confirmed=True).count(),
    })


# ── pause / resume ────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def pause_opd(request):
    date_str  = request.data.get("date", str(now().date()))
    session   = request.data.get("session")
    reason    = (request.data.get("reason") or "").strip() or None
    doctor_id = request.data.get("doctor_id")

    if not session or session not in ["morning", "evening"]:
        return Response({"error": "session must be 'morning' or 'evening'."}, status=400)

    if doctor_id:
        ok, staff_err = _ensure_staff(request.user)
        if not ok:
            return staff_err
        try:
            doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
        except Doctor.DoesNotExist:
            return Response({"error": "Doctor not found or not approved."}, status=404)
    else:
        doctor, err = get_doctor_or_403(request.user)
        if err:
            return err

    try:
        opd_day = OPDDay.objects.get(doctor=doctor, date=parse_date(date_str), session=session, is_active=True)
    except OPDDay.DoesNotExist:
        return Response({"error": f"No active {session} OPD found for this date."}, status=404)

    if getattr(opd_day, "is_paused", False):
        return Response({"error": f"{session.capitalize()} OPD is already paused."}, status=400)

    opd_day.is_paused    = True
    opd_day.paused_at    = now()
    opd_day.pause_reason = reason
    opd_day.save(update_fields=["is_paused", "paused_at", "pause_reason"])

    return Response({
        "message"     : f"{session.capitalize()} OPD paused.",
        "session"     : session,
        "paused_at"   : opd_day.paused_at,
        "pause_reason": reason,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def resume_opd(request):
    date_str  = request.data.get("date", str(now().date()))
    session   = request.data.get("session")
    doctor_id = request.data.get("doctor_id")

    if not session or session not in ["morning", "evening"]:
        return Response({"error": "session must be 'morning' or 'evening'."}, status=400)

    if doctor_id:
        ok, staff_err = _ensure_staff(request.user)
        if not ok:
            return staff_err
        try:
            doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
        except Doctor.DoesNotExist:
            return Response({"error": "Doctor not found or not approved."}, status=404)
    else:
        doctor, err = get_doctor_or_403(request.user)
        if err:
            return err

    try:
        opd_day = OPDDay.objects.get(doctor=doctor, date=parse_date(date_str), session=session, is_active=True)
    except OPDDay.DoesNotExist:
        return Response({"error": f"No active {session} OPD found for this date."}, status=404)

    if not getattr(opd_day, "is_paused", False):
        return Response({"error": f"{session.capitalize()} OPD is not paused."}, status=400)

    opd_day.is_paused    = False
    opd_day.paused_at    = None
    opd_day.pause_reason = None
    opd_day.save(update_fields=["is_paused", "paused_at", "pause_reason"])

    return Response({
        "message"   : f"{session.capitalize()} OPD resumed.",
        "session"   : session,
        "resumed_at": now(),
    })


# ═══════════════════════════════════════════════════════
# DOCTOR — PRESCRIPTION MANAGEMENT
# ═══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def doctor_save_prescription(request, booking_id):
    """
    Doctor saves diagnosis + prescription for a booking.
    Called from the diagnosis modal in DoctorDashboard, typically right before
    pressing "Done" / "Next Token".

    Body:
    {
      "diagnosis" : "Acute viral fever",
      "medicines" : "1. Paracetamol 500mg - 1-1-1 x 5 days\n2. ORS sachets - prn"
    }

    Creates or updates the Prescription row (one-to-one with Booking).
    Does NOT change booking status — the doctor still has to press Next Token
    to mark the consultation as DONE.
    """
    doctor, err = get_doctor_or_403(request.user)
    if err:
        return err

    try:
        booking = Booking.objects.select_related("patient__user").get(
            id=booking_id, doctor=doctor
        )
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)

    if booking.status not in [BookingStatus.CONSULTING, BookingStatus.DONE]:
        return Response({
            "error": (
                f"Cannot add prescription for a booking with status "
                f"'{booking.status}'. Patient must be consulting or done."
            )
        }, status=400)

    diagnosis = (request.data.get("diagnosis") or "").strip()
    medicines = (request.data.get("medicines") or "").strip()

    if not diagnosis and not medicines:
        return Response(
            {"error": "Please provide at least a diagnosis or prescription."},
            status=400,
        )

    rx, _created = Prescription.objects.update_or_create(
        booking=booking,
        defaults={"diagnosis": diagnosis, "medicines": medicines},
    )

    return Response({
        "message"      : "Prescription saved successfully.",
        "booking_id"   : booking.id,
        "token_number" : booking.token_number,
        "patient_name" : booking.display_name,
        "prescription" : PrescriptionSerializer(rx).data,
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctor_get_prescription(request, booking_id):
    """
    Doctor fetches the prescription for a booking (for editing in the modal).
    Returns 200 with empty fields if no prescription exists yet.
    """
    doctor, err = get_doctor_or_403(request.user)
    if err:
        return err

    try:
        booking = Booking.objects.get(id=booking_id, doctor=doctor)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)

    rx = Prescription.objects.filter(booking=booking).first()
    return Response({
        "booking_id"  : booking.id,
        "token_number": booking.token_number,
        "patient_name": booking.display_name,
        "diagnosis"   : rx.diagnosis if rx else "",
        "medicines"   : rx.medicines if rx else "",
        "exists"      : bool(rx),
    })


# ═══════════════════════════════════════════════════════
# OPD STAFF — DOCTOR LEAVE MANAGEMENT
# ═══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def staff_apply_leave(request):
    """
    OPD STAFF applies leave for a DOCTOR on a specific date + session.

    Body:
    {
      "doctor_id": <int>,
      "date"     : "YYYY-MM-DD",
      "session"  : "morning" | "evening" | "all",
      "reason"   : "optional text"
    }

    Effects:
      • DoctorLeave row created with is_active=True, applied_by=request.user.
      • fetch_tokens / book_token / book_walkin_token refuse new bookings for this slot.
      • start_opd refuses to start OPD for this slot.
      • Existing PENDING/WAITING bookings are cancelled (status=SKIPPED)
        and patients are notified by email.
    """
    if DoctorLeave is None:
        return Response({"error": "DoctorLeave model is not installed. Run the migration first."}, status=500)

    ok, err = _ensure_staff(request.user)
    if not ok:
        return err

    doctor_id = request.data.get("doctor_id")
    date_str  = request.data.get("date")
    session   = (request.data.get("session") or "all").lower()
    reason    = (request.data.get("reason") or "").strip() or None

    if not doctor_id:
        return Response({"error": "doctor_id is required."}, status=400)
    if session not in ["morning", "evening", "all"]:
        return Response({"error": "session must be 'morning', 'evening', or 'all'."}, status=400)

    leave_date = parse_date(str(date_str)) if date_str else None
    if not leave_date:
        return Response({"error": "Valid date is required."}, status=400)

    if not is_allowed_booking_date(leave_date):
        return Response({
            "error": "Leave can only be applied for today, tomorrow, or the day after tomorrow."
        }, status=400)

    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or not approved."}, status=404)

    active_opd_qs = OPDDay.objects.filter(doctor=doctor, date=leave_date, is_active=True)
    if session != "all":
        active_opd_qs = active_opd_qs.filter(session=session)

    if active_opd_qs.exists():
        return Response({
            "error": (
                f"Dr. {doctor.full_name} has an active OPD running for this slot. "
                "End the OPD first before applying leave."
            )
        }, status=400)

    if DoctorLeave.objects.filter(
        doctor=doctor, date=leave_date, session=session, is_active=True
    ).exists():
        return Response({"error": "Leave is already active for this slot."}, status=400)

    if session == "all":
        DoctorLeave.objects.filter(
            doctor=doctor, date=leave_date, is_active=True
        ).update(is_active=False, cancelled_by=request.user, cancelled_at=now())

    leave = DoctorLeave.objects.create(
        doctor=doctor, date=leave_date, session=session,
        reason=reason, is_active=True, applied_by=request.user,
    )

    sessions_to_clear = ["morning", "evening"] if session == "all" else [session]
    affected = Booking.objects.filter(
        doctor=doctor,
        booking_date=leave_date,
        session__in=sessions_to_clear,
        status__in=[BookingStatus.PENDING, BookingStatus.WAITING],
    ).select_related("patient__user")

    notified = 0
    for b in affected:
        if b.patient and b.patient.user.email:
            send_mail(
                subject=f"[MedQueue] OPD Cancelled – Dr. {doctor.full_name} is on leave",
                message=(
                    f"Dear {b.display_name},\n\n"
                    f"Unfortunately Dr. {doctor.full_name} is on leave for the "
                    f"{b.session.capitalize()} session on {leave_date}.\n"
                    f"Your Token #{b.token_number} has been cancelled.\n\n"
                    + (f"Reason: {reason}\n\n" if reason else "")
                    + "Please rebook on another date via MedQueue.\n\n– MedQueue Team"
                ),
                from_email="no-reply@medqueue.com",
                recipient_list=[b.patient.user.email],
                fail_silently=True,
            )
            notified += 1

    cancelled_count = affected.count()
    affected.update(status=BookingStatus.SKIPPED)

    return Response({
        "message"           : f"Leave applied for Dr. {doctor.full_name} on {leave_date} ({session}).",
        "leave_id"          : leave.id,
        "doctor_id"         : doctor.id,
        "doctor_name"       : doctor.full_name,
        "date"              : leave_date,
        "session"           : session,
        "reason"            : reason,
        "cancelled_bookings": cancelled_count,
        "notified"          : notified,
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def staff_cancel_leave(request):
    """
    OPD STAFF cancels a previously-applied leave.
    Cancelled bookings are NOT auto-restored (patients must rebook),
    but new bookings are accepted for the slot again.

    Body: { "doctor_id": <int>, "date": "YYYY-MM-DD", "session": "morning"|"evening"|"all" }
    """
    if DoctorLeave is None:
        return Response({"error": "DoctorLeave model is not installed."}, status=500)

    ok, err = _ensure_staff(request.user)
    if not ok:
        return err

    doctor_id = request.data.get("doctor_id")
    date_str  = request.data.get("date")
    session   = (request.data.get("session") or "all").lower()

    if not doctor_id:
        return Response({"error": "doctor_id is required."}, status=400)
    if session not in ["morning", "evening", "all"]:
        return Response({"error": "session must be 'morning', 'evening', or 'all'."}, status=400)

    leave_date = parse_date(str(date_str)) if date_str else None
    if not leave_date:
        return Response({"error": "Valid date is required."}, status=400)

    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found."}, status=404)

    try:
        leave = DoctorLeave.objects.get(
            doctor=doctor, date=leave_date, session=session, is_active=True
        )
    except DoctorLeave.DoesNotExist:
        return Response({"error": "No active leave found for this slot."}, status=404)

    leave.is_active    = False
    leave.cancelled_by = request.user
    leave.cancelled_at = now()
    leave.save(update_fields=["is_active", "cancelled_by", "cancelled_at"])

    return Response({
        "message"    : f"Leave for Dr. {doctor.full_name} on {leave_date} ({session}) has been cancelled. Bookings are open again.",
        "doctor_id"  : doctor.id,
        "doctor_name": doctor.full_name,
        "date"       : leave_date,
        "session"    : session,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_list_leaves(request):
    """
    OPD STAFF views all active/upcoming leaves.
    Optional filters: ?doctor_id=<int>&date=YYYY-MM-DD&include_past=1
    """
    if DoctorLeave is None:
        return Response([])

    ok, err = _ensure_staff(request.user)
    if not ok:
        return err

    qs = DoctorLeave.objects.filter(is_active=True).select_related("doctor", "applied_by")

    if request.GET.get("doctor_id"):
        qs = qs.filter(doctor_id=request.GET["doctor_id"])
    if request.GET.get("date"):
        d = parse_date(request.GET["date"])
        if d:
            qs = qs.filter(date=d)
    if not request.GET.get("include_past"):
        qs = qs.filter(date__gte=now().date())

    qs = qs.order_by("date", "session")

    return Response([{
        "id"         : l.id,
        "doctor_id"  : l.doctor_id,
        "doctor_name": l.doctor.full_name,
        "hospital"   : l.doctor.hospital.name   if l.doctor.hospital   else "—",
        "department" : l.doctor.department.name if l.doctor.department else "—",
        "date"       : l.date,
        "session"    : l.session,
        "reason"     : l.reason,
        "applied_by" : l.applied_by.username if l.applied_by else None,
        "created_at" : l.created_at,
    } for l in qs])


# ═══════════════════════════════════════════════════════
# OPD LIFECYCLE
# ═══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def start_opd(request):
    date_str     = request.data.get("date", str(now().date()))
    session      = request.data.get("session")
    doctor_id    = request.data.get("doctor_id")
    booking_date = parse_date(date_str)

    if not booking_date:
        return Response({"error": "Invalid date."}, status=400)
    if not session or session not in ["morning", "evening"]:
        return Response({"error": "session must be 'morning' or 'evening'."}, status=400)

    if doctor_id:
        try:
            doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
        except Doctor.DoesNotExist:
            return Response({"error": "Doctor not found or not approved."}, status=404)
    else:
        doctor, err = get_doctor_or_403(request.user)
        if err:
            return err

    on_leave, leave_reason = _is_doctor_on_leave(doctor, booking_date, session)
    if on_leave:
        return Response({
            "error"       : f"Dr. {doctor.full_name} is on leave for the {session} session on {booking_date}. Cancel the leave first.",
            "leave_reason": leave_reason,
        }, status=400)

    opd_day, _ = OPDDay.objects.get_or_create(doctor=doctor, date=booking_date, session=session)
    if opd_day.is_active:
        return Response({"message": f"{session.capitalize()} OPD is already active.", "started_at": opd_day.started_at, "session": session})

    opd_day.started_at   = now()
    opd_day.is_active    = True
    opd_day.is_paused    = False
    opd_day.paused_at    = None
    opd_day.pause_reason = None
    opd_day.save()
    started_at = opd_day.started_at

    online_base = Booking.objects.filter(
        doctor=doctor, booking_date=booking_date, session=session,
        token_number__gte=ONLINE_TOKEN_START, token_number__lte=ONLINE_TOKEN_END,
        payment_status=PaymentStatus.PAID,
        status=BookingStatus.PENDING,
    )

    pre_confirmed_qs    = online_base.filter(is_confirmed=True)
    pre_confirmed_count = pre_confirmed_qs.count()
    pre_confirmed_qs.update(status=BookingStatus.WAITING, queue_insert_time=started_at)

    unconfirmed_qs  = online_base.filter(is_confirmed=False)
    unconfirmed_ids = list(unconfirmed_qs.values_list("id", flat=True))
    unconfirmed_qs.update(status=BookingStatus.WAITING)

    notified = 0
    for b in Booking.objects.filter(id__in=unconfirmed_ids).select_related("patient__user"):
        if b.patient and b.patient.user.email:
            send_mail(
                subject=f"[MedQueue] OPD Started – Token #{b.token_number} | Dr. {doctor.full_name}",
                message=(
                    f"Dear {b.display_name},\n\n"
                    f"Dr. {doctor.full_name}'s {session.capitalize()} OPD has started.\n"
                    f"Token : #{b.token_number}\n"
                    f"Date  : {booking_date}\n\n"
                    "Please log in to MedQueue and CONFIRM your attendance to join the queue.\n\n"
                    "– MedQueue Team"
                ),
                from_email="no-reply@medqueue.com",
                recipient_list=[b.patient.user.email],
                fail_silently=True,
            )
            notified += 1

    Booking.objects.filter(
        doctor=doctor, booking_date=booking_date, session=session,
        token_number__in=WALKIN_RANGE, status=BookingStatus.PENDING,
    ).update(
        status=BookingStatus.WAITING,
        is_confirmed=True,
        confirmation_time=started_at,
        queue_insert_time=started_at,
    )

    return Response({
        "message"      : (
            f"{session.capitalize()} OPD started. "
            f"{pre_confirmed_count} pre-confirmed in queue, "
            f"{notified} unconfirmed notified."
        ),
        "session"      : session,
        "started_at"   : started_at,
        "pre_confirmed": pre_confirmed_count,
        "notified"     : notified,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def skip_token(request, booking_id):
    doctor, err = get_doctor_or_403(request.user)
    try:
        booking = Booking.objects.get(id=booking_id) if err else Booking.objects.get(id=booking_id, doctor=doctor)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)
    booking.status = BookingStatus.SKIPPED
    booking.save()
    return Response({"message": f"Token #{booking.token_number} skipped."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def end_opd(request):
    date_str = request.data.get("date", str(now().date()))
    session  = request.data.get("session")
    if not session or session not in ["morning", "evening"]:
        return Response({"error": "session must be 'morning' or 'evening'."}, status=400)
    doctor, err = get_doctor_or_403(request.user)
    if err:
        return err
    try:
        opd_day = OPDDay.objects.get(doctor=doctor, date=parse_date(date_str), session=session, is_active=True)
    except OPDDay.DoesNotExist:
        return Response({"error": f"No active {session} OPD found for this date."}, status=404)
    opd_day.is_active    = False
    opd_day.ended_at     = now()
    opd_day.is_paused    = False
    opd_day.paused_at    = None
    opd_day.pause_reason = None
    opd_day.save()
    return Response({"message": f"{session.capitalize()} OPD ended successfully.", "session": session, "ended_at": opd_day.ended_at})


# ═══════════════════════════════════════════════════════
# 4. OPD STAFF / ADMIN APIs
# ═══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def book_walkin_token(request):
    doctor_id    = request.data.get("doctor_id") or request.data.get("doctor")
    session      = request.data.get("session")
    booking_date = parse_date(str(request.data.get("booking_date") or request.data.get("date") or now().date()))

    if doctor_id and session and booking_date:
        try:
            doctor_obj = Doctor.objects.get(id=doctor_id, is_approved=True)
            on_leave, leave_reason = _is_doctor_on_leave(doctor_obj, booking_date, session)
            if on_leave:
                return Response({
                    "error"       : f"Dr. {doctor_obj.full_name} is on leave for {session} on {booking_date}. Walk-in booking is frozen.",
                    "on_leave"    : True,
                    "leave_reason": leave_reason,
                }, status=400)
        except Doctor.DoesNotExist:
            pass

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
    doctor_id, session, booking_date = request.GET.get("doctor_id"), request.GET.get("session"), request.GET.get("booking_date")
    if not all([doctor_id, session, booking_date]):
        return Response({"error": "doctor_id, session, and booking_date are required."}, status=400)
    bookings = Booking.objects.filter(doctor_id=doctor_id, session=session, booking_date=booking_date).select_related("patient__user", "doctor__hospital", "doctor__department").order_by("token_number")
    return Response(BookingDetailSerializer(bookings, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def opd_dashboard(request):
    date_str     = request.GET.get("date")
    booking_date = parse_date(date_str) if date_str else now().date()
    doctors      = Doctor.objects.filter(is_approved=True).select_related("hospital", "department")
    opd_day_map  = {(od.doctor_id, od.session): od for od in OPDDay.objects.filter(date=booking_date, doctor__in=doctors)}

    data = []
    for doctor in doctors:
        opd_status = {}
        for sess in ["morning", "evening"]:
            od = opd_day_map.get((doctor.id, sess))
            on_leave, leave_reason = _is_doctor_on_leave(doctor, booking_date, sess)
            opd_status[sess] = {
                "is_active"   : od.is_active  if od else False,
                "started_at"  : od.started_at if od else None,
                "is_paused"   : getattr(od, "is_paused",    False) if od else False,
                "pause_reason": getattr(od, "pause_reason", None)  if od else None,
                "on_leave"    : on_leave,
                "leave_reason": leave_reason,
            }

        bookings = Booking.objects.filter(doctor=doctor, booking_date=booking_date).order_by("token_number")
        sessions = {
            "morning": {"online": [], "walkin": [], "available_walkin": list(WALKIN_RANGE), "total_booked": 0},
            "evening": {"online": [], "walkin": [], "available_walkin": list(WALKIN_RANGE), "total_booked": 0},
        }
        for b in bookings:
            entry = {"id": b.id, "token": b.token_number, "patient_name": b.display_name, "status": b.status, "is_confirmed": b.is_confirmed, "payment": b.payment_status, "type": "walkin" if b.is_walkin else "online"}
            if b.is_walkin:
                sessions[b.session]["walkin"].append(entry)
                if b.token_number in sessions[b.session]["available_walkin"]:
                    sessions[b.session]["available_walkin"].remove(b.token_number)
            else:
                sessions[b.session]["online"].append(entry)
            sessions[b.session]["total_booked"] += 1

        data.append({"doctor_id": doctor.id, "doctor_name": doctor.full_name, "hospital": doctor.hospital.name, "department": doctor.department.name, "opd_status": opd_status, "date": booking_date, "sessions": sessions})

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
        send_mail(subject=f"[MedQueue] Token #{booking.token_number} – Now Consulting", message=f"Dear {booking.display_name}, token #{booking.token_number} is now being called.", from_email="no-reply@medqueue.com", recipient_list=[booking.patient.user.email], fail_silently=True)
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
    doctor_id, date_str = request.GET.get("doctor_id"), request.GET.get("date")
    if not doctor_id or not date_str:
        return Response({"error": "doctor_id and date are required."}, status=400)
    booking_date = parse_date(date_str)
    if not booking_date:
        return Response({"error": "Invalid date format."}, status=400)
    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found."}, status=404)
    bookings = Booking.objects.filter(doctor=doctor, booking_date=booking_date).select_related("patient__user").order_by("session", "token_number")
    sessions = {}
    for b in bookings:
        sessions.setdefault(b.session, []).append({"id": b.id, "token": b.token_number, "patient_name": b.display_name, "type": "walkin" if b.is_walkin else "online", "status": b.status, "is_confirmed": b.is_confirmed, "payment": b.payment_status})
    return Response({"doctor": DoctorListSerializer(doctor).data, "date": booking_date, "sessions": sessions})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pending_doctors(request):
    doctors = Doctor.objects.filter(is_approved=False).select_related("user", "hospital", "department")
    return Response([{"id": d.id, "name": d.full_name or d.user.get_full_name() or d.user.username, "email": d.user.email, "hospital": d.hospital.name if d.hospital else "—", "department": d.department.name if d.department else "—", "joined": d.user.date_joined} for d in doctors])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_doctor(request, doctor_id):
    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=False)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or already approved."}, status=404)
    doctor.is_approved = True
    doctor.save()
    send_mail(subject="[MedQueue] Your registration has been approved", message=f"Dear Dr. {doctor.full_name},\n\nYour MedQueue registration has been approved. You can now log in and manage your OPD sessions.\n\n– MedQueue Team", from_email="no-reply@medqueue.com", recipient_list=[doctor.user.email], fail_silently=True)
    return Response({"message": f"Dr. {doctor.full_name} approved successfully."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_doctor(request, doctor_id):
    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=False)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found or already approved."}, status=404)
    name = doctor.full_name
    doctor.user.delete()
    return Response({"message": f"Dr. {name}'s registration rejected and removed."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def consultation_history(request):
    date_str, doctor_id, type_filter = request.GET.get("date"), request.GET.get("doctor_id"), request.GET.get("type")
    qs = Booking.objects.filter(status=BookingStatus.DONE).select_related("patient__user", "doctor__hospital", "doctor__department").order_by("-booking_date", "session", "token_number")
    if date_str:
        bd = parse_date(date_str)
        if bd:
            qs = qs.filter(booking_date=bd)
    if doctor_id:
        qs = qs.filter(doctor_id=doctor_id)
    if type_filter == "online":
        qs = qs.filter(token_number__range=(ONLINE_TOKEN_START, ONLINE_TOKEN_END))
    elif type_filter == "walkin":
        qs = qs.filter(token_number__in=WALKIN_RANGE)
    data = []
    for b in qs:
        if b.is_walkin:
            pi = {"name": b.walkin_name or "Walk-in", "type": "walkin", "email": "—", "phone": "—"}
        else:
            pi = {"name": b.display_name, "type": "online", "email": b.patient.user.email if b.patient else "—", "phone": getattr(b.patient.user, "phone", "—") if b.patient else "—"}

        duration_min = b.consulting_duration_minutes
        data.append({
            "id": b.id, "token": b.token_number,
            "patient": pi, "patient_name": b.display_name, "patient_type": pi["type"],
            "patient_email": pi["email"],
            "doctor_name": b.doctor.full_name, "hospital": b.doctor.hospital.name, "department": b.doctor.department.name,
            "session": b.session, "booking_date": b.booking_date,
            "consulting_started_at": b.consulting_started_at,
            "consulting_ended_at"  : b.consulting_ended_at,
            "duration_minutes"     : duration_min,
            "duration"             : format_wait_time(duration_min),
            "payment_status"       : b.payment_status,
        })
    return Response(data)


# ═══════════════════════════════════════════════════════
# 5. REAL-TIME STATUS
# ═══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([AllowAny])
def queue_status(request):
    doctor_id, session = request.GET.get("doctor_id"), request.GET.get("session")
    booking_date = parse_date(request.GET.get("date", str(now().date())))
    if not all([doctor_id, session]):
        return Response({"error": "doctor_id and session are required."}, status=400)
    try:
        doctor = Doctor.objects.get(id=doctor_id, is_approved=True)
    except Doctor.DoesNotExist:
        return Response({"error": "Doctor not found."}, status=404)

    on_leave, leave_reason = _is_doctor_on_leave(doctor, booking_date, session)

    try:
        opd_day = OPDDay.objects.get(doctor=doctor, date=booking_date, session=session)
    except OPDDay.DoesNotExist:
        return Response({
            "opd_active"   : False,
            "opd_paused"   : False,
            "on_leave"     : on_leave,
            "leave_reason" : leave_reason,
            "current_token": None,
            "queue_length" : 0,
        })

    current       = Booking.objects.filter(doctor=doctor, session=session, booking_date=booking_date, status=BookingStatus.CONSULTING).first()
    waiting_count = Booking.objects.filter(doctor=doctor, session=session, booking_date=booking_date, status=BookingStatus.WAITING, is_confirmed=True).count()
    done_count    = Booking.objects.filter(doctor=doctor, session=session, booking_date=booking_date, status=BookingStatus.DONE).count()

    avg_min            = opd_day.avg_consult_minutes
    queue_wait_minutes = waiting_count * (avg_min or 7)

    return Response({
        "opd_active"          : opd_day.is_active,
        "started_at"          : opd_day.started_at,
        "opd_paused"          : getattr(opd_day, "is_paused",    False),
        "pause_reason"        : getattr(opd_day, "pause_reason", None),
        "paused_at"           : getattr(opd_day, "paused_at",    None),
        "on_leave"            : on_leave,
        "leave_reason"        : leave_reason,
        "current_token"       : current.token_number if current else None,
        "current_patient"     : current.display_name if current else None,
        "current_patient_type": "walkin" if current and current.is_walkin else "online" if current else None,
        "queue_length"        : waiting_count,
        "done_count"          : done_count,
        "avg_consult_minutes" : avg_min,
        "avg_consult_time"    : format_wait_time(avg_min),
        "queue_estimated_wait": format_wait_time(queue_wait_minutes),
        "server_time"         : now().isoformat(),
    })


# ═══════════════════════════════════════════════════════
# PRIVATE HELPERS
# ═══════════════════════════════════════════════════════

def _update_avg_consult_time(doctor, booking_date, session):
    done = list(Booking.objects.filter(
        doctor=doctor, booking_date=booking_date, session=session,
        status=BookingStatus.DONE,
        consulting_started_at__isnull=False,
        consulting_ended_at__isnull=False,
    ).order_by("consulting_ended_at"))
    durations = [b.consulting_duration_minutes for b in done if b.consulting_duration_minutes and b.consulting_duration_minutes > 0]
    n = len(durations)
    if n == 0:
        return
    if n == 1:
        avg = durations[0]
    elif n == 2:
        avg = sum(durations) / 2
    else:
        recent = durations[-3:]
        older  = durations[:-3]
        avg    = (sum(recent) / len(recent) * 0.7) + (sum(older) / len(older) * 0.3 if older else 0)
    OPDDay.objects.filter(doctor=doctor, date=booking_date, session=session).update(avg_consult_minutes=max(1, round(avg)))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_opd_notification(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)
    if not booking.patient or not booking.patient.user.email:
        return Response({"error": "No email address for this patient."}, status=400)
    try:
        opd_day = OPDDay.objects.get(doctor=booking.doctor, date=booking.booking_date, session=booking.session)
    except OPDDay.DoesNotExist:
        return Response({"error": "OPD has not started for this doctor/session."}, status=400)
    if not opd_day.is_active:
        return Response({"error": "OPD is not currently active."}, status=400)
    send_mail(
        subject=f"[MedQueue] Reminder — OPD Started | Token #{booking.token_number}",
        message=(
            f"Dear {booking.display_name},\n\n"
            f"Dr. {booking.doctor.full_name}'s {booking.session.capitalize()} OPD has started.\n"
            f"Token: #{booking.token_number} | Date: {booking.booking_date}\n\n"
            "Please log in to MedQueue and CONFIRM your attendance to join the queue.\n\n"
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
    try:
        booking = Booking.objects.select_for_update().get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({"error": "Booking not found."}, status=404)
    if booking.is_confirmed:
        return Response({"error": "Patient is already confirmed."}, status=400)
    if booking.status not in [BookingStatus.PENDING, BookingStatus.WAITING]:
        return Response({"error": f"Cannot confirm booking with status '{booking.status}'."}, status=400)
    try:
        opd_day = OPDDay.objects.get(doctor=booking.doctor, date=booking.booking_date, session=booking.session)
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
        "message"      : f"Token #{booking.token_number} confirmed.",
        "token_number" : booking.token_number,
        "patient_name" : booking.display_name,
        "patient_type" : "walkin" if booking.is_walkin else "online",
    })
