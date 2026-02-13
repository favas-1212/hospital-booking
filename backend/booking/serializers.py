from rest_framework import serializers
from django.utils.timezone import now
from datetime import timedelta
from django.db import transaction

from .models import District, Hospital, Department, Booking, OPDSession
from accounts.models import Patient


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

class BookingSerializer(serializers.ModelSerializer):

    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        source="department",
        write_only=True
    )

    token_number = serializers.IntegerField(read_only=True)

    payment_status = serializers.CharField(read_only=True)

    created_at = serializers.DateTimeField(read_only=True)


    class Meta:

        model = Booking

        fields = [
            "id",
            "department_id",
            "session",
            "booking_date",
            "token_number",
            "payment_status",
            "created_at"
        ]


    # =========================
    # VALIDATION
    # =========================

    def validate(self, data):

        request = self.context["request"]
        patient = Patient.objects.get(user=request.user)

        booking_date = data.get("booking_date")

        today = now().date()
        last_date = today + timedelta(days=7)

        # ❌ past date
        if booking_date < today:
            raise serializers.ValidationError(
                "Cannot book past dates"
            )

        # ❌ beyond 7 days
        if booking_date > last_date:
            raise serializers.ValidationError(
                "Booking allowed only next 7 days"
            )

        # ❌ already booked same day
        if Booking.objects.filter(
            patient=patient,
            booking_date=booking_date
        ).exists():

            raise serializers.ValidationError(
                "You already booked a token for this date"
            )

        return data


    # =========================
    # CREATE BOOKING
    # =========================

    MAX_TOKENS_PER_SESSION = 20


    @transaction.atomic
    def create(self, validated_data):

        request = self.context["request"]

        patient = Patient.objects.get(user=request.user)

        department = validated_data["department"]

        session = validated_data["session"]

        booking_date = validated_data["booking_date"]


        # count existing bookings safely
        existing = Booking.objects.select_for_update().filter(
            department=department,
            session=session,
            booking_date=booking_date
        ).count()


        # ❌ session full
        if existing >= self.MAX_TOKENS_PER_SESSION:

            raise serializers.ValidationError(
                f"Session full. Only {self.MAX_TOKENS_PER_SESSION} tokens allowed"
            )


        token_number = existing + 1


        booking = Booking.objects.create(

            patient=patient,

            department=department,

            session=session,

            booking_date=booking_date,

            token_number=token_number,

            payment_status="pending"
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
