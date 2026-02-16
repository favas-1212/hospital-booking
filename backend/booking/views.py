from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from rest_framework.decorators import permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status


from django.utils.timezone import now
from datetime import timedelta

from .models import (
    District,
    Hospital,
    Department,
    Booking,
    OPDSession
)

from .serializers import (
    DistrictSerializer,
    HospitalSerializer,
    DepartmentSerializer,
    BookingSerializer,
    BookingHistorySerializer
)

from accounts.models import Patient


# ====================================
# DISTRICT LIST
# ====================================
@api_view(["GET"])
def district_list(request):

    districts = District.objects.all()

    serializer = DistrictSerializer(
        districts,
        many=True
    )

    return Response(serializer.data)


# ====================================
# HOSPITAL LIST
# ====================================
@api_view(["GET"])
def hospital_list(request):

    district_id = request.GET.get("district_id")

    hospitals = Hospital.objects.filter(
        district_id=district_id
    )

    serializer = HospitalSerializer(
        hospitals,
        many=True
    )

    return Response(serializer.data)


# ====================================
# DEPARTMENT LIST
# ====================================
@api_view(["GET"])
def department_list(request):

    hospital_id = request.GET.get("hospital_id")

    departments = Department.objects.filter(
        hospital_id=hospital_id
    )

    serializer = DepartmentSerializer(
        departments,
        many=True
    )

    return Response(serializer.data)


# ====================================
# OPD SESSION LIST
# ====================================
@api_view(["GET"])
def opd_sessions(request):

    sessions = []

    for session in OPDSession.choices:

        sessions.append(
            {
                "value": session[0],
                "label": session[1]
            }
        )

    return Response(sessions)


# ====================================
# AVAILABLE TOKENS
# ====================================
@api_view(["GET"])
def available_tokens(request):

    department_id = request.GET.get("department_id")

    session = request.GET.get("session")

    booking_date = request.GET.get("booking_date")

    MAX_TOKENS = 20

    booked = Booking.objects.filter(
        department_id=department_id,
        session=session,
        booking_date=booking_date
    ).count()

    return Response({

        "max_tokens": MAX_TOKENS,

        "booked": booked,

        "available": MAX_TOKENS - booked

    })


# ====================================
# BOOK TOKEN
# ====================================
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

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


# ====================================
# BOOKING HISTORY
# ====================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def booking_history(request):

    patient = Patient.objects.get(
        user=request.user
    )

    bookings = Booking.objects.filter(
        patient=patient
    ).order_by("-created_at")

    serializer = BookingHistorySerializer(
        bookings,
        many=True
    )

    return Response(serializer.data)


# ====================================
# CANCEL BOOKING
# ====================================
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def cancel_booking(request, booking_id):

    patient = Patient.objects.get(
        user=request.user
    )

    try:

        booking = Booking.objects.get(
            id=booking_id,
            patient=patient
        )

        booking.delete()

        return Response({

            "message": "Booking cancelled successfully"

        })

    except Booking.DoesNotExist:

        return Response({

            "error": "Booking not found"

        }, status=404)
