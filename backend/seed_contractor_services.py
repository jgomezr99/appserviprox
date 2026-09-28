import os
import sys

backend_dir = r"c:\Users\jgome\Documents\appserviprox-servicios\backend"
sys.path.insert(0, backend_dir)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from apps.catalog.models import Service, ServiceCategory
from apps.professionals.models import ProfessionalProfile, ProfessionalService

# 1. Asegurar categorías adicionales
cats = {
    "albanileria": ("Albañilería", "Albañilería, mampostería y muros"),
    "carpinteria": ("Carpintería", "Carpintería fina y muebles"),
    "climatizacion": ("Climatización", "Calefacción, aire acondicionado y gas"),
}
for slug, (name, desc) in cats.items():
    cat, created = ServiceCategory.objects.get_or_create(
        slug=slug,
        defaults={"name": name, "description": desc, "is_active": True}
    )
    if created:
        print(f"Creada categoría: {cat.name}")

# 2. Servicios adicionales
extra_services = [
    ("albanileria", "reparacion-de-muros-y-drywall", "Reparación de muros y drywall", 50000, 150000),
    ("albanileria", "mamposteria-y-acabados", "Mampostería y acabados", 80000, 250000),
    ("carpinteria", "fabricacion-y-ajuste-de-puertas", "Fabricación y ajuste de puertas", 40000, 120000),
    ("carpinteria", "muebles-y-closets-a-medida", "Muebles y closets a medida", 90000, 350000),
    ("climatizacion", "mantenimiento-de-calentador", "Mantenimiento de calentador de agua", 60000, 180000),
    ("climatizacion", "aire-acondicionado-y-ventilacion", "Aire acondicionado y ventilación", 70000, 220000),
]
for cat_slug, s_slug, s_name, p_min, p_max in extra_services:
    cat = ServiceCategory.objects.filter(slug=cat_slug).first()
    if cat:
        svc, created = Service.objects.get_or_create(
            slug=s_slug,
            defaults={
                "category": cat,
                "name": s_name,
                "price_min": p_min,
                "price_max": p_max,
                "is_active": True,
            }
        )
        if created:
            print(f"Creado servicio: {svc.name}")

# 3. Vincular servicios a cada contratista oficial
PROFESSIONAL_SERVICES_MAP = {
    "morales-construcciones": ["reparacion-de-muros-y-drywall", "mamposteria-y-acabados", "estuco-y-resane"],
    "carlos-mendoza": ["revision-de-tablero", "instalacion-de-tomacorriente"],
    "salamanca-plomeria": ["reparacion-de-fuga", "destape-de-desague"],
    "cerrajeria-express": ["apertura-de-puerta", "cambio-de-cerradura"],
    "pinzon-pinturas": ["pintura-de-habitacion", "estuco-y-resane"],
    "hidropro-plomeria": ["reparacion-de-fuga", "cambio-de-sanitario"],
    "beltran-redes": ["revision-de-tablero", "instalacion-de-tomacorriente"],
    "clima-bogota": ["mantenimiento-de-calentador", "aire-acondicionado-y-ventilacion"],
    "carpinteria-aranda": ["fabricacion-y-ajuste-de-puertas", "muebles-y-closets-a-medida"],
}

print("=== VINCULANDO SERVICIOS A PROFESIONALES ===")
for slug, service_slugs in PROFESSIONAL_SERVICES_MAP.items():
    prof = ProfessionalProfile.objects.filter(slug=slug).first()
    if prof:
        for s_slug in service_slugs:
            svc = Service.objects.filter(slug=s_slug).first()
            if svc:
                ps, created = ProfessionalService.objects.get_or_create(
                    profile=prof,
                    service=svc,
                    defaults={
                        "price_min": svc.price_min,
                        "price_max": svc.price_max,
                        "years_experience": 10,
                        "observations": f"Servicio profesional garantizado por {prof.display_name}.",
                    }
                )
                if created:
                    print(f"  Vinculado: {prof.display_name} -> {svc.name}")

print("\n=== VERIFICACIÓN FINAL DE SERVICIOS POR PROFESIONAL ===")
for prof in ProfessionalProfile.objects.all():
    svcs = [ps.service.name for ps in prof.services.all()]
    print(f"[{prof.id}] {prof.display_name} ({prof.slug}): {len(svcs)} servicios -> {', '.join(svcs)}")

