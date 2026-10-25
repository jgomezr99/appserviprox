# PostgreSQL local y preparacion de la VM

La rama de trabajo es `develop`. El frontend de produccion es
`https://serviproxweb.netlify.app`; la API se ejecuta en la VM bajo su propio dominio.
El hostname Docker `db` identifica PostgreSQL dentro de Compose, no la IP publica de la VM.

## Desarrollo

Copiar `.env.example` a `.env` en una instalacion nueva y completar las credenciales.
El entorno activo debe tener `SERVIPROX_DATABASE=postgres`, `POSTGRES_HOST=db`,
`POSTGRES_PORT=5432` y `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` correctos.
Una base ya inicializada conserva sus credenciales aunque se edite el entorno.
El puerto de PostgreSQL no se publica en el host; Django lo alcanza por la red
interna de Docker. Para administrarlo se puede usar `docker compose exec db psql`.

```powershell
docker compose build backend
docker compose up -d db backend
docker compose exec -T backend python manage.py migrate --noinput
npm ci
npm run dev
```

Los dos archivos `.bat` inician Docker y PostgreSQL. SQLite solo se utiliza cuando
se solicita explicitamente para pruebas o una importacion; no hay un fallback automatico.

## Importar datos existentes de SQLite

Conservar un respaldo de ambas bases y crear una base PostgreSQL nueva: nunca
importar encima de una base con usuarios u otros registros. Configurar esa base
como destino para el comando. El siguiente ejemplo presupone que `BASE_NUEVA`
ya existe y pertenece al usuario PostgreSQL configurado:

```powershell
docker compose run --rm --no-deps -T -e SERVIPROX_DATABASE=postgres -e POSTGRES_DB=BASE_NUEVA backend python manage.py import_sqlite --sqlite /app/db.sqlite3 --output-dir /app/backups/transferencia-inicial
```

El comando crea una copia SQLite consistente, aplica el esquema en PostgreSQL e
importa los modelos con sus claves primarias y relaciones. Conserva los hashes de
contrasenas, compara todos los campos serializados y verifica las secuencias. Los
metadatos de permisos y tipos de contenido son generados por Django. Una diferencia
de datos revierte la importacion; una base destino con datos es rechazada.

Antes del cambio definitivo, detener el backend y verificar otra copia del origen:

```powershell
docker compose stop backend
docker compose run --rm --no-deps -T -e SERVIPROX_DATABASE=postgres -e POSTGRES_DB=BASE_NUEVA backend python manage.py import_sqlite --sqlite /app/db.sqlite3 --output-dir /app/backups/transferencia-verificacion --verify-only
```

Si coincide, fijar `SERVIPROX_DATABASE=postgres` y `POSTGRES_DB=BASE_NUEVA` en `.env`,
y ejecutar `docker compose up -d db backend`. Comprobar que `connection.vendor`
devuelva `postgresql` y que `/api/v1/health/` responda 200. Los directorios de
transferencia contienen datos privados y deben permanecer fuera de Git.

## Clonar y crear el entorno de GCP

```bash
git clone --branch develop https://github.com/jgomezr99/appserviprox.git
cd appserviprox
python3 deploy/configure_env.py --api-domain api.TU_DOMINIO --email TU_CORREO
bash deploy/compose.sh config --quiet
```

Reemplazar los dos argumentos con el dominio real de la API y el correo del operador.
El generador crea `.env.production` con permisos 600, secretos nuevos, PostgreSQL,
el origen Netlify confirmado y el commit clonado como version. Rechaza sobrescribir
un archivo existente. Completar SMTP para recuperacion de contrasenas. El archivo
privado no se sube al repositorio. La plantilla versionada no contiene secretos.

Configurar DNS y HTTPS segun [la guia de la VM](DESPLIEGUE_GCP.md). Netlify debe
compilar con `VITE_API_URL=https://DOMINIO_REAL_API/api/v1`; esta URL no es la del
frontend. La VM usa `compose.prod.yml`, Gunicorn, Caddy y un volumen PostgreSQL
privado. No usar el servidor de desarrollo para publicar la API.

## Llevar los registros y archivos a la VM

Clonar Git copia el codigo, no los registros de PostgreSQL ni las fotos subidas.
Crear un dump PostgreSQL en formato custom con `--no-owner --no-acl`, exportar
`backend/media` y transferir ambos por un canal privado a la VM. La copia obtenida
despues de la migracion local es la que contiene los datos actuales.

En una VM nueva, antes de habilitar Caddy y con el backend detenido:

```bash
bash deploy/compose.sh build backend
bash deploy/compose.sh up -d --wait db
bash deploy/compose.sh exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error --no-owner --no-acl' < /RUTA_PRIVADA/database.dump
bash deploy/compose.sh run --rm --no-deps backend python manage.py migrate --noinput
```

Restaurar media en el volumen `media_data` con propietario UID/GID 10001, siguiendo
la seccion de restauracion de [DESPLIEGUE_GCP.md](DESPLIEGUE_GCP.md), y ejecutar
`bash deploy/deploy.sh initial`. El destino debe estar vacio; conservar cualquier
base ya existente y validar los datos antes de dirigir usuarios a la VM.
