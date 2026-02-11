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
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        source='department',  # maps department_id to department FK
        write_only=True
    )

    class Meta:
        model = Booking
        fields = ['department_id', 'session', 'token_number', 'booking_date']
        read_only_fields = ['booking_date']
        
