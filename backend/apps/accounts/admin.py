from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import ClientProfile, ClientUser, ProfessionalUser, User, UserRole


class ClientProfileInline(admin.StackedInline):
    model = ClientProfile
    can_delete = False
    verbose_name_plural = "Datos de perfil de cliente"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "city", "is_active")
    list_filter = ("role", "is_active", "is_staff", "city")
    search_fields = ("email", "first_name", "last_name", "phone")
    ordering = ("email",)
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Serviprox", {"fields": ("role", "phone", "city", "address", "document_id", "is_identity_verified")}),
    )


@admin.register(ClientProfile)
class ClientProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "preferred_payment_method", "emergency_contact_name", "emergency_contact_phone", "created_at")
    search_fields = ("user__email", "user__first_name", "user__last_name", "emergency_contact_name")
    list_filter = ("preferred_payment_method", "created_at")


@admin.register(ClientUser)
class ClientUserAdmin(admin.ModelAdmin):
    list_display = ("email", "first_name", "last_name", "phone", "city", "address", "is_active")
    search_fields = ("email", "first_name", "last_name", "phone", "city")
    list_filter = ("city", "is_active")
    inlines = [ClientProfileInline]

    def get_queryset(self, request):
        return super().get_queryset(request).filter(role=UserRole.CLIENT)


@admin.register(ProfessionalUser)
class ProfessionalUserAdmin(admin.ModelAdmin):
    list_display = ("email", "first_name", "last_name", "phone", "city", "is_identity_verified", "is_active")
    search_fields = ("email", "first_name", "last_name", "phone", "city")
    list_filter = ("city", "is_identity_verified", "is_active")

    def get_queryset(self, request):
        return super().get_queryset(request).filter(role=UserRole.PROFESSIONAL)

