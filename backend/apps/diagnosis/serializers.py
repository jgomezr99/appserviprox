from django.db import transaction
from rest_framework import serializers

from apps.catalog.serializers import ServiceCategoryListSerializer

from .engine import suggest_category
from .models import (
    DiagnosticAnswer,
    DiagnosticOption,
    DiagnosticQuestion,
    DiagnosticSession,
)


class DiagnosticOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiagnosticOption
        fields = ["id", "value", "label", "order"]


class DiagnosticQuestionSerializer(serializers.ModelSerializer):
    options = DiagnosticOptionSerializer(many=True, read_only=True)

    class Meta:
        model = DiagnosticQuestion
        fields = ["id", "code", "text", "help_text", "order", "is_required", "options"]


class DiagnosticAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiagnosticAnswer
        fields = ["question", "option", "free_text"]


class DiagnosticSessionSerializer(serializers.ModelSerializer):
    answers = DiagnosticAnswerSerializer(many=True, read_only=True)
    suggested_category = ServiceCategoryListSerializer(read_only=True)

    class Meta:
        model = DiagnosticSession
        fields = [
            "id",
            "description",
            "status",
            "household",
            "suggested_category",
            "confidence",
            "rationale",
            "ranking",
            "answers",
            "created_at",
        ]
        read_only_fields = fields


class DiagnosticSessionCreateSerializer(serializers.ModelSerializer):
    """Recibe la descripcion y las respuestas, y devuelve la sugerencia."""

    answers = DiagnosticAnswerSerializer(many=True, required=False)

    class Meta:
        model = DiagnosticSession
        fields = ["description", "household", "answers"]

    def validate_description(self, value: str) -> str:
        if len(value.strip()) < 5:
            raise serializers.ValidationError(
                "Cuentanos un poco mas: al menos 5 caracteres."
            )
        return value.strip()

    @transaction.atomic
    def create(self, validated_data):
        answers = validated_data.pop("answers", [])
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        session = DiagnosticSession.objects.create(user=user, **validated_data)
        DiagnosticAnswer.objects.bulk_create(
            DiagnosticAnswer(session=session, **answer) for answer in answers
        )

        option_ids = [a["option"].id for a in answers if a.get("option")]
        suggestion = suggest_category(session.description, option_ids)

        session.suggested_category = suggestion.category
        session.confidence = suggestion.confidence
        session.rationale = suggestion.rationale
        session.ranking = suggestion.ranking
        session.status = DiagnosticSession.Status.SUGGESTED
        session.save(
            update_fields=[
                "suggested_category",
                "confidence",
                "rationale",
                "ranking",
                "status",
            ]
        )
        return session

    def to_representation(self, instance):
        return DiagnosticSessionSerializer(instance, context=self.context).data
