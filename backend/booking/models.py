from django.db import models

class District(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Hospital(models.Model):
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="hospitals")
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Department(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class OPDSession(models.TextChoices):
    MORNING = "MORNING", "Morning (10AM - 12PM)"
    EVENING = "EVENING", "Evening (2PM - 5PM)"


class Booking(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    session = models.CharField(max_length=10, choices=OPDSession.choices)
    token_number = models.IntegerField()
    booking_date = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"{self.department.name} - {self.session} Token {self.token_number}"
