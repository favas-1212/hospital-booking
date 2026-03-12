"""
MedQueue Booking Serializers
"""

from rest_framework import serializers
from django.utils.timezone import now, localtime
from datetime import timedelta, time, datetime
from django.db import transaction

from .models import (
    District, Hospital, Department,
    Booking, OPDDay,
    OPDSession, BookingStatus, PaymentStatus,
    ONLINE_TOKEN_START, ONLINE_TOKEN_END, ONLINE_RANGE, WALKIN_RANGE,
    MAX_TOKENS_PER_SESSION,
)
from accounts.models import Patient, Doctor


# ─────────────────────────────────────────────
# CONSTANTS (defined here, NOT imported from models)
# ─────────────────────────────────────────────

SESSION_CUTOFF_HOURS = 2

SESSION_TIMES = {
    "morning": {"hour": 10, "minute": 0},
    "evening": {"hour": 15, "minute": 0},
}


def _session_cutoff_passed(session: str) -> bool:
    info = SESSION_TIMES.get(session)
    if not info:
        return False
    local_now = localtime(now())
    today = local_now.date()
    session_dt = datetime(
        today.year, today.month, today.day,
        info["hour"], info["minute"],
        tzinfo=local_now.tzinfo,
    )
    cutoff = session_dt - timedelta(hours=SESSION_CUTOFF_HOURS)
    return local_now >= cutoff


# ─────────────────────────────────────────────
# LOCATION SERIALIZERS
# ─────────────────────────────────────────────

class DistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = ["id", "name"]


class HospitalSerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(source="district.name", read_only=True)

    class Meta:
        model = Hospital
        fields = ["id", "name", "district", "district_name", "address"]


class DepartmentSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)

    class Meta:
        model = Department
        fields = ["id", "name", "hospital", "hospital_name"]


# ─────────────────────────────────────────────
# DOCTOR SERIALIZER
# ─────────────────────────────────────────────

class DoctorListSerializer(serializers.ModelSerializer):
    name          = serializers.SerializerMethodField()
    hospital      = serializers.CharField(source="hospital.name",    read_only=True)
    department    = serializers.CharField(source="department.name",  read_only=True)
    hospital_id   = serializers.IntegerField(source="hospital.id",   read_only=True)
    department_id = serializers.IntegerField(source="department.id", read_only=True)

    class Meta:
        model  = Doctor
        fields = ["id", "name", "hospital", "hospital_id", "department", "department_id", "is_approved"]

    def get_name(self, obj):
        return getattr(obj, "full_name", None) or obj.user.get_full_name() or obj.user.username


# ─────────────────────────────────────────────
# BOOKING CREATE SERIALIZER (Online)
# ─────────────────────────────────────────────

class BookingSerializer(serializers.ModelSerializer):
    doctor_id = serializers.PrimaryKeyRelatedField(
        queryset=Doctor.objects.filter(is_approved=True),
        source="doctor",
        write_only=True,
    )
    token_number    = serializers.IntegerField(read_only=True)
    payment_status  = serializers.CharField(read_only=True)
    status          = serializers.CharField(read_only=True)
    created_at      = serializers.DateTimeField(read_only=True)
    doctor_name     = serializers.SerializerMethodField()
    hospital_name   = serializers.CharField(source="doctor.hospital.name",   read_only=True)
    department_name = serializers.CharField(source="doctor.department.name", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "doctor_id", "doctor_name", "hospital_name", "department_name",
            "session", "booking_date",
            "token_number", "payment_status", "status", "created_at",
        ]

    def get_doctor_name(self, obj):
        return getattr(obj.doctor, "full_name", None) or obj.doctor.user.username

    def validate(self, data):
        booking_date = data.get("booking_date")
        session      = data.get("session")
        today        = now().date()

        if booking_date < today:
            raise serializers.ValidationError("Cannot book past dates.")
        if booking_date > today + timedelta(days=7):
            raise serializers.ValidationError("Booking allowed only within the next 7 days.")

        if booking_date == today and _session_cutoff_passed(session):
            raise serializers.ValidationError(
                f"Booking closed. Online booking closes {SESSION_CUTOFF_HOURS} hours before session start."
            )

        request = self.context.get("request")
        if not (request and request.user.is_authenticated):
            raise serializers.ValidationError("Authentication required for online booking.")

        try:
            patient = Patient.objects.get(user=request.user)
        except Patient.DoesNotExist:
            raise serializers.ValidationError("Only patient accounts can book tokens.")

        if Booking.objects.filter(patient=patient, booking_date=booking_date).exists():
            raise serializers.ValidationError("You already have a booking for this date.")

        data["_patient"] = patient
        return data

    @transaction.atomic
    def create(self, validated_data):
        doctor       = validated_data["doctor"]
        session      = validated_data["session"]
        booking_date = validated_data["booking_date"]
        patient      = validated_data.pop("_patient")

        existing_count = Booking.objects.select_for_update().filter(
            doctor=doctor,
            session=session,
            booking_date=booking_date,
            token_number__gte=ONLINE_TOKEN_START,
            token_number__lte=ONLINE_TOKEN_END,
        ).count()

        online_capacity = ONLINE_TOKEN_END - ONLINE_TOKEN_START + 1
        if existing_count >= online_capacity:
            raise serializers.ValidationError(
                f"Online session full. Maximum {online_capacity} tokens per session."
            )

        token_number = ONLINE_TOKEN_START + existing_count

        return Booking.objects.create(
            patient=patient,
            doctor=doctor,
            session=session,
            booking_date=booking_date,
            token_number=token_number,
            payment_status=PaymentStatus.PENDING,
            status=BookingStatus.PENDING,
            is_confirmed=False,
        )


# ─────────────────────────────────────────────
# WALK-IN BOOKING SERIALIZER
# ─────────────────────────────────────────────

class WalkinBookingSerializer(serializers.Serializer):
    doctor_id    = serializers.IntegerField()
    session      = serializers.ChoiceField(choices=OPDSession.choices)
    booking_date = serializers.DateField()
    token_number = serializers.IntegerField()
    patient_name = serializers.CharField(max_length=100)

    def validate_token_number(self, value):
        if value not in WALKIN_RANGE:
            raise serializers.ValidationError(
                f"Walk-in tokens must be in range 1-15 or 36-60. Got {value}."
            )
        return value

    def validate(self, data):
        try:
            doctor = Doctor.objects.get(id=data["doctor_id"], is_approved=True)
        except Doctor.DoesNotExist:
            raise serializers.ValidationError("Doctor not found or not approved.")
        data["doctor"] = doctor

        if Booking.objects.filter(
            doctor=doctor,
            session=data["session"],
            booking_date=data["booking_date"],
            token_number=data["token_number"],
        ).exists():
            raise serializers.ValidationError(
                f"Token #{data['token_number']} is already booked for this session."
            )
        return data

    @transaction.atomic
    def create(self, validated_data):
        return Booking.objects.create(
            doctor=validated_data["doctor"],
            session=validated_data["session"],
            booking_date=validated_data["booking_date"],
            token_number=validated_data["token_number"],
            walkin_name=validated_data["patient_name"],
            payment_status=PaymentStatus.OFFLINE,
            status=BookingStatus.APPROVED,
            is_confirmed=True,
            queue_insert_time=now(),
            patient=None,
        )


# ─────────────────────────────────────────────
# BOOKING DETAIL SERIALIZER
# ─────────────────────────────────────────────

class BookingDetailSerializer(serializers.ModelSerializer):
    patient_name    = serializers.SerializerMethodField()
    doctor_name     = serializers.SerializerMethodField()
    hospital_name   = serializers.CharField(source="doctor.hospital.name",   read_only=True)
    department_name = serializers.CharField(source="doctor.department.name", read_only=True)
    is_online       = serializers.BooleanField(read_only=True)
    is_walkin       = serializers.BooleanField(read_only=True)
    consulting_duration_minutes = serializers.FloatField(read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "token_number", "session", "booking_date",
            "patient_name", "doctor_name", "hospital_name", "department_name",
            "payment_status", "status",
            "is_confirmed", "confirmation_time",
            "queue_insert_time",
            "consulting_started_at", "consulting_ended_at",
            "consulting_duration_minutes",
            "is_online", "is_walkin",
            "created_at",
        ]

    def get_patient_name(self, obj):
        return obj.display_name

    def get_doctor_name(self, obj):
        return getattr(obj.doctor, "full_name", None) or obj.doctor.user.username


# ─────────────────────────────────────────────
# BOOKING HISTORY SERIALIZER
# ─────────────────────────────────────────────

class BookingHistorySerializer(serializers.ModelSerializer):
    hospital        = serializers.CharField(source="doctor.hospital.name",   read_only=True)
    department      = serializers.CharField(source="doctor.department.name", read_only=True)
    doctor_name     = serializers.SerializerMethodField()
    session_display = serializers.CharField(source="get_session_display",    read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id", "hospital", "department", "doctor_name",
            "session", "session_display", "booking_date",
            "token_number", "payment_status", "status",
            "is_confirmed", "created_at",
        ]

    def get_doctor_name(self, obj):
        return getattr(obj.doctor, "full_name", None) or obj.doctor.user.username


# ─────────────────────────────────────────────
# PATIENT TOKEN STATUS SERIALIZER
# ─────────────────────────────────────────────

class PatientTokenStatusSerializer(serializers.ModelSerializer):
    tokens_ahead           = serializers.SerializerMethodField()
    estimated_wait_minutes = serializers.SerializerMethodField()
    current_token          = serializers.SerializerMethodField()
    avg_consult_minutes    = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "token_number", "session", "booking_date",
            "status", "is_confirmed",
            "current_token", "tokens_ahead", "estimated_wait_minutes",
            "avg_consult_minutes",
            "consulting_started_at",
        ]

    def get_current_token(self, obj):
        current = Booking.objects.filter(
            doctor=obj.doctor,
            booking_date=obj.booking_date,
            session=obj.session,
            status=BookingStatus.CONSULTING,
        ).first()
        return current.token_number if current else 0

    def get_tokens_ahead(self, obj):
        return Booking.objects.filter(
            doctor=obj.doctor,
            booking_date=obj.booking_date,
            session=obj.session,
            status__in=[BookingStatus.WAITING, BookingStatus.CONSULTING],
            is_confirmed=True,
            queue_insert_time__lt=obj.queue_insert_time or now(),
        ).count()

    def get_estimated_wait_minutes(self, obj):
        return self.get_tokens_ahead(obj) * self.get_avg_consult_minutes(obj)

    def get_avg_consult_minutes(self, obj):
        try:
            opd_day = OPDDay.objects.get(doctor=obj.doctor, date=obj.booking_date)
            return opd_day.avg_consult_minutes
        except OPDDay.DoesNotExist:
            return 7
