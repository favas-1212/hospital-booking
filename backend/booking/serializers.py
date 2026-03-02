from rest_framework import serializers
from django.utils.timezone import now
from datetime import timedelta
from django.db import transaction

from .models import District, Hospital, Department, Booking, OPDSession
from accounts.models import Patient,Doctor


# =========================
# BASIC SERIALIZERS
# =========================




class DistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = ["id", "name"]


class HospitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hospital
        fields = ["id", "name", "district"]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "hospital"]

# =========================
# BOOKING SERIALIZER
# =========================



from rest_framework import serializers
from django.utils.timezone import now
from datetime import timedelta
from django.db import transaction

from .models import Booking
from accounts.models import Patient, Doctor

# =========================
# CONSTANTS
# =========================
MAX_TOKENS_PER_SESSION = 60
ONLINE_TOKEN_START = 16
ONLINE_TOKEN_END = 35
WALKIN_RANGE = list(range(1, ONLINE_TOKEN_START)) + list(range(ONLINE_TOKEN_END + 1, MAX_TOKENS_PER_SESSION + 1))


class BookingSerializer(serializers.ModelSerializer):
    # For online booking (authenticated users)
    doctor_id = serializers.PrimaryKeyRelatedField(
        queryset=Doctor.objects.all(),
        source="doctor",
        write_only=True
    )

    token_number = serializers.IntegerField(read_only=True)
    payment_status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    # Optional walk-in name for offline booking
    patient_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Booking
        fields = [
            "id",
            "doctor_id",
            "session",
            "booking_date",
            "token_number",
            "payment_status",
            "created_at",
            "patient_name",
        ]

    # =========================
    # VALIDATION
    # =========================
    def validate(self, data):
        booking_date = data.get("booking_date")
        today = now().date()
        last_date = today + timedelta(days=7)

        if booking_date < today:
            raise serializers.ValidationError("Cannot book past dates")

        if booking_date > last_date:
            raise serializers.ValidationError("Booking allowed only next 7 days")

        # Determine if online or offline
        request = self.context.get("request")
        walkin_name = data.get("patient_name", None)

        if request and hasattr(request, "user") and request.user.is_authenticated and not walkin_name:
            # Online booking validation
            try:
                patient = Patient.objects.get(user=request.user)
            except Patient.DoesNotExist:
                raise serializers.ValidationError("Only patients can book tokens.")

            # Check if patient already booked on this date
            if Booking.objects.filter(patient=patient, booking_date=booking_date).exists():
                raise serializers.ValidationError("You already booked a token for this date")
        else:
            # Offline booking validation
            if not walkin_name:
                raise serializers.ValidationError("Patient name is required for walk-in booking")

        return data

    # =========================
    # CREATE BOOKING
    # =========================
    @transaction.atomic
    def create(self, validated_data):
        doctor = validated_data["doctor"]
        session = validated_data["session"]
        booking_date = validated_data["booking_date"]
        walkin_name = validated_data.get("patient_name")

        # Determine if online or offline
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated and not walkin_name:
            # ----------------------
            # Online booking (tokens 16-35)
            # ----------------------
            existing_count = Booking.objects.select_for_update().filter(
                doctor=doctor,
                session=session,
                booking_date=booking_date,
                token_number__gte=ONLINE_TOKEN_START,
                token_number__lte=ONLINE_TOKEN_END
            ).count()

            if existing_count >= (ONLINE_TOKEN_END - ONLINE_TOKEN_START + 1):
                raise serializers.ValidationError(
                    f"Online session full. Only {ONLINE_TOKEN_END - ONLINE_TOKEN_START + 1} tokens allowed"
                )

            token_number = ONLINE_TOKEN_START + existing_count
            patient = Patient.objects.get(user=request.user)

            booking = Booking.objects.create(
                patient=patient,
                doctor=doctor,
                session=session,
                booking_date=booking_date,
                token_number=token_number,
                payment_status="pending"
            )

        else:
            # ----------------------
            # Offline walk-in booking (tokens outside 16-35)
            # ----------------------
            existing_tokens = Booking.objects.select_for_update().filter(
                doctor=doctor,
                session=session,
                booking_date=booking_date
            ).values_list("token_number", flat=True)

            # Find first available token in walk-in range
            available_tokens = [t for t in WALKIN_RANGE if t not in existing_tokens]
            if not available_tokens:
                raise serializers.ValidationError("No walk-in tokens available")

            token_number = available_tokens[0]

            booking = Booking.objects.create(
                doctor=doctor,
                session=session,
                booking_date=booking_date,
                token_number=token_number,
                walkin_name=walkin_name,
                payment_status="pending",  # or "paid" if you handle offline payment
                patient=None
            )

        return booking
    
class BookingHistorySerializer(serializers.ModelSerializer):

    department = serializers.CharField(
        source="department.name"
    )

    hospital = serializers.CharField(
        source="department.hospital.name"
    )

    class Meta:

        model = Booking

        fields = [
            "id",
            "hospital",
            "department",
            "session",
            "booking_date",
            "token_number",
            "payment_status",
            "created_at"
        ]


from accounts.models import Doctor
from rest_framework import serializers

class DoctorListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="user.username")

    class Meta:
        model = Doctor
        fields = ["id", "name"]