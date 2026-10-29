import re

with open("seed_demo.py", "r", encoding="utf-8") as f:
    code = f.read()

service_request_seed_func = '''

def seed_service_requests(categories: dict[str, ServiceCategory]) -> None:
    carlos, _ = User.objects.get_or_create(
        email="carlos.m@example.com",
        defaults={
            "username": "carlos_m",
            "first_name": "Carlos",
            "last_name": "Mendoza",
            "role": UserRole.CLIENT,
            "phone": "+57 312 456 7890",
            "city": "Bogotá",
            "onboarding_completed": True,
            "is_identity_verified": True,
        },
    )
    carlos.set_password(DEMO_PASSWORD)
    carlos.save()

    h_carlos, _ = Household.objects.get_or_create(
        owner=carlos,
        label="Casa Salitre",
        defaults={
            "address_line": "Calle 24A # 68D-11",
            "neighborhood": "Ciudad Salitre",
            "city": "Bogotá",
            "latitude": HOME_LAT + 0.01,
            "longitude": HOME_LNG - 0.01,
            "area_m2": 85,
            "build_year": 2018,
            "is_default": True,
        },
    )

    miguel, _ = User.objects.get_or_create(
        email="miguel.r@example.com",
        defaults={
            "username": "miguel_r",
            "first_name": "Miguel",
            "last_name": "Rodríguez",
            "role": UserRole.CLIENT,
            "phone": "+57 315 890 1234",
            "city": "Bogotá",
            "onboarding_completed": True,
            "is_identity_verified": True,
        },
    )
    miguel.set_password(DEMO_PASSWORD)
    miguel.save()

    h_miguel, _ = Household.objects.get_or_create(
        owner=miguel,
        label="Apartamento Castilla",
        defaults={
            "address_line": "Carrera 78 # 8B-30",
            "neighborhood": "Castilla",
            "city": "Bogotá",
            "latitude": HOME_LAT,
            "longitude": HOME_LNG,
            "area_m2": 65,
            "build_year": 2015,
            "is_default": True,
        },
    )

    cat_instalaciones = categories.get("instalaciones") or ServiceCategory.objects.filter(name__icontains="Instal").first() or ServiceCategory.objects.first()
    cat_plomeria = categories.get("plomeria") or ServiceCategory.objects.filter(name__icontains="Plom").first() or ServiceCategory.objects.first()

    ServiceRequest.objects.update_or_create(
        client=carlos,
        description="Instalación de aire acondicionado",
        defaults={
            "household": h_carlos,
            "selected_category": cat_instalaciones,
            "suggested_category": cat_instalaciones,
            "urgency": ServiceRequest.Urgency.THIS_WEEK,
            "status": ServiceRequest.Status.OPEN,
        },
    )

    ServiceRequest.objects.update_or_create(
        client=miguel,
        description="Reparación de plomería",
        defaults={
            "household": h_miguel,
            "selected_category": cat_plomeria,
            "suggested_category": cat_plomeria,
            "urgency": ServiceRequest.Urgency.URGENT,
            "status": ServiceRequest.Status.OPEN,
        },
    )
'''

if "def seed_service_requests" not in code:
    code = code.replace(
        "@transaction.atomic\ndef run(reset: bool = False) -> None:",
        service_request_seed_func + "\n@transaction.atomic\ndef run(reset: bool = False) -> None:"
    )
    code = code.replace(
        "seed_audit_logs(admin_user)",
        "seed_audit_logs(admin_user)\n    seed_service_requests(categories)"
    )
    with open("seed_demo.py", "w", encoding="utf-8") as f:
        f.write(code)
    print("seed_demo.py updated successfully.")
else:
    print("Already updated.")
