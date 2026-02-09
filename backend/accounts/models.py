from django.db import models

# Create your models here.
from django.db import models
from django.contrib.auth.models import User


class BaseProfile(models.Model):
    """
    Abstract base model for common fields
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    phone = models.CharField(max_length=15)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class OPDStaff(BaseProfile):
    """
    OPD staff who can approve doctors
    """
    hospital_name = models.CharField(max_length=200)
    department = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.hospital_name} - OPD"


class Doctor(BaseProfile):
    """
    Doctor account, requires OPD approval
    """
    full_name = models.CharField(max_length=100)
    department = models.CharField(max_length=100)
    is_approved = models.BooleanField(default=False)

    def __str__(self):
        return self.full_name


class Patient(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    otp_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.full_name