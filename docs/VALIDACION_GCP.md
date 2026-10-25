# Reporte de preparacion y validacion - 16 de octubre de 2026

El repositorio tiene configuracion para Netlify + VM Compute Engine, sin
despliegue realizado. Los cambios locales previos se conservaron. La validacion
de la imagen final y de Django 5.2/PostgreSQL sigue pendiente y es un requisito
antes de publicar; no se afirma que toda la pila productiva este certificada.

## Estado inicial y alcance

Ver AUDITORIA_GCP.md. Se identificaron los tres metodos existentes: catalogo/
servicio, orientacion mediante diagnostico, y proximidad en mapa. Se mantienen
rutas, modelos, migraciones, roles y reglas de negocio. El unico endpoint nuevo
sirve evidencias autenticadas; el campo image_url conserva su contrato.

## Archivos creados

- compose.prod.yml y .env.production.example.
- backend/Dockerfile.prod, backend/.dockerignore, backend/gunicorn.conf.py.
- backend/config/settings_production.py, errors.py, tests.py y test_flows.py.
- deploy/Caddyfile, deploy/compose.sh, deploy/deploy.sh, deploy/backup.sh.
- src/components/serviprox/AuthenticatedImage.tsx y src/services/api.test.ts.
- docs/AUDITORIA_GCP.md, DESPLIEGUE_GCP.md y este reporte.

## Archivos modificados por esta preparacion

- .gitignore y .gitattributes: secretos/entornos/backups ignorados y scripts LF.
- backend/requirements.txt: Django 5.2.18 LTS, DRF 3.16.1 y Gunicorn 26.2.0 fijados.
- backend/config/urls.py: health sin motor y handlers de errores genericos.
- backend/apps/orders/views.py y serializers.py: evidencias por endpoint privado.
- src/services/api.ts: destino productivo unico, guardia de URLs absolutas,
  refresh concurrente compartido, timeout y evitar repetir escrituras en produccion.
- src/context/AuthContext.tsx: sesion demo limitada a desarrollo.
- src/pages/WorkTrackingPage.tsx: mismo elemento visual para evidencia con blob JWT.
- capacitor.config.ts: HTTP solo con opt-in local CAPACITOR_ALLOW_CLEARTEXT=true.
- package.json: typecheck. vite.config.ts: validacion de URL y sin autoarranque
  Django durante Vitest. README.md: enlaces GCP y Render marcado historico.

El settings.py, modelos/migraciones, Compose local, netlify.toml, render.yaml y
demas archivos de negocio que ya tenian cambios del usuario no se reescribieron.
Los archivos dist versionados, inicialmente sin cambios, se restauran despues de
validar el build para no entregar bundles de prueba con api.example.com.

## Configuracion preparada

PostgreSQL 16.15-alpine3.23 sin ports, volumen persistente y red interna.
Gunicorn no root, sin ports publicados, health con BD y logs rotados.
Caddy 2.11.7-alpine publica 80/443, HTTPS automatico, certificados persistentes y
encabezados de proxy. Media persistente y privada, estaticos mediante WhiteNoise.
Migraciones en tarea controlada, nunca en CMD. Ningun seed automatico.

Variables obligatorias/operativas y ejemplos estan en .env.production.example:
API_DOMAIN, ACME_EMAIL, SERVIPROX_RELEASE, DJANGO_SECRET_KEY,
DJANGO_ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS,
POSTGRES_DB/USER/PASSWORD/HOST/PORT/SSLMODE, SERVIPROX_DATABASE,
SERVIPROX_MEDIA_STORAGE, DJANGO_DEBUG y DJANGO_SETTINGS_MODULE.
Ademas: HSTS, workers, radio, zona horaria y SMTP para recuperar contrasenas.
VITE_API_URL=https://DOMINIO_API/api/v1 se fija en build Netlify/apps, sin secretos.

## Resultados reales

| Verificacion | Resultado |
| --- | --- |
| Suite Django: test apps config --noinput | **44/44 pasan**, Python 3.12.10, Django **5.0.6 instalado**, SQLite temporal. No valida Django 5.2 ni PostgreSQL. |
| Flujos integrados nuevos | Registro ambos roles/JWT/perfil/refresh; radio y orden de distancia; coordenadas; evidencias cliente/profesional con rechazo a terceros/anonimos; transicion y calificacion. Pasan en ese entorno. |
| check --deploy con config.settings_production | Exit 0, **14 avisos OpenAPI preexistentes** drf_spectacular W001/W002 (anotaciones/serializadores faltantes). No se ocultan. Configuracion PostgreSQL sin conectar una BD real. |
| check --deploy --tag security --fail-level WARNING | **Pasa sin incidencias**, con Django 5.0.6 y variables de prueba. |
| npm run typecheck | **Pasa**. |
| npm run build | **Pasa**, con VITE_API_URL=https://api.example.com/api/v1 solo como placeholder de validacion. No verifica API publica. Avisos de bundles >500 kB y datos Browserslist antiguos. |
| npm run test.unit -- --run | **7/7 pasan**: montaje App y 6 pruebas de destino API/JWT/refresh/errores. |
| docker compose config --quiet (prod) | **Pasa**, usando ejemplo y password ficticio temporal; no inicia contenedores. CLI avisa que config Docker del usuario no es legible en sandbox. |
| bash -n de compose.sh, deploy.sh y backup.sh | **Pasa** con Git Bash, no equivale a ejecutar despliegue/backups en Ubuntu. |
| Imagen productiva, Caddy/TLS, volumenes, backup/restore reales | **Pendiente**. Construccion local Docker no autorizada. |
| Django 5.2.18 + DRF 3.16.1 fijados | **Pendiente**: instalacion de entorno aislado no autorizada; no se altero el venv existente. |
| Cypress / Android / iOS / Netlify / GCP | **Pendiente**. Cypress existente prueba Inbox del ejemplo, no negocio Serviprox. |

La primera invocacion de tests desde raiz sin labels encontro cero tests;
se corrigio con apps config. No se contabilizo esa invocacion como validacion.
Build/Vitest necesitaron permiso fuera del sandbox para cargar vite.config.ts.
No se ejecutaron migraciones ni seeds contra SQLite local ni bases reales.

## Repetir validacion de imagen con PostgreSQL aislado

En un equipo autorizado con Docker, desde la raiz. Estos comandos crean recursos
exclusivamente de prueba sin puertos publicados ni volumen productivo.
El usuario PostgreSQL de prueba necesita crear la base temporal de Django; el
usuario inicial de la imagen oficial tiene ese permiso.

```bash
docker build -f backend/Dockerfile.prod --build-arg SERVIPROX_RELEASE=validation \
  -t serviprox-backend:validation backend
umask 077
TEST_ENV="$(mktemp)"
cat > "$TEST_ENV" <<EOF
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=$(openssl rand -hex 32)
DJANGO_ALLOWED_HOSTS=testserver,127.0.0.1,api.example.com
DJANGO_SECURE_SSL_REDIRECT=False
SERVIPROX_DATABASE=postgres
SERVIPROX_MEDIA_STORAGE=filesystem
POSTGRES_HOST=serviprox-validation-db
POSTGRES_DB=serviprox_validation
POSTGRES_USER=serviprox_validation
POSTGRES_PASSWORD=$(openssl rand -hex 32)
CORS_ALLOWED_ORIGINS=https://serviproxweb.netlify.app,https://localhost,capacitor://localhost
CSRF_TRUSTED_ORIGINS=https://api.example.com
EOF
docker network create serviprox-validation
docker run -d --name serviprox-validation-db --network serviprox-validation \
  --env-file "$TEST_ENV" --health-cmd='pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  --health-interval=2s --health-retries=30 postgres:16.15-alpine3.23
for attempt in $(seq 1 30); do
  [ "$(docker inspect --format '{{.State.Health.Status}}' serviprox-validation-db)" = healthy ] && break
  sleep 2
done
test "$(docker inspect --format '{{.State.Health.Status}}' serviprox-validation-db)" = healthy
docker run --rm --network serviprox-validation --env-file "$TEST_ENV" \
  serviprox-backend:validation python manage.py test apps config --noinput
docker run --rm --network serviprox-validation --env-file "$TEST_ENV" \
  -e DJANGO_DEBUG=False -e DJANGO_SETTINGS_MODULE=config.settings_production \
  serviprox-backend:validation python manage.py check --deploy
docker run --rm --network serviprox-validation --env-file "$TEST_ENV" \
  -e DJANGO_DEBUG=False -e DJANGO_SETTINGS_MODULE=config.settings_production \
  serviprox-backend:validation python manage.py check --deploy --tag security --fail-level WARNING
# Solo si los nombres corresponden a estos recursos desechables de prueba:
docker rm -f -v serviprox-validation-db
docker network rm serviprox-validation
rm -- "$TEST_ENV"
```

Despues validar Caddy/configuracion real, reinicio y persistencia de media,
backup/restauracion y pruebas HTTPS desde Netlify y dispositivos. La guia
DESPLIEGUE_GCP.md contiene los pasos exactos y la matriz de aceptacion.
La URL de Netlify y los datos de catalogo requieren confirmacion del operador.
No existe infraestructura desplegada por esta tarea.


## Reparacion del contenedor local - 16 de octubre de 2026

El contenedor existente estaba Up pero Django no atendia: faltaba Pillow para
orders.WorkEvidence.image (fields.E210). Se instalo Pillow 11.3.0 dentro de ese
contenedor y se reinicio solo backend, sin construir imagenes ni recrear
contenedores. manage.py check paso y health respondio 200 directamente y por Vite.

La imagen existente conserva Django 5.0.6/DRF 3.15.1 y su contenedor usa SQLite:
no tenia SERVIPROX_DATABASE definido. El Compose actual define PostgreSQL, pero
start/restart no actualizan el entorno de un contenedor previamente creado.
Se conservo la base activa para mantener las cuentas; no se cambio a PostgreSQL.

Se creo una copia SQLite consistente en
backend/backups/pre-repair-20261016T190137Z.sqlite3 (directorio ignorado por Git),
y se aplicaron catalog.0002_service_keywords, catalog.0003_default_service_keywords
y diagnosis.0002_service_suggestions. Se conservaron los conteos: 18 usuarios,
5 viviendas, 5 solicitudes y 3 ordenes. No se ejecutaron seeds.

Se verificaron mediante APIClient dentro del contenedor: registro 201, login 200,
perfil 200, refresh 200, solicitud de recuperacion 200, confirmacion de nueva
contrasena 200, login nuevo 200 y rechazo de contrasena anterior 401. La cuenta
temporal y sus datos se revirtieron por transaccion; el correo de prueba uso solo
memoria. No se cambiaron contrasenas de cuentas existentes ni se enviaron correos
externos. El frontend Vite activo apunta a http://localhost:8000/api/v1.

La dependencia instalada permanece al reiniciar ESTE contenedor; al recrearlo
desde su imagen antigua se perderia. Pillow ya esta declarado en requirements.txt
para las futuras construcciones autorizadas. La validacion de la imagen
productiva Django 5.2/PostgreSQL y de GCP/Netlify continua pendiente.

## Validacion del 24 de octubre de 2026

El backend local ya utiliza PostgreSQL en Docker, en la base `serviprox_app`.
La base PostgreSQL previa se conserva por separado. SQLite queda como respaldo
y como formato de importacion explicita, sin fallback automatico al iniciar.

- Se importaron 496 registros conservando IDs, relaciones y hashes de contrasenas.
- Se compararon todos los campos serializados y se comprobaron 31 secuencias.
- La base de destino con datos rechaza una reimportacion que pudiera sobrescribirlos.
- Pasaron 67 pruebas en PostgreSQL y otras 67 en la imagen de produccion.
- La imagen se construyo con `backend/Dockerfile.prod`, incluyendo collectstatic.
- Paso `check --deploy --tag security --fail-level WARNING` con un entorno generado.
- Gunicorn funciono con UID 10001, permisos restringidos y PostgreSQL aislado.
- Se verificaron salud HTTP 200, estaticos, medios privados, permisos y CORS del
  frontend confirmado `https://serviproxweb.netlify.app`.
- El generador de entorno produjo secretos independientes y permisos 600 y rechazo
  sobrescribir un archivo ya existente.
- El dump para GCP se restauro en otra base vacia y sus 496 registros coincidieron
  completamente con la copia original.
- Las etiquetas de PostgreSQL y Caddy de `compose.prod.yml` estan disponibles.

Los respaldos y entornos privados quedan en `backend/backups/`, fuera de Git.
Para la VM siguen siendo necesarios el dominio real de la API, correo del operador,
DNS y HTTPS reales. La guia [POSTGRESQL_Y_GCP.md](POSTGRESQL_Y_GCP.md) contiene los
pasos para clonar `develop`, generar `.env.production` y restaurar datos y media.
