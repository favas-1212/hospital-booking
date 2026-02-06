from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import OPDSession

@api_view(['GET'])
def opd_sessions(request):
    return Response([
        {
            "key": choice[0],
            "label": choice[1]
        }
        for choice in OPDSession.choices
    ])

@api_view(['GET'])
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
def book_token(request):
    serializer = BookingSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    serializer.save()
    return Response({"message": "Token booked successfully"}, status=201)


