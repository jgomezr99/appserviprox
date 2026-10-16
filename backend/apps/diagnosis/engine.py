"""Deterministic, explainable suggestions over the active service catalog."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from apps.catalog.models import Service, ServiceCategory

from .models import DiagnosticOption


STOP_WORDS = {
    "a", "al", "algo", "como", "con", "de", "del", "el", "en", "es", "esta",
    "la", "las", "lo", "los", "mi", "me", "necesito", "para", "por", "que",
    "se", "un", "una", "unos", "unas", "y",
}


def normalize(text: str) -> str:
    """Lowercase and remove diacritics so Spanish queries compare consistently."""
    stripped = unicodedata.normalize("NFKD", text or "")
    without_marks = "".join(ch for ch in stripped if not unicodedata.combining(ch))
    return " ".join(without_marks.lower().split())


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", normalize(text))
        if token not in STOP_WORDS
    }


def _contains_phrase(query: str, term: str) -> bool:
    normalized_term = normalize(term)
    return bool(
        normalized_term
        and re.search(rf"(?<!\w){re.escape(normalized_term)}(?!\w)", query)
    )


@dataclass
class Suggestion:
    category: ServiceCategory | None
    service: Service | None
    confidence: float
    rationale: str
    ranking: list[dict]
    service_ranking: list[dict]


def _service_score(query: str, service: Service) -> tuple[float, list[str]]:
    score = 0.0
    matched_terms: list[str] = []
    query_tokens = _tokens(query)

    for keyword in service.keywords or []:
        if not isinstance(keyword, str) or not keyword.strip():
            continue
        keyword_tokens = _tokens(keyword)
        if _contains_phrase(query, keyword):
            score += 6.0
            matched_terms.append(keyword)
        else:
            overlap = query_tokens & keyword_tokens
            if overlap:
                score += 1.5 * len(overlap)
                matched_terms.append(keyword)

    if _contains_phrase(query, service.name):
        score += 5.0
        matched_terms.append(service.name)
    else:
        name_overlap = query_tokens & _tokens(service.name)
        score += 1.25 * len(name_overlap)
        if name_overlap:
            matched_terms.append(service.name)

    description_overlap = query_tokens & _tokens(service.description)
    score += 0.35 * len(description_overlap)

    return score, list(dict.fromkeys(matched_terms))


def suggest_services(description: str, option_ids: list[int] | None = None) -> Suggestion:
    """Rank active services from customer text without inventing catalog entries."""
    query = normalize(description)
    categories = list(ServiceCategory.objects.filter(is_active=True))
    categories_by_slug = {category.slug: category for category in categories}
    active_services = list(
        Service.objects.filter(is_active=True, category__is_active=True)
        .select_related("category")
        .order_by("category__sort_order", "name", "id")
    )

    category_scores: dict[int, float] = {category.id: 0.0 for category in categories}
    category_reasons: dict[int, list[str]] = {category.id: [] for category in categories}
    query_tokens = _tokens(query)

    for category in categories:
        for keyword in category.keywords or []:
            if not isinstance(keyword, str) or not keyword.strip():
                continue
            keyword_tokens = _tokens(keyword)
            if _contains_phrase(query, keyword):
                category_scores[category.id] += 2.5
                category_reasons[category.id].append(keyword)
            elif token_overlap := (query_tokens & keyword_tokens):
                category_scores[category.id] += 0.75 * len(token_overlap)
                category_reasons[category.id].append(keyword)

        if _contains_phrase(query, category.name):
            category_scores[category.id] += 2.0
            category_reasons[category.id].append(category.name)
        else:
            category_scores[category.id] += 0.4 * len(
                query_tokens & _tokens(category.description)
            )

    options = DiagnosticOption.objects.filter(id__in=option_ids or []).select_related(
        "question"
    )
    for option in options:
        for slug, weight in (option.weights or {}).items():
            category = categories_by_slug.get(slug)
            if category is not None:
                category_scores[category.id] += float(weight)
                category_reasons[category.id].append(option.label.lower())

    service_results = []
    for service in active_services:
        score, matched_terms = _service_score(query, service)
        if score < 1.5:
            continue
        service_results.append(
            {
                "service": service,
                "score": score,
                "matched_terms": matched_terms,
            }
        )
        category_scores[service.category_id] = max(
            category_scores[service.category_id], score
        )
        category_reasons[service.category_id].extend(matched_terms)

    service_results.sort(
        key=lambda result: (
            -result["score"],
            result["service"].category.sort_order,
            result["service"].name.casefold(),
            result["service"].id,
        )
    )
    ranked_services = [
        {
            "id": result["service"].id,
            "name": result["service"].name,
            "category": {
                "id": result["service"].category_id,
                "name": result["service"].category.name,
                "slug": result["service"].category.slug,
                "description": result["service"].category.description,
                "icon_key": result["service"].category.icon_key,
                "professionals_count": 0,
            },
            "score": round(result["score"], 2),
            "matched_terms": result["matched_terms"],
        }
        for result in service_results[:5]
    ]

    category_by_id = {category.id: category for category in categories}
    category_by_slug = categories_by_slug
    ranking = [
        {
            "slug": category.slug,
            "name": category.name,
            "score": round(category_scores[category.id], 2),
        }
        for category in categories
    ]
    ranking.sort(
        key=lambda item: (
            -item["score"],
            category_by_slug[item["slug"]].sort_order,
            item["name"].casefold(),
        )
    )

    if not ranking or ranking[0]["score"] <= 0:
        return Suggestion(
            category=None,
            service=None,
            confidence=0.0,
            rationale="No encontramos una coincidencia clara. Prueba con otros términos o elige una categoría.",
            ranking=ranking,
            service_ranking=[],
        )

    service = service_results[0]["service"] if service_results else None
    best_category = category_by_slug.get(ranking[0]["slug"])
    if service and service_results[0]["score"] >= ranking[0]["score"]:
        category = service.category
    else:
        category = best_category

    total = sum(item["score"] for item in ranking)
    confidence = round(ranking[0]["score"] / total, 2) if total else 0.0
    matched_terms = service_results[0]["matched_terms"] if service_results else []
    if not matched_terms and category:
        matched_terms = category_reasons[category.id]
    rationale = (
        f"Coincidencia con: {', '.join(dict.fromkeys(matched_terms[:4]))}."
        if matched_terms
        else f"Sugerimos {category.name} por la descripción."
    )

    return Suggestion(
        category=category,
        service=service,
        confidence=confidence,
        rationale=rationale[:300],
        ranking=ranking,
        service_ranking=ranked_services,
    )
