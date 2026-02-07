import razorpay
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response

client = razorpay.Client(
    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
)

@api_view(['POST'])
def create_order(request):
    amount = request.data.get("amount")  # in rupees
    booking_id = request.data.get("booking_id")

    razorpay_order = client.order.create({
        "amount": int(amount) * 100,  # convert to paise
        "currency": "INR",
        "payment_capture": 1
    })

    return Response({
        "order_id": razorpay_order["id"],
        "amount": razorpay_order["amount"],
        "key": settings.RAZORPAY_KEY_ID
    })

@api_view(['POST'])
def verify_payment(request):
    data = request.data

    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": data["razorpay_order_id"],
            "razorpay_payment_id": data["razorpay_payment_id"],
            "razorpay_signature": data["razorpay_signature"]
        })

        # Mark booking as confirmed here
        return Response({"status": "Payment successful"})

    except razorpay.errors.SignatureVerificationError:
        return Response({"status": "Payment failed"}, status=400)

