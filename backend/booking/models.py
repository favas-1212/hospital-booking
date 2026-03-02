from django.db import models
from django.core.exceptions import ValidationError
from django.utils.timezone import now
from datetime import date, timedelta
from accounts.models import Patient
from accounts.models import Doctor

class District(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Hospital(models.Model):
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="hospitals")
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Department(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class OPDSession(models.TextChoices):
    MORNING = "morning", "Morning (10AM - 12PM)"
    EVENING = "evening", "Evening (2PM - 5PM)"


class Booking(models.Model):

    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name="bookings"
    )

    walkin_name = models.CharField(
        max_length=100,
        null=True,
        blank=True
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="bookings",
        null=True,      # allow null
        blank=True      # allow blank in forms/admin
    )
    session = models.CharField(
        max_length=10,
        choices=OPDSession.choices
    )

    booking_date = models.DateField()

    token_number = models.PositiveIntegerField()

    payment_status = models.CharField(
        max_length=20,
        choices=(
            ("pending", "Pending"),
            ("paid", "Paid"),
            ("failed", "Failed"),
            ("offline", "Offline"),
        ),
        default="pending"
    )

    status = models.CharField(
        max_length=20,
        choices=(
            ("waiting", "Waiting"),
            ("consulting", "Consulting"),
            ("done", "Done"),
        ),
        default="waiting"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "session", "booking_date", "token_number"],
                name="unique_token_per_doctor_session"
            ),
            models.UniqueConstraint(
                fields=["patient", "booking_date"],
                name="unique_patient_per_day"
            )
        ]

        ordering = ["booking_date", "session", "token_number"]

    def clean(self):
        today = date.today()
        last_date = today + timedelta(days=7)

        if self.booking_date < today:
            raise ValidationError("Cannot book past dates")

        if self.booking_date > last_date:
            raise ValidationError("Booking allowed only next 7 days")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.patient:
            name = self.patient.full_name
        else:
            name = self.walkin_name or "Walk-in"
        return f"{name} - {self.booking_date} - Token {self.token_number}"
    
    
class OPDDay(models.Model):
    doctor = models.ForeignKey("accounts.Doctor", on_delete=models.CASCADE)
    date = models.DateField()
    started_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        unique_together = ("doctor", "date")