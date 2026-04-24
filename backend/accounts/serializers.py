from rest_framework import serializers
from django.contrib.auth.models import User
from .models import OPDStaff, Doctor, Patient


# ---------------- OPD STAFF ----------------
class OPDStaffSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = OPDStaff
        fields = [
            "id",
            "username",
            "email",
            "password",
            "hospital",   # ✅ correct field
            "phone",
            "created_at"
        ]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        username = validated_data.pop("username")
        email = validated_data.pop("email")
        password = validated_data.pop("password")

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        return OPDStaff.objects.create(user=user, **validated_data)

# ---------------- DOCTOR ----------------
class DoctorSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)
    is_approved = serializers.BooleanField(read_only=True)

    class Meta:
        model = Doctor
        fields = [
            "id",
            "username",
            "email",
            "password",
            "full_name",
            "hospital",      # ✅ added
            "department",
            "phone",
            "is_approved",
            "created_at"
        ]
        read_only_fields = ["id", "is_approved", "created_at"]

    def create(self, validated_data):
        username = validated_data.pop("username")
        email = validated_data.pop("email")
        password = validated_data.pop("password")

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        return Doctor.objects.create(user=user, **validated_data)

# ---------------- PATIENT ----------------
class PatientSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Patient
        fields = [
            "id",
            "username",
            "email",
            "password",
            "full_name",
            "phone"
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        username = validated_data.pop("username")
        email = validated_data.pop("email")
        password = validated_data.pop("password")

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        return Patient.objects.create(user=user, **validated_data)


# ---------------- PASSWORD RESET ----------------
class PasswordResetSerializer(serializers.Serializer):
    """Serializer for password reset OTP verification and password change"""
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        """Validate password strength"""
        if value.isdigit():
            raise serializers.ValidationError("Password cannot be only numbers")
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters")
        return value