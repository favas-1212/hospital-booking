from celery import shared_task
from django.utils.timezone import now
from django.core.mail import send_mail
from .models import Booking
import datetime

@shared_task
def send_session_reminders():

    today = now().date()

    morning_time = datetime.time(9, 0)
    afternoon_time = datetime.time(12, 22)

    bookings = Booking.objects.filter(
        booking_date=today,
        payment_status="paid"
    )

    for booking in bookings:
        if booking.session == "morning":
            session_time = morning_time
        else:
            session_time = afternoon_time

        send_mail(
            subject="Confirm Your OPD Token",
            message=(
                f"Dear {booking.patient.user.username},\n\n"
                f"Consulting starts at {session_time}. "
                "Please confirm your ticket on the web.\n\n"
                "If not confirmed, you will remain in waiting queue."
            ),
            from_email="no-reply@medqueue.com",
            recipient_list=[booking.patient.user.email],
            fail_silently=True
        )

@shared_task
def move_unconfirmed_to_waiting():

    today = now().date()

    unconfirmed = Booking.objects.filter(
        booking_date=today,
        payment_status="paid",
        is_confirmed=False
    )

    for booking in unconfirmed:
        booking.status = "waiting"
        booking.save()


