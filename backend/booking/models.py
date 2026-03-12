"""
MedQueue Booking Models
=======================
Clean, well-organized models for the hospital OPD queue system.
"""

from django.db import models
from django.core.exceptions import ValidationError
from django.utils.timezone import now
from datetime import date, timedelta
from accounts.models import Patient, Doctor


# ─────────────────────────────────────────────
# LOCATION MODELS
# ─────────────────────────────────────────────

class District(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Hospital(models.Model):
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="hospitals")
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Department(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.hospital.name} – {self.name}"


# ─────────────────────────────────────────────
# CHOICES
# ─────────────────────────────────────────────

class OPDSession(models.TextChoices):
    MORNING = "morning", "Morning (10AM – 12PM)"
    EVENING = "evening", "Evening (3PM – 5PM)"


class BookingStatus(models.TextChoices):
    PENDING    = "pending",    "Pending"        # just booked, waiting payment / confirmation
    APPROVED   = "approved",   "Approved"       # patient confirmed attendance
    WAITING    = "waiting",    "Waiting"        # in queue
    CONSULTING = "consulting", "Consulting"     # currently with doctor
    DONE       = "done",       "Done"           # consultation complete
    SKIPPED    = "skipped",    "Skipped"        # did not show up in time


class PaymentStatus(models.TextChoices):
    PENDING  = "pending",  "Pending"
    PAID     = "paid",     "Paid"
    FAILED   = "failed",   "Failed"
    OFFLINE  = "offline",  "Offline (Walk-in)"


# ─────────────────────────────────────────────
# TOKEN RANGE CONSTANTS
# ─────────────────────────────────────────────

MAX_TOKENS_PER_SESSION = 60
ONLINE_TOKEN_START     = 16
ONLINE_TOKEN_END       = 35

ONLINE_RANGE = list(range(ONLINE_TOKEN_START, ONLINE_TOKEN_END + 1))          # 16-35
WALKIN_RANGE = list(range(1, ONLINE_TOKEN_START)) + list(range(ONLINE_TOKEN_END + 1, MAX_TOKENS_PER_SESSION + 1))  # 1-15, 36-60


# ─────────────────────────────────────────────
# BOOKING
# ─────────────────────────────────────────────

class Booking(models.Model):

    # ── Relationships ──
    doctor     = models.ForeignKey(Doctor,  on_delete=models.CASCADE, related_name="bookings")
    patient    = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="bookings", null=True, blank=True)

    # ── Walk-in support ──
    walkin_name = models.CharField(max_length=100, null=True, blank=True, help_text="Name for walk-in patients")

    # ── Booking details ──
    session      = models.CharField(max_length=10, choices=OPDSession.choices)
    booking_date = models.DateField()
    token_number = models.PositiveIntegerField()

    # ── Status tracking ──
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )
    status = models.CharField(
        max_length=15, choices=BookingStatus.choices, default=BookingStatus.PENDING
    )

    # ── Confirmation (online patients must confirm 30 min before OPD) ──
    is_confirmed       = models.BooleanField(default=False)
    confirmation_time  = models.DateTimeField(null=True, blank=True)

    # ── Queue position tracking ──
    queue_insert_time  = models.DateTimeField(null=True, blank=True,
        help_text="When patient joined the active queue (after confirmation)")

    # ── Timing ──
    consulting_started_at = models.DateTimeField(null=True, blank=True)
    consulting_ended_at   = models.DateTimeField(null=True, blank=True)
    created_at            = models.DateTimeField(auto_now_add=True)

    # ── Notification flags ──
    reminder_sent = models.BooleanField(default=False)
    ticket_sent   = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "session", "booking_date", "token_number"],
                name="unique_token_per_doctor_session"
            ),
            models.UniqueConstraint(
                fields=["patient", "booking_date"],
                name="unique_patient_per_day",
                condition=models.Q(patient__isnull=False)
            ),
        ]
        ordering = ["booking_date", "session", "token_number"]

    def clean(self):
        today = date.today()
        if self.booking_date < today:
            raise ValidationError("Cannot book past dates.")
        if self.booking_date > today + timedelta(days=7):
            raise ValidationError("Booking allowed only for the next 7 days.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def display_name(self):
        if self.patient:
            return self.patient.user.get_full_name() or self.patient.user.username
        return self.walkin_name or "Walk-in"

    @property
    def is_online(self):
        return self.token_number in ONLINE_RANGE

    @property
    def is_walkin(self):
        return self.token_number in WALKIN_RANGE

    @property
    def consulting_duration_minutes(self):
        if self.consulting_started_at and self.consulting_ended_at:
            delta = self.consulting_ended_at - self.consulting_started_at
            return round(delta.total_seconds() / 60, 1)
        return None

    def __str__(self):
        return f"{self.display_name} | {self.booking_date} | Token #{self.token_number} [{self.status}]"


# ─────────────────────────────────────────────
# OPD DAY  (per doctor per date)
# ─────────────────────────────────────────────

class OPDDay(models.Model):
    doctor     = models.ForeignKey("accounts.Doctor", on_delete=models.CASCADE, related_name="opd_days")
    date       = models.DateField()
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at   = models.DateTimeField(null=True, blank=True)
    is_active  = models.BooleanField(default=False)

    # Average consulting time in minutes (auto-calculated, editable)
    avg_consult_minutes = models.PositiveIntegerField(default=7)

    class Meta:
        unique_together = ("doctor", "date")
        ordering = ["-date"]

    def __str__(self):
        return f"OPD – Dr. {self.doctor.full_name} | {self.date} | Active: {self.is_active}"
