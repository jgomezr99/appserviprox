"""Motor de sugerencia del diagnostico guiado.

Reglas explicitas y auditables (no una caja negra): cada opcion aporta pesos
por categoria y el texto libre suma por coincidencia de palabras clave. El
resultado es una *sugerencia*: el cliente siempre puede elegir otra categoria.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from apps.catalog.models import ServiceCategory

from .models import DiagnosticOption

# Peso de una coincidencia de palabra clave en el texto libre frente al peso
# de una opcion elegida explicitamente por el cliente.
KEYWORD_WEIGHT = 2.0


def normalize(text: str) -> str:
    """Minusculas sin tildes, para comparar 'plomería' con 'plomeria'."""
    stripped = unicodedata.normalize("NFKD", text or "")
    stripped = "".join(ch for ch in stripped if not unicodedata.combining(ch))
    return stripped.lower()


@dataclass
class Suggestion:
    category: ServiceCategory | None
    confidence: float
    rationale: str
    ranking: list[dict]


def suggest_category(description: str, option_ids: list[int]) -> Suggestion:
    """Puntua cada categoria activa y devuelve la mejor con su justificacion."""
    categories = list(ServiceCategory.objects.filter(is_active=True))
    scores: dict[str, float] = {c.slug: 0.0 for c in categories}
    reasons: dict[str, list[str]] = {c.slug: [] for c in categories}

    haystack = normalize(description)
    for category in categories:
        for keyword in category.keywords or []:
            needle = normalize(keyword)
            if needle and re.search(rf"\b{re.escape(needle)}\b", haystack):
                scores[category.slug] += KEYWORD_WEIGHT
                reasons[category.slug].append(f"mencionaste «{keyword}»")

    options = DiagnosticOption.objects.filter(id__in=option_ids).select_related("question")
    for option in options:
        for slug, weight in (option.weights or {}).items():
            if slug in scores:
                scores[slug] += float(weight)
                reasons[slug].append(option.label.lower())

    ranking = sorted(
        (
            {
                "slug": category.slug,
                "name": category.name,
                "score": round(scores[category.slug], 2),
            }
            for category in categories
        ),
        key=lambda item: item["score"],
        reverse=True,
    )

    total = sum(item["score"] for item in ranking)
    if not ranking or ranking[0]["score"] <= 0:
        return Suggestion(
            category=None,
            confidence=0.0,
            rationale="No hay senales suficientes; elige la categoria que prefieras.",
            ranking=ranking,
        )

    best = ranking[0]
    category = next(c for c in categories if c.slug == best["slug"])
    confidence = round(best["score"] / total, 2) if total else 0.0
    why = ", ".join(dict.fromkeys(reasons[best["slug"]]))
    return Suggestion(
        category=category,
        confidence=confidence,
        rationale=f"Sugerimos {category.name} porque {why}." if why else f"Sugerimos {category.name}.",
        ranking=ranking,
    )
