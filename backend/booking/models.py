from django.db import models
from django.core.exceptions import ValidationError
from django.utils.timezone import now
from datetime import timedelta
from accounts.models import Patient

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
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="bookings"
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name="bookings"
    )

    session = models.CharField(
    max_length=10,
    choices=OPDSession.choices
    )

    booking_date = models.DateField()

    token_number = models.IntegerField()

    payment_status = models.CharField(
        max_length=20,
        choices=(
            ("pending", "Pending"),
            ("paid", "Paid"),
            ("failed", "Failed"),
        ),
        default="pending"
    )

    created_at = models.DateTimeField(auto_now_add=True)


    # =========================
    # Constraints
    # =========================
    class Meta:

        # Prevent duplicate token number
        unique_together = (
            "department",
            "session",
            "booking_date",
            "token_number"
        )

        # Prevent patient multiple booking same day
        constraints = [
            models.UniqueConstraint(
                fields=["patient", "booking_date"],
                name="unique_patient_per_day"
            )
        ]


    # =========================
    # Validation
    # =========================
    def clean(self):

        today = date.today()
        last_date = today + timedelta(days=7)

        if self.booking_date < today:
            raise ValidationError("Cannot book past dates")

        if self.booking_date > last_date:
            raise ValidationError("Booking allowed only next 7 days")


    def __str__(self):

        return f"{self.patient} - {self.booking_date} - Token {self.token_number}"