from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import ClientProfile, User, UserRole


class ClientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientProfile
        fields = [
            "emergency_contact_name",
            "emergency_contact_phone",
            "preferred_payment_method",
            "service_notes",
            "created_at",
            "updated_at",
        ]


class UserSerializer(serializers.ModelSerializer):
    initials = serializers.CharField(read_only=True)
    client_profile = ClientProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "role",
            "phone",
            "city",
            "document_id",
            "address",
            "avatar_url",
            "initials",
            "is_identity_verified",
            "onboarding_completed",
            "client_profile",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "username",
            "role",
            "initials",
            "is_identity_verified",
            "onboarding_completed",
            "client_profile",
            "created_at",
        ]

    def update(self, instance, validated_data):
        address = validated_data.get("address")
        city = validated_data.get("city")
        instance = super().update(instance, validated_data)

        # Si es cliente, sincronizar su dirección en la base de datos de hogares
        if instance.role == UserRole.CLIENT and (address or city):
            from apps.households.models import Household
            household = Household.objects.filter(owner=instance, is_default=True).first()
            if not household:
                household = Household.objects.filter(owner=instance).first()
            if household:
                if address:
                    household.address_line = address
                if city:
                    household.city = city
                household.save()
            elif address:
                Household.objects.create(
                    owner=instance,
                    label="Mi hogar",
                    address_line=address,
                    city=city or instance.city or "Bogota",
                    neighborhood="Bogotá",
                    latitude=4.6486,
                    longitude=-74.0626,
                    is_default=True,
                )
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(
        choices=(UserRole.CLIENT, UserRole.PROFESSIONAL),
        default=UserRole.CLIENT,
    )

    class Meta:
        model = User
        fields = [
            "email",
            "username",
            "first_name",
            "last_name",
            "phone",
            "city",
            "document_id",
            "address",
            "role",
            "password",
        ]
        extra_kwargs = {"role": {"default": UserRole.CLIENT}}

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Separación y guardado automático en la base de datos según el rol
        if user.role == UserRole.CLIENT:
            ClientProfile.objects.get_or_create(user=user)
            # Crear vivienda por defecto en la base de datos para que pueda solicitar servicios de inmediato
            from apps.households.models import Household
            Household.objects.get_or_create(
                owner=user,
                defaults={
                    "label": "Mi hogar",
                    "address_line": user.address or "Bogotá",
                    "city": user.city or "Bogota",
                    "neighborhood": "Bogotá",
                    "latitude": 4.6486,
                    "longitude": -74.0626,
                    "is_default": True,
                },
            )
        elif user.role == UserRole.PROFESSIONAL:
            from datetime import time
            from django.utils.text import slugify
            from apps.professionals.models import AvailabilitySlot, ProfessionalProfile

            display_name = user.get_full_name() or user.username
            base_slug = slugify(display_name) or "profesional"
            slug = base_slug
            counter = 1
            while ProfessionalProfile.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            prof, created = ProfessionalProfile.objects.get_or_create(
                user=user,
                defaults={
                    "display_name": display_name,
                    "headline": "Profesional de servicios para el hogar",
                    "slug": slug,
                    "city": user.city or "Bogota",
                    "neighborhood": user.address or "Bogotá",
                    "latitude": 4.6486,
                    "longitude": -74.0626,
                    "coverage_radius_km": 15,
                    "is_active": True,
                    "is_verified": False,
                },
            )
            if created or not prof.availability.exists():
                for weekday in range(6):
                    AvailabilitySlot.objects.get_or_create(
                        profile=prof,
                        weekday=weekday,
                        start_time=time(8, 0),
                        end_time=time(18, 0),
                    )

        return user

