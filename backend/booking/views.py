from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from django.utils.timezone import now
from django.db import transaction

from .models import District, Hospital, Department, Booking, OPDSession
from .serializers import (
    DistrictSerializer,
    HospitalSerializer,
    DepartmentSerializer,
    BookingSerializer,
    BookingHistorySerializer
)

from accounts.models import Patient


# =========================================
# DISTRICT LIST
# =========================================
@api_view(["GET"])
@permission_classes([AllowAny])
def district_list(request):
    districts = District.objects.all()
    serializer = DistrictSerializer(districts, many=True)
    return Response(serializer.data)


# =========================================
# HOSPITAL LIST
# =========================================
@api_view(["GET"])
@permission_classes([AllowAny])
def hospital_list(request):

    district_id = request.GET.get("district_id")

    if not district_id:
        return Response({"error": "district_id required"}, status=400)

    hospitals = Hospital.objects.filter(district_id=district_id)
    serializer = HospitalSerializer(hospitals, many=True)

    return Response(serializer.data)


# =========================================
# DEPARTMENT LIST
# =========================================
@api_view(["GET"])
@permission_classes([AllowAny])
def department_list(request):

    hospital_id = request.GET.get("hospital_id")

    if not hospital_id:
        return Response({"error": "hospital_id required"}, status=400)

    departments = Department.objects.filter(hospital_id=hospital_id)
    serializer = DepartmentSerializer(departments, many=True)

    return Response(serializer.data)


# =========================================
# OPD SESSION LIST
# =========================================
@api_view(["GET"])
@permission_classes([AllowAny])
def opd_sessions(request):

    sessions = [
        {"value": s[0], "label": s[1]}
        for s in OPDSession.choices
    ]

    return Response(sessions)


# =========================================
# AVAILABLE TOKENS
# =========================================
@api_view(["GET"])
@permission_classes([AllowAny])
def available_tokens(request):

    department_id = request.GET.get("department_id")
    session = request.GET.get("session")
    booking_date = request.GET.get("booking_date")

    if not department_id or not session or not booking_date:
        return Response({"error": "Missing parameters"}, status=400)

    MAX_TOKENS = 20

    booked = Booking.objects.filter(
        department_id=department_id,
        session=session,
        booking_date=booking_date
    ).count()

    return Response({
        "max_tokens": MAX_TOKENS,
        "booked": booked,
        "available": max(0, MAX_TOKENS - booked)
    })


# =========================================
# BOOK TOKEN
# =========================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def book_token(request):

    serializer = BookingSerializer(
        data=request.data,
        context={"request": request}
    )

    if serializer.is_valid():
        booking = serializer.save()

        return Response(
            BookingSerializer(booking).data,
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=400)


# =========================================
# BOOKING HISTORY
# =========================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def booking_history(request):

    patient = Patient.objects.get(user=request.user)

    bookings = Booking.objects.filter(
        patient=patient
    ).order_by("-created_at")

    serializer = BookingHistorySerializer(bookings, many=True)

    return Response(serializer.data)


# =========================================
# CANCEL BOOKING
# =========================================
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def cancel_booking(request, booking_id):

    patient = Patient.objects.get(user=request.user)

    try:
        booking = Booking.objects.get(
            id=booking_id,
            patient=patient
        )

        booking.delete()

        return Response({"message": "Booking cancelled successfully"})

    except Booking.DoesNotExist:
        return Response({"error": "Booking not found"}, status=404)


# =========================================
# DOCTOR CALL NEXT TOKEN
# =========================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def call_next_token(request):

    department_id = request.data.get("department_id")
    session = request.data.get("session")
    booking_date = request.data.get("booking_date")

    if not department_id or not session or not booking_date:
        return Response({"error": "Missing parameters"}, status=400)

    with transaction.atomic():

        # Finish current token
        current = Booking.objects.select_for_update().filter(
            department_id=department_id,
            session=session,
            booking_date=booking_date,
            status="calling"
        ).first()

        if current:
            current.status = "completed"
            current.save()

        # Call next token
        next_token = Booking.objects.select_for_update().filter(
            department_id=department_id,
            session=session,
            booking_date=booking_date,
            status="waiting"
        ).order_by("token_number").first()

        if next_token:
            next_token.status = "calling"
            next_token.called_at = now()
            next_token.save()

            return Response({
                "token": next_token.token_number,
                "patient": next_token.patient.user.username
            })

        return Response({"message": "No more tokens"})


# =========================================
# OPD DISPLAY SCREEN
# =========================================
@api_view(["GET"])
@permission_classes([AllowAny])
def opd_display(request):

    department_id = request.GET.get("department_id")
    session = request.GET.get("session")
    booking_date = request.GET.get("booking_date")

    if not department_id or not session or not booking_date:
        return Response({"error": "Missing parameters"}, status=400)

    current = Booking.objects.filter(
        department_id=department_id,
        session=session,
        booking_date=booking_date,
        status="calling"
    ).first()

    next_tokens = Booking.objects.filter(
        department_id=department_id,
        session=session,
        booking_date=booking_date,
        status="waiting"
    ).order_by("token_number")[:4]

    return Response({
        "current_token": current.token_number if current else None,
        "next_tokens": [t.token_number for t in next_tokens]
    })


# =========================================
# PATIENT QUEUE STATUS
# =========================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def patient_queue_status(request):

    patient = Patient.objects.get(user=request.user)

    booking = Booking.objects.filter(
        patient=patient,
        status__in=["waiting", "calling"]
    ).order_by("-created_at").first()

    if not booking:
        return Response({"message": "No active booking"})

    current = Booking.objects.filter(
        department=booking.department,
        session=booking.session,
        booking_date=booking.booking_date,
        status="calling"
    ).first()

    tokens_ahead = Booking.objects.filter(
        department=booking.department,
        session=booking.session,
        booking_date=booking.booking_date,
        status="waiting",
        token_number__lt=booking.token_number
    ).count()

    return Response({
        "your_token": booking.token_number,
        "status": booking.status,
        "current_token": current.token_number if current else None,
        "tokens_ahead": tokens_ahead
    })
