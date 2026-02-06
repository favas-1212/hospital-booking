
from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from twilio.rest import Client
from .models import Patient, OPDStaff, Doctor
from .serializers import (
    PatientSerializer,
    OPDStaffSerializer,
    DoctorSerializer
)

# ========================= PATIENT =========================
class PatientView(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer

    def get_permissions(self):
        if self.action in ["create", "verify_otp", "resend_otp", "login"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    # Register Patient + Send OTP
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = serializer.save()

        try:
            client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN
            )
            client.verify.v2.services(
                settings.TWILIO_VERIFY_SERVICE_SID
            ).verifications.create(
                to=patient.phone,
                channel="sms"
            )
        except Exception:
            return Response(
                {"error": "OTP service unavailable"},
                status=500
            )

        return Response(
            {"message": "OTP sent successfully"},
            status=201
        )
    
        # ---------------- Patient Login (Username + Password) ----------------
    @action(detail=False, methods=["post"])
    def login(self, request):
        user = authenticate(
        username=request.data.get("username"),
        password=request.data.get("password")
        )

        if not user or not hasattr(user, "patient"):
            return Response({"error": "Invalid credentials"}, status=401)

        if not user.patient.otp_verified:
            return Response({"error": "OTP not verified"}, status=403)

        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "token": token.key,
            "role": "patient"
        })


    # Resend OTP
    @action(detail=False, methods=["post"])
    def resend_otp(self, request):
        phone = request.data.get("phone")
        if not phone:
            return Response({"error": "Phone required"}, status=400)

        client = Client(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN
        )

        client.verify.v2.services(
            settings.TWILIO_VERIFY_SERVICE_SID
        ).verifications.create(
            to=phone,
            channel="sms"
        )

        return Response({"message": "OTP resent"})

    # Verify OTP + Token
    @action(detail=False, methods=["post"])
    def verify_otp(self, request):
        phone = request.data.get("phone")
        otp = request.data.get("otp")

        if not phone or not otp:
            return Response(
                {"error": "Phone and OTP required"},
                status=400
            )

        patient = Patient.objects.filter(phone=phone).first()
        if not patient:
            return Response({"error": "Patient not found"}, status=404)

        client = Client(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN
        )

        verification = client.verify.v2.services(
            settings.TWILIO_VERIFY_SERVICE_SID
        ).verification_checks.create(
            to=phone,
            code=otp
        )

        if verification.status != "approved":
            return Response({"error": "Invalid OTP"}, status=400)

        patient.otp_verified = True
        patient.save()

        token, _ = Token.objects.get_or_create(user=patient.user)

        return Response({
            "token": token.key,
            "role": "patient"
        })


# ========================= OPD STAFF =========================
class OPDStaffView(viewsets.ModelViewSet):
    queryset = OPDStaff.objects.all()
    serializer_class = OPDStaffSerializer

    def get_permissions(self):
        if self.action in ["create", "login"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    # OPD Login
    @action(detail=False, methods=["post"])
    def login(self, request):
        user = authenticate(
            username=request.data.get("username"),
            password=request.data.get("password")
        )

        if not user or not hasattr(user, "opdstaff"):
            return Response(
                {"error": "Invalid OPD credentials"},
                status=401
            )

        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "token": token.key,
            "role": "opd"
        })


# ========================= DOCTOR =========================
class DoctorView(viewsets.ModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer

    def get_permissions(self):
        if self.action in ["create", "login"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    # Doctor Login
    @action(detail=False, methods=["post"])
    def login(self, request):
        user = authenticate(
            username=request.data.get("username"),
            password=request.data.get("password")
        )

        if not user or not hasattr(user, "doctor"):
            return Response(
                {"error": "Invalid doctor credentials"},
                status=401
            )

        doctor = user.doctor
        if not doctor.is_approved:
            return Response(
                {"error": "Doctor not approved"},
                status=403
            )

        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "token": token.key,
            "role": "doctor"
        })

    # OPD approves Doctor
    @action(detail=True, methods=["patch"])
    def approve(self, request, pk=None):
        if not hasattr(request.user, "opdstaff"):
            return Response(
                {"error": "Only OPD can approve doctors"},
                status=403
            )

        doctor = self.get_object()
        doctor.is_approved = True
        doctor.save()

        return Response({"message": "Doctor approved"})
