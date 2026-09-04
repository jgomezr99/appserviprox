from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "city", "is_active")
    list_filter = ("role", "is_active", "is_staff", "city")
    search_fields = ("email", "first_name", "last_name", "phone")
    ordering = ("email",)
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Serviprox", {"fields": ("role", "phone", "city", "is_identity_verified")}),
    )
