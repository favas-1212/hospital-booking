"""
MedQueue Booking Utilities
==========================
Shared helper functions used across views, tasks, and serializers.
"""

from django.core.mail import EmailMessage
from django.utils.timezone import now
from rest_framework.response import Response
from rest_framework import status

from accounts.models import Patient, Doctor
from .models import Booking, OPDDay, BookingStatus


# ─────────────────────────────────────────────
# AUTH HELPERS
# ─────────────────────────────────────────────

def get_patient_or_403(user):
    """
    Returns (patient, None) on success.
    Returns (None, Response 403) if user is not a patient.
    """
    try:
        return Patient.objects.get(user=user), None
    except Patient.DoesNotExist:
        return None, Response({"error": "Only patient accounts can perform this action."}, status=403)


def get_doctor_or_403(user):
    """
    Returns (doctor, None) on success.
    Returns (None, Response 403) if user is not a doctor.
    """
    try:
        return Doctor.objects.get(user=user), None
    except Doctor.DoesNotExist:
        return None, Response({"error": "Only doctor accounts can perform this action."}, status=403)


# ─────────────────────────────────────────────
# QUEUE POSITION
# ─────────────────────────────────────────────

def compute_queue_position(booking):
    """
    When a patient confirms attendance, they are inserted into the queue
    5 positions ahead of the current last confirmed patient.

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
        opd_day = OPDDay.objects.get(doctor=booking.doctor, date=booking.booking_date)
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

def send_opd_ticket_email(booking):
    """
    Send the OPD ticket as a PDF attachment to the patient's email.
    PDF generation is handled by generate_ticket_pdf().
    """
    if not booking.patient or not booking.patient.user.email:
        return False

    try:
        pdf_bytes = generate_ticket_pdf(booking)
        email = EmailMessage(
            subject=f"[MedQueue] Your OPD Ticket – Token #{booking.token_number}",
            body=(
                f"Dear {booking.display_name},\n\n"
                f"Your OPD token has been booked successfully.\n\n"
                f"Doctor   : Dr. {booking.doctor.full_name}\n"
                f"Hospital : {booking.doctor.hospital.name}\n"
                f"Dept     : {booking.doctor.department.name}\n"
                f"Date     : {booking.booking_date}\n"
                f"Session  : {booking.get_session_display()}\n"
                f"Token #  : {booking.token_number}\n\n"
                "Please find your OPD ticket attached.\n\n"
                "Important: You must confirm your attendance once the OPD starts.\n\n"
                "– MedQueue Team"
            ),
            from_email="no-reply@medqueue.com",
            to=[booking.patient.user.email],
        )
        email.attach(
            filename=f"OPD_Ticket_{booking.token_number}.pdf",
            content=pdf_bytes,
            mimetype="application/pdf",
        )
        email.send(fail_silently=True)
        booking.ticket_sent = True
        booking.save(update_fields=["ticket_sent"])
        return True
    except Exception:
        return False


def send_reminder_email(booking):
    """
    Send 30-minute reminder email asking the patient to confirm attendance.
    """
    if not booking.patient or not booking.patient.user.email:
        return False

    send_mail_safe(
        subject=f"[MedQueue] Action Required – Confirm Your Token #{booking.token_number}",
        message=(
            f"Dear {booking.display_name},\n\n"
            f"Dr. {booking.doctor.full_name}'s OPD session will start in 30 minutes.\n\n"
            f"Token #  : {booking.token_number}\n"
            f"Date     : {booking.booking_date}\n"
            f"Session  : {booking.get_session_display()}\n\n"
            "⚠️  Please log in to MedQueue and confirm your attendance.\n"
            "If you do not confirm, you will be placed in the unconfirmed queue "
            "and may miss your turn.\n\n"
            "– MedQueue Team"
        ),
        to=[booking.patient.user.email],
    )
    booking.reminder_sent = True
    booking.save(update_fields=["reminder_sent"])
    return True


def send_mail_safe(subject, message, to, from_email="no-reply@medqueue.com"):
    """Wrapper for send_mail with fail_silently."""
    from django.core.mail import send_mail
    send_mail(subject=subject, message=message, from_email=from_email,
              recipient_list=to, fail_silently=True)


# ─────────────────────────────────────────────
# PDF TICKET GENERATION
# ─────────────────────────────────────────────

def generate_ticket_pdf(booking):
    """
    Generate an OPD ticket PDF using ReportLab.
    Returns raw PDF bytes.
    Install: pip install reportlab
    """
    from io import BytesIO
    from reportlab.lib.pagesizes import A6
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A6,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"],
                                  fontSize=14, textColor=colors.HexColor("#1a73e8"),
                                  alignment=TA_CENTER, spaceAfter=4)
    subtitle_style = ParagraphStyle("subtitle", parent=styles["Normal"],
                                     fontSize=8, textColor=colors.grey,
                                     alignment=TA_CENTER, spaceAfter=6)
    token_style = ParagraphStyle("token", parent=styles["Normal"],
                                  fontSize=36, fontName="Helvetica-Bold",
                                  textColor=colors.HexColor("#1a73e8"),
                                  alignment=TA_CENTER, spaceAfter=4)
    label_style = ParagraphStyle("label", parent=styles["Normal"],
                                  fontSize=8, textColor=colors.grey, spaceAfter=1)
    value_style = ParagraphStyle("value", parent=styles["Normal"],
                                  fontSize=9, fontName="Helvetica-Bold", spaceAfter=4)

    story = [
        Paragraph("MedQueue", title_style),
        Paragraph("OPD Appointment Ticket", subtitle_style),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#1a73e8")),
        Spacer(1, 4 * mm),
        Paragraph("TOKEN NUMBER", label_style),
        Paragraph(f"#{booking.token_number}", token_style),
        Spacer(1, 2 * mm),
        HRFlowable(width="100%", thickness=0.3, color=colors.lightgrey),
        Spacer(1, 3 * mm),
    ]

    # Info table
    info_data = [
        ["Patient",  booking.display_name],
        ["Doctor",   f"Dr. {booking.doctor.full_name}"],
        ["Hospital", booking.doctor.hospital.name],
        ["Dept",     booking.doctor.department.name],
        ["Date",     str(booking.booking_date)],
        ["Session",  booking.get_session_display()],
        ["Booked At", booking.created_at.strftime("%d %b %Y %H:%M")],
    ]

    tbl = Table(info_data, colWidths=[22 * mm, 58 * mm])
    tbl.setStyle(TableStyle([
        ("FONTNAME",  (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE",  (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 4 * mm))

    story.append(HRFlowable(width="100%", thickness=0.3, color=colors.lightgrey))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "⚠ Confirm your attendance on MedQueue once OPD starts.",
        ParagraphStyle("note", parent=styles["Normal"], fontSize=7,
                       textColor=colors.HexColor("#e65100"), alignment=TA_CENTER)
    ))

    doc.build(story)
    return buffer.getvalue()
