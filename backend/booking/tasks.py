"""
MedQueue Celery Tasks
=====================
Background tasks for:
  - Sending OPD ticket emails after booking
  - Sending 30-minute reminder emails before OPD start
  - Auto-moving unconfirmed patients to a lower-priority queue
  - Updating average consulting time

Beat schedule (add to settings.py):
-------------------------------------
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # Run every morning at 7:30 AM and 12:30 PM (30 min before each session)
    "send-morning-reminders": {
        "task": "booking.tasks.send_session_reminders",
        "schedule": crontab(hour=9, minute=30),  # 30 min before 10 AM morning OPD
        "args": ["morning"],
    },
    "send-evening-reminders": {
        "task": "booking.tasks.send_session_reminders",
        "schedule": crontab(hour=14, minute=30),  # 30 min before 3 PM evening OPD
        "args": ["evening"],
    },
}
"""

from celery import shared_task
from django.utils.timezone import now
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_ticket_email_task(self, booking_id):
    """
    Send the OPD ticket PDF to the patient's email immediately after booking.
    Retries up to 3 times on failure.
    """
    from .models import Booking
    from .utils import send_opd_ticket_email

    try:
        booking = Booking.objects.get(id=booking_id)
        if booking.ticket_sent:
            logger.info(f"Ticket already sent for booking {booking_id}. Skipping.")
            return

        success = send_opd_ticket_email(booking)
        if success:
            logger.info(f"OPD ticket sent for booking {booking_id} → {booking.patient.user.email}")
        else:
            logger.warning(f"Could not send ticket for booking {booking_id} (no email?)")

    except Booking.DoesNotExist:
        logger.error(f"Booking {booking_id} not found for ticket email.")
    except Exception as exc:
        logger.error(f"Error sending ticket for booking {booking_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2)
def send_session_reminders(self, session):
    """
    Send 30-minute reminder emails to all paid, unconfirmed patients for a session.
    This should be scheduled to run 30 minutes before OPD starts.
    Args:
        session (str): "morning" or "evening"
    """
    from .models import Booking, BookingStatus, PaymentStatus
    from .utils import send_reminder_email

    today = now().date()

    bookings = Booking.objects.filter(
        booking_date=today,
        session=session,
        payment_status=PaymentStatus.PAID,
        is_confirmed=False,
        reminder_sent=False,
        patient__isnull=False,
    ).select_related("patient__user", "doctor")

    sent_count = 0
    for booking in bookings:
        try:
            success = send_reminder_email(booking)
            if success:
                sent_count += 1
        except Exception as e:
            logger.error(f"Failed to send reminder for booking {booking.id}: {e}")

    logger.info(f"Sent {sent_count} reminder emails for {session} session on {today}.")
    return sent_count


@shared_task
def auto_handle_unconfirmed_patients():
    """
    Run after OPD starts.
    Patients who did NOT confirm are kept in 'waiting' with is_confirmed=False.
    They are shown in a separate 'unconfirmed queue' on the dashboard.
    This task logs the count — the doctor can manually call them or skip them.

    Note: Unconfirmed patients are NOT auto-removed. The doctor decides.
    """
    from .models import Booking, BookingStatus, OPDDay

    today = now().date()
    active_opd_days = OPDDay.objects.filter(date=today, is_active=True)

    for opd_day in active_opd_days:
        unconfirmed = Booking.objects.filter(
            doctor=opd_day.doctor,
            booking_date=today,
            is_confirmed=False,
            status=BookingStatus.WAITING,
        ).count()
        logger.info(
            f"Dr. {opd_day.doctor.full_name} | {today} | "
            f"{unconfirmed} unconfirmed patient(s) still in queue."
        )


@shared_task
def recalculate_avg_consult_times():
    """
    Recalculate average consulting times for all active OPD days.
    Run every 15 minutes during OPD hours.
    """
    from .models import Booking, BookingStatus, OPDDay

    today = now().date()
    active_days = OPDDay.objects.filter(date=today, is_active=True)

    for opd_day in active_days:
        done_bookings = Booking.objects.filter(
            doctor=opd_day.doctor,
            booking_date=today,
            status=BookingStatus.DONE,
            consulting_started_at__isnull=False,
            consulting_ended_at__isnull=False,
        )
        if done_bookings.count() >= 3:
            total_minutes = sum(
                b.consulting_duration_minutes
                for b in done_bookings
                if b.consulting_duration_minutes is not None
            )
            avg = total_minutes / done_bookings.count()
            new_avg = max(1, round(avg))
            if opd_day.avg_consult_minutes != new_avg:
                opd_day.avg_consult_minutes = new_avg
                opd_day.save(update_fields=["avg_consult_minutes"])
                logger.info(
                    f"Updated avg consult time for Dr. {opd_day.doctor.full_name}: {new_avg} min"
                )
