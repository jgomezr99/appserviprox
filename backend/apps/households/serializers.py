from rest_framework import serializers

from .models import Household


class HouseholdSerializer(serializers.ModelSerializer):
    short_location = serializers.CharField(read_only=True)

    class Meta:
        model = Household
        fields = [
            "id",
            "label",
            "property_type",
            "address_line",
            "neighborhood",
            "city",
            "country",
            "latitude",
            "longitude",
            "area_m2",
            "build_year",
            "notes",
            "is_default",
            "short_location",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
