"""
MedQueue Booking Utilities
==========================
Shared helper functions used across views, tasks, and serializers.
"""

import logging

from django.conf import settings
from django.core.mail import EmailMessage, send_mail
from django.utils.timezone import now
from rest_framework.response import Response

from accounts.models import Patient, Doctor, OPDStaff   # [NEW] OPDStaff for staff auth
from .models import Booking, OPDDay, BookingStatus

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# AUTH HELPERS
# ─────────────────────────────────────────────

def get_patient_or_403(user):
    """
    Returns (patient, None) on success.
    Returns (None, Response 403) if user is not a patient.
    """
    try:
        return Patient.objects.select_related("user").get(user=user), None
    except Patient.DoesNotExist:
        return None, Response(
            {"error": "Only patient accounts can perform this action."},
            status=403,
        )


def get_doctor_or_403(user):
    """
    Returns (doctor, None) on success.
    Returns (None, Response 403) if user is not a doctor.
    """
    try:
        return Doctor.objects.select_related("user").get(user=user), None
    except Doctor.DoesNotExist:
        return None, Response(
            {"error": "Only doctor accounts can perform this action."},
            status=403,
        )


# [NEW] ─────────────────────────────────────────────────────────────────────
def get_opdstaff_or_403(user):
    """
    Returns (opdstaff, None) on success.
    Returns (None, Response 403) if user is not an OPD-staff user.

    Used by the doctor-leave endpoints (apply / cancel / list) so only
    authenticated OPD staff can manage leaves on behalf of doctors.
    """
    if not user or not user.is_authenticated:
        return None, Response(
            {"error": "Authentication required."}, status=401
        )

    try:
        return OPDStaff.objects.select_related("user").get(user=user), None
    except OPDStaff.DoesNotExist:
        return None, Response(
            {"error": "Only OPD staff can perform this action."},
            status=403,
        )


# ─────────────────────────────────────────────
# QUEUE POSITION
# ─────────────────────────────────────────────

def compute_queue_position(booking):
    """
    Returns a dict with:
    - position: absolute position in queue
    - tokens_ahead: number of confirmed/waiting tokens before this one
    - estimated_wait_minutes: estimated waiting time
    """
    tokens_ahead = Booking.objects.filter(
        doctor=booking.doctor,
        booking_date=booking.booking_date,
        session=booking.session,
        status__in=[BookingStatus.WAITING, BookingStatus.CONSULTING],
        is_confirmed=True,
        queue_insert_time__lt=now(),
    ).count()

    try:
        opd_day = OPDDay.objects.get(
            doctor=booking.doctor,
            date=booking.booking_date,
            session=booking.session,
        )
        avg = opd_day.avg_consult_minutes
    except OPDDay.DoesNotExist:
        avg = 7

    return {
        "position"              : tokens_ahead + 1,
        "tokens_ahead"          : tokens_ahead,
        "estimated_wait_minutes": tokens_ahead * avg,
    }


# ─────────────────────────────────────────────
# EMAIL HELPERS
# ─────────────────────────────────────────────

def _get_patient_email(booking) -> str | None:
    """
    Safely extract the patient's email from a booking.
    Returns None (with a warning log) if not found.
    """
    if not booking.patient:
        logger.warning(
            f"Booking {booking.id} — no patient linked (walk-in or data issue)."
        )
        return None

    try:
        user = booking.patient.user
    except Exception:
        logger.warning(
            f"Booking {booking.id} — patient {booking.patient.id} has no user."
        )
        return None

    email = (user.email or "").strip()
    if not email:
        logger.warning(
            f"Booking {booking.id} — patient '{booking.patient}' "
            f"(user: {user.username}) has no email address set."
        )
        return None

    return email


def send_opd_ticket_email(booking) -> bool:
    """
    Send the OPD ticket as a PDF attachment to the patient's email.

    Returns True if sent successfully, False otherwise.
    Uses fail_silently=False so real SMTP errors are visible in logs.
    """
    email = _get_patient_email(booking)
    if not email:
        return False

    try:
        pdf_bytes = generate_ticket_pdf(booking)

        msg = EmailMessage(
            subject=f"[MedQueue] Your OPD Ticket – Token #{booking.token_number}",
            body=(
                f"Dear {booking.display_name},\n\n"
                f"Your OPD token has been booked successfully.\n\n"
                f"Doctor     : Dr. {booking.doctor.full_name}\n"
                f"Hospital   : {booking.doctor.hospital.name}\n"
                f"Department : {booking.doctor.department.name}\n"
                f"Date       : {booking.booking_date}\n"
                f"Session    : {booking.get_session_display()}\n"
                f"Token #    : {booking.token_number}\n\n"
                "Please find your OPD ticket attached.\n\n"
                "Important: You must confirm your attendance once the OPD starts.\n\n"
                "– MedQueue Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        msg.attach(
            filename=f"OPD_Ticket_{booking.token_number}.pdf",
            content=pdf_bytes,
            mimetype="application/pdf",
        )
        msg.send(fail_silently=False)

        Booking.objects.filter(id=booking.id).update(ticket_sent=True)
        logger.info(
            f"OPD ticket sent → {email} | "
            f"Token #{booking.token_number} | Booking {booking.id}"
        )
        return True

    except Exception as e:
        logger.error(
            f"send_opd_ticket_email failed for booking {booking.id}: {e}"
        )
        return False


def send_reminder_email(booking) -> bool:
    """
    Send 30-minute pre-OPD reminder asking the patient to confirm attendance.
    Returns True if sent, False if no email or send failed.
    """
    email = _get_patient_email(booking)
    if not email:
        return False

    try:
        send_mail(
            subject=f"[MedQueue] Action Required – Confirm Your Token #{booking.token_number}",
            message=(
                f"Dear {booking.display_name},\n\n"
                f"Dr. {booking.doctor.full_name}'s OPD session will start in 30 minutes.\n\n"
                f"Token #  : {booking.token_number}\n"
                f"Date     : {booking.booking_date}\n"
                f"Session  : {booking.get_session_display()}\n\n"
                "Please log in to MedQueue and confirm your attendance.\n"
                "If you do not confirm, you may miss your turn.\n\n"
                "– MedQueue Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        Booking.objects.filter(id=booking.id).update(reminder_sent=True)
        logger.info(
            f"Reminder email sent → {email} | "
            f"Token #{booking.token_number} | Booking {booking.id}"
        )
        return True

    except Exception as e:
        logger.error(
            f"send_reminder_email failed for booking {booking.id}: {e}"
        )
        return False


def send_mail_safe(subject, message, to, from_email=None):
    """
    Wrapper for send_mail. Uses settings.DEFAULT_FROM_EMAIL by default.
    Logs errors instead of raising.
    """
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email or settings.DEFAULT_FROM_EMAIL,
            recipient_list=to if isinstance(to, list) else [to],
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f"send_mail_safe failed (to={to}): {e}")


# ─────────────────────────────────────────────
# PDF TICKET GENERATION
# ─────────────────────────────────────────────

def generate_ticket_pdf(booking) -> bytes:
    """
    Generate and return a PDF OPD ticket as raw bytes.
    Requires: reportlab
    """
    from io import BytesIO
    from reportlab.lib.pagesizes import A6
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.lib.units import mm

    buffer = BytesIO()
    PAGE_W, PAGE_H = A6

    c = canvas.Canvas(buffer, pagesize=A6)

    BLUE        = colors.HexColor("#1a73e8")
    DARK_BLUE   = colors.HexColor("#1565c0")
    WHITE       = colors.white
    MUTED       = colors.HexColor("#5f6368")
    ROW_ALT     = colors.HexColor("#f8f9fa")
    BORDER      = colors.HexColor("#e0e0e0")
    WARN_BG     = colors.HexColor("#fff8e1")
    WARN_BORDER = colors.HexColor("#ffe082")
    WARN_TEXT   = colors.HexColor("#e65100")
    TEXT_DARK   = colors.HexColor("#202124")

    # ── Header ────────────────────────────────────────────────────────
    header_h = 28 * mm
    c.setFillColor(BLUE)
    c.rect(0, PAGE_H - header_h, PAGE_W, header_h, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 14 * mm, "MedQueue")
    c.setFillColor(colors.HexColor("#bbdefb"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 21 * mm, "OPD Appointment Ticket")

    # ── Token block ───────────────────────────────────────────────────
    token_top = PAGE_H - header_h
    token_h   = 26 * mm
    c.setFillColor(DARK_BLUE)
    c.rect(0, token_top - token_h, PAGE_W, token_h, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#90caf9"))
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(PAGE_W / 2, token_top - 8 * mm, "TOKEN  NUMBER")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 38)
    c.drawCentredString(PAGE_W / 2, token_top - 20 * mm, f"#{booking.token_number}")

    # ── Info rows ─────────────────────────────────────────────────────
    info_top = token_top - token_h - 3 * mm
    row_h    = 8.5 * mm
    label_x  = 8 * mm
    value_x  = 38 * mm
    right_x  = PAGE_W - 6 * mm

    fields = [
        ("PATIENT",    booking.display_name),
        ("DOCTOR",     f"Dr. {booking.doctor.full_name}"),
        ("HOSPITAL",   booking.doctor.hospital.name),
        ("DEPARTMENT", booking.doctor.department.name),
        ("DATE",       str(booking.booking_date)),
        ("SESSION",    booking.get_session_display()),
        ("BOOKED AT",  booking.created_at.strftime("%d %b %Y  %H:%M")),
    ]

    for i, (label, value) in enumerate(fields):
        y_top    = info_top - i * row_h
        y_bottom = y_top - row_h
        if i % 2 == 1:
            c.setFillColor(ROW_ALT)
            c.rect(0, y_bottom, PAGE_W, row_h, fill=1, stroke=0)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.3)
        c.line(label_x, y_bottom, right_x, y_bottom)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.5)
        c.drawString(label_x, y_bottom + 5.5, label)
        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(value_x, y_bottom + 5.5, value)

    # ── Warning box ───────────────────────────────────────────────────
    warn_top = info_top - len(fields) * row_h - 4 * mm
    warn_h   = 10 * mm
    margin   = 7 * mm
    c.setFillColor(WARN_BG)
    c.setStrokeColor(WARN_BORDER)
    c.setLineWidth(0.5)
    c.roundRect(
        margin, warn_top - warn_h,
        PAGE_W - 2 * margin, warn_h,
        2 * mm, fill=1, stroke=1,
    )
    c.setFillColor(WARN_TEXT)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(
        PAGE_W / 2, warn_top - 4.5 * mm,
        "! Confirm your attendance once the OPD session starts.",
    )

    c.save()
    return buffer.getvalue()
