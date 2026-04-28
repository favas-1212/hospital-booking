"""
MedQueue Booking Models
=======================
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
    name     = models.CharField(max_length=200)
    address  = models.TextField(blank=True)
    def __str__(self):
        return self.name


class Department(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="departments")
    name     = models.CharField(max_length=100)
    def __str__(self):
        return f"{self.hospital.name} – {self.name}"


# ─────────────────────────────────────────────
# CHOICES
# ─────────────────────────────────────────────

class OPDSession(models.TextChoices):
    MORNING = "morning", "Morning (10AM – 12PM)"
    EVENING = "evening", "Evening (3PM – 5PM)"


class BookingStatus(models.TextChoices):
    PENDING    = "pending",    "Pending"
    APPROVED   = "approved",   "Approved"
    WAITING    = "waiting",    "Waiting"
    CONSULTING = "consulting", "Consulting"
    DONE       = "done",       "Done"
    SKIPPED    = "skipped",    "Skipped"


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

ONLINE_RANGE = list(range(ONLINE_TOKEN_START, ONLINE_TOKEN_END + 1))
WALKIN_RANGE = list(range(1, ONLINE_TOKEN_START)) + list(range(ONLINE_TOKEN_END + 1, MAX_TOKENS_PER_SESSION + 1))


# ─────────────────────────────────────────────
# BOOKING
# ─────────────────────────────────────────────

class Booking(models.Model):
    doctor  = models.ForeignKey(Doctor,  on_delete=models.CASCADE, related_name="bookings")
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="bookings", null=True, blank=True)

    walkin_name = models.CharField(max_length=100, null=True, blank=True)

    session      = models.CharField(max_length=10, choices=OPDSession.choices)
    booking_date = models.DateField()
    token_number = models.PositiveIntegerField()

    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    status         = models.CharField(max_length=15, choices=BookingStatus.choices, default=BookingStatus.PENDING)

    is_confirmed      = models.BooleanField(default=False)
    confirmation_time = models.DateTimeField(null=True, blank=True)

    queue_insert_time = models.DateTimeField(null=True, blank=True)

    consulting_started_at = models.DateTimeField(null=True, blank=True)
    consulting_ended_at   = models.DateTimeField(null=True, blank=True)
    created_at            = models.DateTimeField(auto_now_add=True)

    reminder_sent        = models.BooleanField(default=False)
    ticket_sent          = models.BooleanField(default=False)
    near_queue_notified  = models.BooleanField(default=False)
    two_ahead_notified   = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "session", "booking_date", "token_number"],
                name="unique_token_per_doctor_session"
            ),
            models.UniqueConstraint(
                fields=["patient", "doctor", "session", "booking_date"],
                name="unique_patient_per_doctor_session",
                condition=models.Q(patient__isnull=False),
            ),
        ]
        ordering = ["booking_date", "session", "token_number"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    @property
    def display_name(self):
        if self.walkin_name:
            return self.walkin_name
        if self.patient:
            return self.patient.user.get_full_name() or self.patient.user.username
        return "Walk-in"

    @property
    def is_walkin(self):
        return self.token_number in WALKIN_RANGE or (
            self.patient_id is None
            and bool(self.walkin_name)
            and self.payment_status == PaymentStatus.OFFLINE
        )

    @property
    def is_online(self):
        return not self.is_walkin

    @property
    def consulting_duration_minutes(self):
        if self.consulting_started_at and self.consulting_ended_at:
            delta = self.consulting_ended_at - self.consulting_started_at
            return round(delta.total_seconds() / 60, 1)
        return None

    def __str__(self):
        return f"{self.display_name} | {self.booking_date} | Token #{self.token_number} [{self.status}]"


# ─────────────────────────────────────────────
# OPD DAY
# ─────────────────────────────────────────────

class OPDDay(models.Model):
    doctor  = models.ForeignKey("accounts.Doctor", on_delete=models.CASCADE, related_name="opd_days")
    date    = models.DateField()
    session = models.CharField(max_length=10, choices=OPDSession.choices)

    started_at = models.DateTimeField(null=True, blank=True)
    ended_at   = models.DateTimeField(null=True, blank=True)
    is_active  = models.BooleanField(default=False)

    is_paused    = models.BooleanField(default=False)
    paused_at    = models.DateTimeField(null=True, blank=True)
    pause_reason = models.CharField(max_length=255, null=True, blank=True)

    avg_consult_minutes      = models.PositiveIntegerField(default=7)
    confirmation_prompt_sent = models.BooleanField(default=False)

    class Meta:
        unique_together = ("doctor", "date", "session")
        ordering        = ["-date", "session"]

    def __str__(self):
        pause_flag = " [PAUSED]" if self.is_paused else ""
        return (
            f"OPD – Dr. {self.doctor.full_name} | {self.date} | "
            f"{self.session} | Active: {self.is_active}{pause_flag}"
        )


# ─────────────────────────────────────────────
# [NEW] DOCTOR LEAVE  (managed by OPD STAFF, not by the doctor)
# ─────────────────────────────────────────────

class LeaveSession(models.TextChoices):
    MORNING = "morning", "Morning only"
    EVENING = "evening", "Evening only"
    ALL     = "all",     "Full Day"


class DoctorLeave(models.Model):
    """
    A leave declared by OPD STAFF on behalf of a doctor for a specific date.

    session can be:
      • 'morning' – blocks only morning OPD
      • 'evening' – blocks only evening OPD
      • 'all'     – blocks the entire day (both sessions)

    While is_active=True:
      • New online/walk-in bookings for (doctor, date, matching_session) are refused.
      • Existing PENDING/WAITING bookings are cancelled (status = SKIPPED)
        and patients are notified by email.
      • start_opd() is refused for the matching session.

    Audit fields:
      • applied_by  – the User (staff) who applied the leave
      • cancelled_by – the User (staff) who cancelled the leave, if any
    """

    doctor     = models.ForeignKey(
        "accounts.Doctor", on_delete=models.CASCADE, related_name="leaves"
    )
    date       = models.DateField()
    session    = models.CharField(
        max_length=10, choices=LeaveSession.choices, default=LeaveSession.ALL
    )
    reason     = models.CharField(max_length=255, blank=True, null=True)
    is_active  = models.BooleanField(default=True)

    applied_by   = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="applied_leaves",
    )
    cancelled_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cancelled_leaves",
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("doctor", "date", "session")
        ordering        = ["-date", "session"]

    def __str__(self):
        state = "ACTIVE" if self.is_active else "CANCELLED"
        return f"Leave Dr.{self.doctor_id} | {self.date} | {self.session} [{state}]"


class Prescription(models.Model):
    """
    A diagnosis + prescription written by the doctor during consultation.
    One prescription per booking (OneToOne).
    Patients see this on their dashboard once the consultation is DONE.
    """
    booking = models.OneToOneField(
        Booking, on_delete=models.CASCADE, related_name="prescription"
    )
    diagnosis  = models.TextField(blank=True, default="")
    medicines  = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Rx for Token #{self.booking.token_number} ({self.booking.booking_date})"
