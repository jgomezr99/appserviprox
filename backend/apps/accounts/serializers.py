from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User, UserRole


class UserSerializer(serializers.ModelSerializer):
    initials = serializers.CharField(read_only=True)

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
            "initials",
            "is_identity_verified",
            "onboarding_completed",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "email",
            "username",
            "role",
            "initials",
            "is_identity_verified",
            "onboarding_completed",
            "created_at",
        ]


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
            "role",
            "password",
        ]
        extra_kwargs = {"role": {"default": UserRole.CLIENT}}

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
