from rest_framework import serializers
from .models import District, Hospital, Department, Booking

class DistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = ['id', 'name']

class HospitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hospital
        fields = ['id', 'name', 'district']

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'hospital']

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = [ 'department', 'session', 'token_number', 'booking_date']
