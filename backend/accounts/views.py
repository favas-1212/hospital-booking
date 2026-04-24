from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
import random
from django.core.cache import cache
from django.core.mail import send_mail
from .models import Patient, OPDStaff, Doctor
from .serializers import (
    PatientSerializer,
    OPDStaffSerializer,
    DoctorSerializer,
    PasswordResetSerializer,
)


# ========================= PATIENT =========================
class PatientView(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer

    def get_permissions(self):
        if self.action in [
            "create",
            "verify_otp",
            "resend_otp",
            "login",
            "forgot_password",
            "verify_reset_otp",
        ]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    # ---------------- Register ----------------
    def create(self, request, *args, **kwargs):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email required"}, status=400)

        if Patient.objects.filter(user__email=email).exists():
            return Response({"error": "Email already registered"}, status=400)

        otp = str(random.randint(100000, 999999))

        cache.set(f"patient_register_{email}", request.data, timeout=300)
        cache.set(f"patient_otp_{email}", otp, timeout=300)

        send_mail(
            "Your OTP Verification",
            f"Your OTP is {otp}",
            settings.EMAIL_HOST_USER,
            [email],
            fail_silently=False,
        )

        return Response({"message": "OTP sent to email"})

    # ---------------- Verify OTP ----------------
    @action(detail=False, methods=["post"])
    def verify_otp(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        stored_otp = cache.get(f"patient_otp_{email}")
        user_data = cache.get(f"patient_register_{email}")

        if not stored_otp or not user_data:
            return Response({"error": "OTP expired or registration not found"}, status=400)
        if stored_otp != otp:
            return Response({"error": "Invalid OTP"}, status=400)

        serializer = self.get_serializer(data=user_data)
        serializer.is_valid(raise_exception=True)
        patient = serializer.save()
        patient.otp_verified = True
        patient.save()

        cache.delete(f"patient_otp_{email}")
        cache.delete(f"patient_register_{email}")

        token, _ = Token.objects.get_or_create(user=patient.user)

        return Response({
            "token": token.key,
            "message": "Registration successful",
            "otp_verified": True,
        })

    # ---------------- Resend OTP ----------------
    @action(detail=False, methods=["post"])
    def resend_otp(self, request):
        email = request.data.get("email")
        user_data = cache.get(f"patient_register_{email}")

        if not user_data:
            return Response({"error": "Registration expired"}, status=400)

        otp = str(random.randint(100000, 999999))
        cache.set(f"patient_otp_{email}", otp, timeout=300)

        send_mail(
            "Resend OTP",
            f"Your OTP is {otp}",
            settings.EMAIL_HOST_USER,
            [email],
            fail_silently=False,
        )

        return Response({"message": "OTP resent successfully"})

    # ---------------- Login ----------------
    @action(detail=False, methods=["post"])
    def login(self, request):
        user = authenticate(
            username=request.data.get("username"),
            password=request.data.get("password"),
        )

        if not user or not hasattr(user, "patient"):
            return Response({"error": "Invalid credentials"}, status=401)

        if not user.patient.otp_verified:
            return Response({"error": "OTP not verified"}, status=403)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "role": "patient"})

    # ---------------- Forgot Password ----------------
    @action(detail=False, methods=["post"])
    def forgot_password(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email required"}, status=400)

        if not Patient.objects.filter(user__email=email).exists():
            return Response({"error": "Email not registered"}, status=400)

        otp = str(random.randint(100000, 999999))
        cache.set(f"patient_reset_{email}", otp, timeout=300)

        send_mail(
            "Password Reset OTP",
            f"Your OTP for password reset is: {otp}\n\nThis OTP is valid for 5 minutes.",
            settings.EMAIL_HOST_USER,
            [email],
            fail_silently=False,
        )

        return Response({"message": "OTP sent to email"})

    # ---------------- Verify Reset OTP ----------------
    @action(detail=False, methods=["post"])
    def verify_reset_otp(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")
        new_password = request.data.get("new_password")

        if not all([email, otp, new_password]):
            return Response({"error": "Email, OTP, and new password required"}, status=400)

        stored_otp = cache.get(f"patient_reset_{email}")
        if not stored_otp or stored_otp != otp:
            return Response({"error": "Invalid or expired OTP"}, status=400)

        serializer = PasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            patient = Patient.objects.get(user__email=email)
            patient.user.set_password(new_password)
            patient.user.save()
            cache.delete(f"patient_reset_{email}")
            return Response({"message": "Password reset successful"})
        except Patient.DoesNotExist:
            return Response({"error": "User not found"}, status=404)


# ========================= OPD STAFF =========================
class OPDStaffView(viewsets.ModelViewSet):
    queryset = OPDStaff.objects.all()
    serializer_class = OPDStaffSerializer

    def get_permissions(self):
        if self.action in ["create", "login", "forgot_password", "verify_reset_otp"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    # 🔒 Limit data visibility
    def get_queryset(self):
        user = self.request.user

        # Anonymous users hitting public actions (create/login/forgot_password/etc.)
        # must not crash on get_queryset — return an empty queryset for them.
        if not user.is_authenticated:
            return OPDStaff.objects.none()

        if hasattr(user, "opdstaff"):
            # OPD can only see staff from same hospital
            return OPDStaff.objects.filter(hospital=user.opdstaff.hospital)

        return OPDStaff.objects.none()

    # ---------------- OPD LOGIN ----------------
    @action(detail=False, methods=["post"])
    def login(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)

        if not user or not hasattr(user, "opdstaff"):
            return Response(
                {"error": "Invalid OPD credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token, _ = Token.objects.get_or_create(user=user)
        opd = user.opdstaff

        return Response({
            "token": token.key,
            "role": "opd",
            "opd_id": opd.id,
            "hospital_id": opd.hospital.id,
        })

    # ---------------- Forgot Password ----------------
    @action(detail=False, methods=["post"])
    def forgot_password(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email required"}, status=400)

        if not OPDStaff.objects.filter(user__email=email).exists():
            return Response({"error": "Email not registered"}, status=400)

        otp = str(random.randint(100000, 999999))
        cache.set(f"opdstaff_reset_{email}", otp, timeout=300)

        send_mail(
            "Password Reset OTP",
            f"Your OTP for password reset is: {otp}\n\nThis OTP is valid for 5 minutes.",
            settings.EMAIL_HOST_USER,
            [email],
            fail_silently=False,
        )

        return Response({"message": "OTP sent to email"})

    # ---------------- Verify Reset OTP ----------------
    @action(detail=False, methods=["post"])
    def verify_reset_otp(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")
        new_password = request.data.get("new_password")

        if not all([email, otp, new_password]):
            return Response({"error": "Email, OTP, and new password required"}, status=400)

        stored_otp = cache.get(f"opdstaff_reset_{email}")
        if not stored_otp or stored_otp != otp:
            return Response({"error": "Invalid or expired OTP"}, status=400)

        serializer = PasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            opd_staff = OPDStaff.objects.get(user__email=email)
            opd_staff.user.set_password(new_password)
            opd_staff.user.save()
            cache.delete(f"opdstaff_reset_{email}")
            return Response({"message": "Password reset successful"})
        except OPDStaff.DoesNotExist:
            return Response({"error": "User not found"}, status=404)


# ========================= DOCTOR =========================
class DoctorView(viewsets.ModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer

    def get_permissions(self):
        if self.action in ["create", "login", "forgot_password", "verify_reset_otp"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    # ---------------- DOCTOR LOGIN ----------------
    @action(detail=False, methods=["post"])
    def login(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)

        if not user or not hasattr(user, "doctor"):
            return Response(
                {"error": "Invalid doctor credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        doctor = user.doctor

        if not doctor.is_approved:
            return Response(
                {"error": "Doctor not approved"},
                status=status.HTTP_403_FORBIDDEN,
            )

        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "token": token.key,
            "role": "doctor",
            "doctor_id": doctor.id,
            "hospital_id": doctor.hospital.id,
        })

    # ---------------- Forgot Password ----------------
    @action(detail=False, methods=["post"])
    def forgot_password(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email required"}, status=400)

        if not Doctor.objects.filter(user__email=email).exists():
            return Response({"error": "Email not registered"}, status=400)

        otp = str(random.randint(100000, 999999))
        cache.set(f"doctor_reset_{email}", otp, timeout=300)

        send_mail(
            "Password Reset OTP",
            f"Your OTP for password reset is: {otp}\n\nThis OTP is valid for 5 minutes.",
            settings.EMAIL_HOST_USER,
            [email],
            fail_silently=False,
        )

        return Response({"message": "OTP sent to email"})

    # ---------------- Verify Reset OTP ----------------
    @action(detail=False, methods=["post"])
    def verify_reset_otp(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")
        new_password = request.data.get("new_password")

        if not all([email, otp, new_password]):
            return Response({"error": "Email, OTP, and new password required"}, status=400)

        stored_otp = cache.get(f"doctor_reset_{email}")
        if not stored_otp or stored_otp != otp:
            return Response({"error": "Invalid or expired OTP"}, status=400)

        serializer = PasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            doctor = Doctor.objects.get(user__email=email)
            doctor.user.set_password(new_password)
            doctor.user.save()
            cache.delete(f"doctor_reset_{email}")
            return Response({"message": "Password reset successful"})
        except Doctor.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

    # ---------------- APPROVE DOCTOR ----------------
    @action(detail=True, methods=["patch"])
    def approve(self, request, pk=None):
        if not hasattr(request.user, "opdstaff"):
            return Response(
                {"error": "Only OPD staff can approve"},
                status=403,
            )

        opd_staff = request.user.opdstaff
        doctor = self.get_object()

        if doctor.hospital != opd_staff.hospital:
            return Response(
                {"error": "Not your hospital doctor"},
                status=403,
            )

        doctor.is_approved = True
        doctor.save()

        return Response({"message": "Doctor approved successfully"})

    # ---------------- PENDING DOCTORS ----------------
    @action(detail=False, methods=["get"])
    def pending(self, request):
        if not hasattr(request.user, "opdstaff"):
            return Response(
                {"error": "Only OPD staff allowed"},
                status=403,
            )

        opd_staff = request.user.opdstaff

        pending_doctors = Doctor.objects.filter(
            hospital=opd_staff.hospital,
            is_approved=False,
        )

        serializer = self.get_serializer(pending_doctors, many=True)
        return Response(serializer.data)
