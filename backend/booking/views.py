from rest_framework.decorators import api_view,permission_classes
from rest_framework.response import Response
from .models import OPDSession, Booking,Department,District,Hospital
from django.utils.timezone import now
from .serializers import BookingSerializer, DepartmentSerializer, HospitalSerializer, DistrictSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from rest_framework.permissions import AllowAny

@api_view(['GET'])
@permission_classes([AllowAny])
def opd_sessions(request):
    return Response([
        {
            "key": choice[0],
            "label": choice[1]
        }
        for choice in OPDSession.choices
    ])

@api_view(['GET'])
@permission_classes([AllowAny])
def available_tokens(request):
    department_id = request.GET.get('department')
    session = request.GET.get('session')

    TOTAL_TOKENS = 12

    booked_tokens = Booking.objects.filter(
        department_id=department_id,
        session=session,
        booking_date=now().date()
    ).values_list('token_number', flat=True)

    available = [
        token for token in range(1, TOTAL_TOKENS + 1)
        if token not in booked_tokens
    ]

    return Response({
        "available_tokens": available
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def book_token(request):
    if not hasattr(request.user, "patient"):
        return Response({"error": "Only patients can book"}, status=403)

    serializer = BookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    serializer.save(patient=request.user.patient)
    return Response({"message": "Token booked successfully"}, status=201)


@api_view(['GET'])
@permission_classes([AllowAny])
def district_list(request):
    districts = District.objects.all()
    serializer = DistrictSerializer(districts, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def hospital_list(request):
    district_id = request.GET.get('district')

    hospitals = Hospital.objects.all()
    if district_id:
        hospitals = hospitals.filter(district_id=district_id)

    serializer = HospitalSerializer(hospitals, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def department_list(request):
    hospital_id = request.GET.get('hospital')

    departments = Department.objects.all()
    if hospital_id:
        departments = departments.filter(hospital_id=hospital_id)

    serializer = DepartmentSerializer(departments, many=True)
    return Response(serializer.data)





import razorpay
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response



@api_view(['POST'])
@permission_classes([AllowAny])
def create_payment_order(request):
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    amount = request.data.get("amount")
    if not amount:
        return Response({"error": "Amount is required"}, status=400)

    try:
        order = client.order.create({
            "amount": amount,
            "currency": "INR",
            "payment_capture": 1
        })
        return Response({
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"]
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)
