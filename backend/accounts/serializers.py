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
            "id", "username", "email", "password",
            "hospital_name", "department", "phone", "created_at"
        ]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data.pop("username"),
            email=validated_data.pop("email"),
            password=validated_data.pop("password"),
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
            "id", "username", "email", "password",
            "full_name", "department", "phone",
            "is_approved", "created_at"
        ]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data.pop("username"),
            email=validated_data.pop("email"),
            password=validated_data.pop("password"),
        )
        return Doctor.objects.create(user=user, **validated_data)


# ---------------- PATIENT ----------------
class PatientSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Patient
        fields = ["username", "email", "password", "full_name", "phone"]

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