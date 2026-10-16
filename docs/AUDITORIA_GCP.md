# Auditoria inicial - 15 de octubre de 2026

Se conservan cambios locales previos en negocio, migraciones, README y settings.
Arquitectura reutilizable: React/TypeScript/Vite/Ionic/Capacitor; apps Django accounts,
households, catalog, diagnosis, professionals, service_requests, orders y pqrs.
JWT access 60 minutos, refresh 14 dias con rotacion, cliente HTTP comun/localStorage.
PostgreSQL por entorno, Gunicorn, WhiteNoise, storage filesystem/S3, health SELECT 1
y Haversine SQL sin PostGIS. Zustand no figura en package.json.

## Tres metodos identificados inequívocamente

| Modalidad en ExploreContainer | Llamadas reales bajo /api/v1/ |
| --- | --- |
| Se que servicio necesito | ExploreContainer -> TomarServicioModal: GET categories/, GET services/?category=ID, GET professionals/?category=SLUG&service=ID. El carrusel tambien GET professionals/. Seleccion, vivienda y POST requests/. |
| Tengo un problema | OrientacionGuiadaModal: POST diagnosis/sessions/ con descripcion y ranking. Fallback GET services/?category=ID. Usuario elige servicio, pasa servicio/sesion al mismo modal. POST requests/ con diagnostic_session y selected_service confirma sugerencia. |
| Profesionales cerca de mi | ContractorMapPage: GET professionals/?lat=...&lng=...&radius_km=50. Backend filtra radio/cobertura y ordena distancia; mapa conserva filtros locales y datos demo si API falla o queda vacia. |

Categoria, servicio y presupuesto son filtros, no metodos nuevos. No cambiar estos flujos.

## Problemas y archivos que requieren intervencion

- Compose local expone 5432/8000 y usa runserver/montaje de fuentes: solo desarrollo.
  Faltan compose.prod.yml, Caddy, persistencia media, backups y guia VM.
- Dockerfile corre root, instala compiladores y copia SQLite/logs/bytecode/media.
  Crear Dockerfile.prod y .dockerignore. SQLite/bytecode ya versionados se conservan.
- Django 5.0.6 fuera de soporte: pasar a 5.2 LTS, DRF compatible y Gunicorn actualizado.
- settings.py ya configura entorno y CORS/CSRF: falta perfil estricto, logging,
  impedir correo con codigos en consola y errores JSON genericos.
- Health revela motor. Fotos de solicitudes tienen endpoint autenticado;
  evidencias usan archivos directos sin servidor media productivo.
- api.ts prioriza host guardado sobre VITE_API_URL, tiene fallbacks HTTP/locales,
  reintentos POST y refresh concurrente que pueden duplicar operaciones.
- AuthContext permite sesion demo si falla backend; limitar a desarrollo.
- No hay script typecheck. README recomienda Render; render.yaml migra al arrancar.
  Conservar blueprint historico, dejar GCP como procedimiento definitivo.
- Dominio encontrado: https://serviproxweb.netlify.app; confirmar al desplegar.
  .env.example es local; falta ejemplo productivo sin secretos.
- seed_demo.py, seed_contractor_services.py y scripts Windows son solo locales.
  No incluirlos en imagen ni arranque productivos. No se lee/imprime .env real.

## Riesgos y pruebas iniciales

Tests Django cubren diagnostico, servicio/precios y solicitudes/fotos/aceptacion/
pago demo. Faltan registro/refresh/geografia/evidencias/calificaciones integradas.
React solo monta App; Cypress tiene ejemplo Inbox antiguo. Venv apunta a Python
inexistente; intentar pruebas con Docker.

migrate no carga catalogo real en BD vacia: migracion keywords solo actualiza
servicios existentes. Cargar por Admin/exportacion revisada sin usuarios demo.
Pago existente es demo, no pasarela. Mapa/seguimiento conservan fallbacks demo:
verificar API y datos persistidos, no solo pantallas. Mapas/geocoding/rutas
dependen de terceros. Una VM es punto unico de fallo; volumen no es backup.
Validacion real TLS/CORS/Netlify/WebViews pendiente de infraestructura.
Ver DESPLIEGUE_GCP.md y VALIDACION_GCP.md.
