from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DistrictViewSet, HospitalViewSet, DepartmentViewSet, BookingViewSet

router = DefaultRouter()
router.register(r'districts', DistrictViewSet)
router.register(r'hospitals', HospitalViewSet)
router.register(r'departments', DepartmentViewSet)
router.register(r'bookings', BookingViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
