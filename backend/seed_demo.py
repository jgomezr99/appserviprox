#!/usr/bin/env python
"""Carga datos de demostración que reproducen el prototipo de interfaz.

Uso:
    python seed_demo.py          # crea o actualiza los datos demo
    python seed_demo.py --reset  # borra los datos demo antes de crearlos

Es idempotente: se puede ejecutar varias veces sin duplicar registros.
"""
from __future__ import annotations

import os
import sys
from datetime import time

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import transaction  # noqa: E402

from apps.accounts.models import User, UserRole  # noqa: E402
from apps.catalog.models import Service, ServiceCategory  # noqa: E402
from apps.diagnosis.models import DiagnosticOption, DiagnosticQuestion  # noqa: E402
from apps.households.models import Household  # noqa: E402
from apps.orders.models import Order  # noqa: E402
from apps.professionals.models import (  # noqa: E402
    AvailabilitySlot,
    PortfolioItem,
    ProfessionalProfile,
    ProfessionalService,
)
from apps.service_requests.models import ServiceRequest  # noqa: E402

DEMO_PASSWORD = "serviprox2026"

# Centro del mapa del prototipo: Kennedy, Bogotá.
HOME_LAT, HOME_LNG = 4.6280, -74.1500

CATEGORIES = [
    {
        "name": "Plomería",
        "icon_key": "plumbing",
        "description": "Fugas, desagües, sanitarios y presión de agua.",
        "keywords": ["fuga", "gotea", "agua", "tubería", "sanitario", "lavamanos", "desagüe", "presión"],
    },
    {
        "name": "Electricidad",
        "icon_key": "electricity",
        "description": "Cortos, tomas, tableros e iluminación.",
        "keywords": ["luz", "corto", "breaker", "toma", "enchufe", "chispa", "cableado", "bombillo"],
    },
    {
        "name": "Cerrajería",
        "icon_key": "locksmith",
        "description": "Cerraduras, llaves y aperturas de emergencia.",
        "keywords": ["cerradura", "llave", "puerta", "candado", "chapa", "encerrado"],
    },
    {
        "name": "Impermeabilización",
        "icon_key": "waterproofing",
        "description": "Humedades, filtraciones y sellado de cubiertas.",
        "keywords": ["humedad", "filtración", "gotera", "moho", "pared húmeda", "techo", "terraza"],
    },
    {
        "name": "Pintura",
        "icon_key": "painting",
        "description": "Pintura interior, exterior y estuco.",
        "keywords": ["pintura", "pintar", "estuco", "descascarado", "color", "pared manchada"],
    },
    {
        "name": "Limpieza",
        "icon_key": "cleaning",
        "description": "Limpieza profunda, tapetes y postobra.",
        "keywords": ["limpieza", "aseo", "tapete", "postobra", "desinfección"],
    },
    {
        "name": "Instalaciones",
        "icon_key": "installations",
        "description": "Electrodomésticos, muebles y soportes.",
        "keywords": ["instalar", "montar", "soporte", "televisor", "lavadora", "mueble"],
    },
    {
        "name": "Mantenimiento",
        "icon_key": "maintenance",
        "description": "Revisiones preventivas y arreglos menores.",
        "keywords": ["mantenimiento", "revision", "preventivo", "ajuste", "arreglo menor"],
    },
]

SERVICES = {
    "plomeria": [
        ("Reparacion de fuga", 90000, 180000, 2),
        ("Destape de desagüe", 110000, 220000, 2),
        ("Cambio de sanitario", 150000, 320000, 3),
    ],
    "electricidad": [
        ("Revisión de tablero", 120000, 240000, 2),
        ("Instalación de tomacorriente", 70000, 140000, 1),
    ],
    "cerrajeria": [
        ("Apertura de puerta", 80000, 160000, 1),
        ("Cambio de cerradura", 120000, 260000, 2),
    ],
    "impermeabilizacion": [
        ("Diagnóstico de humedad", 85000, 140000, 2),
        ("Sellado de terraza", 450000, 1200000, 8),
        ("Reparación de filtración en pared", 220000, 640000, 5),
    ],
    "pintura": [
        ("Pintura de habitación", 260000, 520000, 8),
        ("Estuco y resane", 180000, 420000, 6),
    ],
    "limpieza": [("Limpieza profunda", 160000, 320000, 5)],
    "instalaciones": [("Instalación de televisor", 90000, 180000, 2)],
    "mantenimiento": [("Revisión general del hogar", 140000, 260000, 3)],
}

QUESTIONS = [
    {
        "code": "ubicacion",
        "text": "¿Dónde se presenta el problema?",
        "order": 1,
        "options": [
            ("pared-exterior", "Pared exterior", {"impermeabilizacion": 3, "pintura": 1}),
            ("pared-interior", "Pared interior", {"impermeabilizacion": 2, "plomeria": 1, "pintura": 1}),
            ("techo", "Techo", {"impermeabilizacion": 3, "plomeria": 1}),
            ("piso", "Piso", {"plomeria": 3, "impermeabilizacion": 1}),
        ],
    },
    {
        "code": "antiguedad",
        "text": "¿Hace cuánto lo notaste?",
        "order": 2,
        "options": [
            ("esta-semana", "Esta semana", {"plomeria": 2, "electricidad": 1}),
            ("un-mes", "Hace un mes", {"impermeabilizacion": 1}),
            ("varios-meses", "Hace varios meses", {"impermeabilizacion": 3, "pintura": 1}),
        ],
    },
    {
        "code": "senal",
        "text": "¿Qué estás viendo?",
        "order": 3,
        "options": [
            ("mancha", "Mancha o moho", {"impermeabilizacion": 3, "pintura": 1}),
            ("goteo", "Goteo de agua", {"plomeria": 3, "impermeabilizacion": 1}),
            ("sin-energia", "Se va la energía", {"electricidad": 4}),
            ("no-abre", "Algo no abre o no cierra", {"cerrajeria": 4}),
        ],
    },
]

PROFESSIONALS = [
    {
        "email": "andres.ruiz@demo.serviprox.co",
        "first_name": "Andrés",
        "last_name": "Ruiz",
        "display_name": "Andrés Ruiz",
        "headline": "Impermeabilización y humedades",
        "bio": "12 años sellando cubiertas y fachadas en Bogotá. Diagnóstico sin costo.",
        # ~0.8 km al norte del hogar demo.
        "lat": HOME_LAT + 0.0072,
        "lng": HOME_LNG,
        "neighborhood": "Kennedy",
        "rating": 4.9,
        "jobs": 132,
        "verified": True,
        "urgent": True,
        "categories": ["impermeabilizacion", "pintura"],
    },
    {
        "email": "marcela.gomez@demo.serviprox.co",
        "first_name": "Marcela",
        "last_name": "Gómez",
        "display_name": "Marcela Gómez",
        "headline": "Plomería residencial",
        "bio": "Especialista en fugas ocultas y redes hidráulicas de apartamentos.",
        # ~1.4 km al oriente.
        "lat": HOME_LAT,
        "lng": HOME_LNG + 0.0126,
        "neighborhood": "Castilla",
        "rating": 4.8,
        "jobs": 87,
        "verified": True,
        "urgent": True,
        "categories": ["plomeria", "impermeabilizacion"],
    },
    {
        "email": "diego.salcedo@demo.serviprox.co",
        "first_name": "Diego",
        "last_name": "Salcedo",
        "display_name": "Diego Salcedo",
        "headline": "Electricidad y mantenimiento",
        "bio": "Técnico electricista certificado RETIE. Atiende urgencias en el sur.",
        # ~2.6 km al sur.
        "lat": HOME_LAT - 0.0234,
        "lng": HOME_LNG,
        "neighborhood": "Timiza",
        "rating": 4.7,
        "jobs": 54,
        "verified": False,
        "urgent": False,
        "categories": ["electricidad", "mantenimiento", "instalaciones"],
    },
]


def seed_categories() -> dict[str, ServiceCategory]:
    categories: dict[str, ServiceCategory] = {}
    for index, data in enumerate(CATEGORIES):
        category, _ = ServiceCategory.objects.update_or_create(
            name=data["name"],
            defaults={
                "description": data["description"],
                "icon_key": data["icon_key"],
                "keywords": data["keywords"],
                "sort_order": index,
                "is_active": True,
            },
        )
        categories[category.slug] = category

    for slug, services in SERVICES.items():
        category = categories[slug]
        for name, price_min, price_max, hours in services:
            Service.objects.update_or_create(
                category=category,
                name=name,
                defaults={
                    "price_min": price_min,
                    "price_max": price_max,
                    "estimated_hours": hours,
                },
            )
    return categories


def seed_questions() -> None:
    for data in QUESTIONS:
        question, _ = DiagnosticQuestion.objects.update_or_create(
            code=data["code"],
            defaults={"text": data["text"], "order": data["order"], "is_active": True},
        )
        for order, (value, label, weights) in enumerate(data["options"]):
            DiagnosticOption.objects.update_or_create(
                question=question,
                value=value,
                defaults={"label": label, "weights": weights, "order": order},
            )


def seed_client() -> User:
    client, created = User.objects.get_or_create(
        email="camila@demo.serviprox.co",
        defaults={
            "username": "camila",
            "first_name": "Camila",
            "last_name": "Rojas",
            "role": UserRole.CLIENT,
            "phone": "+57 300 000 0000",
            "city": "Bogotá",
        },
    )
    if created:
        client.set_password(DEMO_PASSWORD)
        client.save()

    Household.objects.update_or_create(
        owner=client,
        label="Mi apartamento",
        defaults={
            "address_line": "Calle 40 Sur #78-20",
            "neighborhood": "Kennedy",
            "city": "Bogotá",
            "latitude": HOME_LAT,
            "longitude": HOME_LNG,
            "area_m2": 68,
            "build_year": 2012,
            "is_default": True,
        },
    )
    return client


def seed_professionals(categories: dict[str, ServiceCategory]) -> None:
    for data in PROFESSIONALS:
        user, created = User.objects.get_or_create(
            email=data["email"],
            defaults={
                "username": data["email"].split("@")[0],
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "role": UserRole.PROFESSIONAL,
                "city": "Bogotá",
                "is_identity_verified": data["verified"],
            },
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()

        profile, _ = ProfessionalProfile.objects.update_or_create(
            user=user,
            defaults={
                "display_name": data["display_name"],
                "headline": data["headline"],
                "bio": data["bio"],
                "latitude": data["lat"],
                "longitude": data["lng"],
                "neighborhood": data["neighborhood"],
                "city": "Bogotá",
                "coverage_radius_km": 10,
                "rating_avg": data["rating"],
                "jobs_completed": data["jobs"],
                "is_verified": data["verified"],
                "accepts_urgent": data["urgent"],
                "is_active": True,
            },
        )

        for slug in data["categories"]:
            category = categories[slug]
            reference = category.services.first()
            ProfessionalService.objects.update_or_create(
                profile=profile,
                category=category,
                defaults={
                    "price_min": reference.price_min if reference else None,
                    "price_max": reference.price_max if reference else None,
                    "years_experience": 5,
                },
            )

        profile.availability.all().delete()
        AvailabilitySlot.objects.bulk_create(
            AvailabilitySlot(
                profile=profile, weekday=weekday, start_time=time(8, 0), end_time=time(18, 0)
            )
            for weekday in range(0, 6)
        )

        profile.portfolio.all().delete()
        PortfolioItem.objects.bulk_create(
            PortfolioItem(profile=profile, caption=f"Trabajo {n}", sort_order=n)
            for n in range(1, 5)
        )


def reset_demo() -> None:
    # Orden importante: ordenes y solicitudes protegen categorias y hogares.
    Order.objects.all().delete()
    ServiceRequest.objects.all().delete()
    User.objects.filter(email__endswith="@demo.serviprox.co").delete()
    DiagnosticQuestion.objects.all().delete()
    ServiceCategory.objects.all().delete()


@transaction.atomic
def run(reset: bool = False) -> None:
    if reset:
        reset_demo()
    categories = seed_categories()
    seed_questions()
    seed_client()
    seed_professionals(categories)


if __name__ == "__main__":
    run(reset="--reset" in sys.argv)
    print("Datos demo listos.")
    print(f"  Cliente:      camila@demo.serviprox.co / {DEMO_PASSWORD}")
    print(f"  Profesional:  andres.ruiz@demo.serviprox.co / {DEMO_PASSWORD}")
