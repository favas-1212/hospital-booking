from django.contrib import admin
from .models import District, Hospital, Department, Booking, OPDDay


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display  = ["id", "name"]
    search_fields = ["name"]


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display  = ["id", "name", "district", "address"]
    search_fields = ["name"]
    list_filter   = ["district"]


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display  = ["id", "name", "hospital"]
    search_fields = ["name"]
    list_filter   = ["hospital"]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "token_number", "display_name", "doctor",
        "session", "booking_date", "status", "payment_status",
        "is_confirmed", "is_walkin", "two_ahead_notified",
    ]
    list_filter   = ["status", "payment_status", "session", "booking_date", "is_confirmed"]
    search_fields = ["walkin_name", "patient__user__username", "patient__user__first_name", "doctor__full_name"]
    readonly_fields = [
        "created_at", "consulting_started_at", "consulting_ended_at",
        "confirmation_time", "queue_insert_time", "consulting_duration_minutes",
    ]
    fieldsets = (
        ("Relationships", {
            "fields": ("doctor", "patient", "walkin_name"),
        }),
        ("Booking Details", {
            "fields": ("session", "booking_date", "token_number"),
        }),
        ("Status", {
            "fields": ("status", "payment_status"),
        }),
        ("Confirmation", {
            "fields": ("is_confirmed", "confirmation_time", "queue_insert_time"),
        }),
        ("Timing", {
            "fields": (
                "consulting_started_at", "consulting_ended_at",
                "consulting_duration_minutes", "created_at",
            ),
        }),
        ("Notification Flags", {
            "fields": ("reminder_sent", "ticket_sent", "near_queue_notified", "two_ahead_notified"),
        }),
    )


@admin.register(OPDDay)
class OPDDayAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "doctor", "date", "session",
        "is_active", "is_paused", "pause_reason",
        "started_at", "ended_at", "avg_consult_minutes",
    ]
    list_filter   = ["is_active", "is_paused", "session", "date"]
    search_fields = ["doctor__full_name"]
    readonly_fields = ["started_at", "ended_at", "paused_at"]
    fieldsets = (
        ("Identity", {
            "fields": ("doctor", "date", "session"),
        }),
        ("Lifecycle", {
            "fields": ("is_active", "started_at", "ended_at"),
        }),
        ("Pause", {
            "fields": ("is_paused", "paused_at", "pause_reason"),
        }),
        ("Stats", {
            "fields": ("avg_consult_minutes", "confirmation_prompt_sent"),
        }),
    )