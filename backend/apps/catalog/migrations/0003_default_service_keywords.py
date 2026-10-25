from django.db import migrations


SERVICE_KEYWORDS = {
    ("plomeria", "reparacion-de-fuga"): ["fuga de agua", "grifo goteando", "tubería rota"],
    ("plomeria", "destape-de-desague"): ["desagüe tapado", "cañería obstruida", "drenaje lento"],
    ("plomeria", "cambio-de-sanitario"): ["cambiar inodoro", "sanitario roto", "fuga del tanque"],
    ("electricidad", "revision-de-tablero"): ["breaker se dispara", "corto eléctrico", "tablero eléctrico"],
    ("electricidad", "instalacion-de-tomacorriente"): ["instalar enchufe", "toma sin corriente", "nuevo tomacorriente"],
    ("cerrajeria", "apertura-de-puerta"): ["llaves dentro", "puerta bloqueada", "cerradura atascada"],
    ("cerrajeria", "cambio-de-cerradura"): ["cambiar chapa", "cerradura dañada", "instalar cerradura"],
    ("impermeabilizacion", "diagnostico-de-humedad"): ["humedad en pared", "moho", "mancha de humedad"],
    ("impermeabilizacion", "sellado-de-terraza"): ["filtración en terraza", "impermeabilizar techo", "gotera en cubierta"],
    ("impermeabilizacion", "reparacion-de-filtracion-en-pared"): ["pared húmeda", "filtración en muro", "humedad interior"],
    ("pintura", "pintura-de-habitacion"): ["pintar cuarto", "renovar pintura", "pared descascarada"],
    ("pintura", "estuco-y-resane"): ["resanar pared", "grieta en muro", "estuco desprendido"],
    ("limpieza", "limpieza-profunda"): ["aseo profundo", "limpiar apartamento", "limpieza postobra"],
    ("instalaciones", "instalacion-de-televisor"): ["montar televisor", "instalar tv en pared", "soporte para televisor"],
    ("mantenimiento", "revision-general-del-hogar"): ["mantenimiento preventivo", "revisión del hogar", "arreglos menores"],
}


def populate_service_keywords(apps, schema_editor):
    Service = apps.get_model("catalog", "Service")
    database = schema_editor.connection.alias
    for (category_slug, service_slug), keywords in SERVICE_KEYWORDS.items():
        service = (
            Service.objects.using(database)
            .filter(category__slug=category_slug, slug=service_slug, keywords=[])
            .first()
        )
        if service:
            service.keywords = keywords
            service.save(update_fields=["keywords"])


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0002_service_keywords"),
    ]

    operations = [
        migrations.RunPython(
            populate_service_keywords,
            migrations.RunPython.noop,
        ),
    ]
