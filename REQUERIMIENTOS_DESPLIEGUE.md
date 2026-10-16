# Requerimientos para desplegar Serviprox

Lista de preparación para el despliegue existente: frontend en Netlify y backend
Django con PostgreSQL, Gunicorn y Caddy en una VM de Google Cloud.
Este archivo no contiene secretos ni implica que el proyecto esté desplegado.

## 1. Accesos y datos que debes tener

- [ ] Repositorio Git y commit revisado que se va a desplegar.
- [ ] Proyecto Google Cloud con facturación y Compute Engine habilitados.
- [ ] Permisos para crear VM, red, firewall e IP externa estática.
- [ ] Acceso SSH seguro a la VM; permisos OS Login/IAP si se sigue la guía.
- [ ] Dominio o subdominio para la API y acceso para editar sus registros DNS.
- [ ] IP externa estática reservada para la VM y registro A de la API hacia ella.
- [ ] Acceso al sitio Netlify existente y a sus variables de compilación.
- [ ] Correo del operador para certificados HTTPS.
- [ ] Servicio SMTP y remitente autorizado para recuperación de contraseñas.
- [ ] Destino seguro fuera de la VM para copias de base de datos y fotografías.

No necesitas migrar el frontend a Google Cloud ni crear una cuenta Render.
El dominio Netlify encontrado en el repositorio es
https://serviproxweb.netlify.app; confirma que sea el sitio productivo correcto.

## 2. Servidor y programas

La configuración inicial descrita en la guía usa Ubuntu 24.04 LTS x86_64,
e2-medium (2 vCPU compartidas y 4 GiB de RAM) y disco persistente pd-balanced
de 50 GB. Debes revisar espacio y recursos según crezcan los datos y la carga.

En la VM necesitas:

- [ ] Docker Engine y el plugin Docker Compose, con soporte para `up --wait`.
- [ ] Git, curl, certificados CA y OpenSSL; UFW si se aplica el firewall de la guía.
- [ ] Bash para ejecutar los scripts de `deploy/`.
- [ ] Puertos públicos TCP 80 y 443 para Caddy y emisión/renovación de HTTPS.
- [ ] SSH restringido al mecanismo autorizado; PostgreSQL y Gunicorn sin puertos públicos.
- [ ] Espacio para imágenes Docker, base de datos, media y copias temporales.

Python, PostgreSQL, Gunicorn y Caddy se ejecutan dentro de contenedores;
no necesitas instalarlos directamente en Ubuntu para este despliegue.
Node.js y npm se necesitan donde se compile el frontend (Netlify o equipo local),
no en la VM del backend. `gcloud` se utiliza desde Cloud Shell o el equipo del
operador si se siguen los comandos de aprovisionamiento de la guía.

## 3. Dependencias de la aplicación

El archivo instalable de Python ya existe:
[backend/requirements.txt](backend/requirements.txt).
`backend/Dockerfile.prod` lo instala al construir la imagen; conserva ese archivo
como fuente de versiones para evitar listas de paquetes diferentes.

Incluye Django, Django REST Framework, Simple JWT, CORS, filtros, documentación
OpenAPI, controlador PostgreSQL, carga de entorno, Gunicorn, WhiteNoise, Pillow y
el soporte de almacenamiento S3 que ya tenía el proyecto. La configuración de
esta VM utiliza almacenamiento filesystem persistente y no requiere un bucket S3.

Para instalar esas dependencias en un entorno Python aislado de validación:

```bash
python -m pip install -r backend/requirements.txt
```

Para el frontend, las dependencias están en `package.json` y `package-lock.json`:

```bash
npm ci
npm run typecheck
npm run build
```

Antes del build productivo debes configurar
`VITE_API_URL=https://DOMINIO_API/api/v1`. El build exige una API HTTPS pública;
las variables `VITE_*` se incorporan al bundle y nunca deben contener secretos.
No necesitas añadir Redis, Celery ni PostGIS para esta arquitectura.

## 4. Archivos que debes conservar para producción

| Archivo | Uso |
| --- | --- |
| `compose.prod.yml` | Servicios y volúmenes productivos, separados del Compose local. |
| `backend/Dockerfile.prod` | Imagen Python con dependencias y estáticos. |
| `backend/requirements.txt` | Dependencias Python fijadas. |
| `backend/gunicorn.conf.py` | Configuración del servidor Django. |
| `backend/config/settings_production.py` | Seguridad y configuración productiva. |
| `deploy/Caddyfile` | Proxy HTTPS hacia Django. |
| `.env.production.example` | Plantilla sin secretos del entorno de la VM. |
| `deploy/compose.sh` | Ejecutar Compose con el entorno productivo. |
| `deploy/deploy.sh` | Construcción, comprobaciones y migraciones controladas. |
| `deploy/backup.sh` | Copias coherentes de PostgreSQL y media. |
| `netlify.toml` | Compilación y rutas SPA del frontend existente. |

## 5. Entorno y secretos que debes preparar

Copia [.env.production.example](.env.production.example) a `.env.production`
únicamente en la VM. Completa los valores y aplica permisos `chmod 600`.
No subas el archivo real a Git ni guardes contraseñas en este documento.

- [ ] `API_DOMAIN`: hostname real de la API, sin protocolo ni ruta.
- [ ] `ACME_EMAIL`: correo del operador.
- [ ] `SERVIPROX_RELEASE`: commit o etiqueta de la imagen que se desplegará.
- [ ] `DJANGO_SECRET_KEY`: clave aleatoria de al menos 50 caracteres.
- [ ] `DJANGO_ALLOWED_HOSTS`: dominio API y `127.0.0.1` para el health interno.
- [ ] `CORS_ALLOWED_ORIGINS`: origen exacto de Netlify y los WebViews necesarios.
- [ ] `CSRF_TRUSTED_ORIGINS`: origen HTTPS de la API para Django Admin.
- [ ] `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: credenciales propias.
- [ ] Mantener `DJANGO_DEBUG=False`, `DJANGO_SETTINGS_MODULE=config.settings_production`,
  `SERVIPROX_DATABASE=postgres` y `SERVIPROX_MEDIA_STORAGE=filesystem`.
- [ ] Mantener la conexión privada `POSTGRES_HOST=db`, `POSTGRES_PORT=5432`
  y `POSTGRES_SSLMODE=disable` dentro de esta VM.
- [ ] Revisar HSTS, workers, zona horaria y radio de búsqueda del ejemplo.
- [ ] Completar `DEFAULT_FROM_EMAIL`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`,
  `EMAIL_HOST_PASSWORD` y `EMAIL_USE_TLS` para el correo real.
- [ ] Configurar `VITE_API_URL` en el build de Netlify y generar una nueva publicación.
- [ ] Guardar copia segura del entorno fuera de la VM, separada del backup de datos.

Los volúmenes `postgres_data`, `media_data`, `caddy_data` y `caddy_config` deben
persistir entre reinicios. No ejecutar `down -v` sobre el proyecto productivo.

## 6. Comprobaciones antes de publicar

- [ ] Construir la imagen definitiva y ejecutar las pruebas con las dependencias
  fijadas y PostgreSQL en un entorno desechable separado de producción.
- [ ] Ejecutar `python manage.py check --deploy` con el perfil productivo.
- [ ] Ejecutar tests backend, pruebas frontend, typecheck y build.
- [ ] Validar `docker compose config` y la configuración de Caddy.
- [ ] Aplicar migraciones como tarea controlada y crear superusuario interactivamente.
- [ ] Cargar catálogo y datos reales revisados; no ejecutar `seed_demo.py` automáticamente.
- [ ] Verificar HTTPS, health, CORS, login, refresh y persistencia de sesión desde Netlify.
- [ ] Comprobar los tres métodos existentes: catálogo/servicio, diagnóstico y proximidad.
- [ ] Comprobar viviendas, solicitudes, gestión profesional, órdenes, fotos y calificaciones.
- [ ] Comprobar persistencia de fotos tras reinicio y ensayar backup/restauración.
- [ ] Validar Android/iOS en dispositivos cuando se distribuyan sus aplicaciones.

La imagen productiva y la combinación Django 5.2/PostgreSQL todavía requieren
validación real; las pruebas previas del backend se ejecutaron con Django 5.0.6
y SQLite. Consulta los resultados y limitaciones en el reporte enlazado abajo.

## 7. Procedimiento y resultados

- [Guía exacta: VM, Docker, DNS, HTTPS, despliegue, Netlify, backups y rollback](docs/DESPLIEGUE_GCP.md).
- [Resultados reales de validación y comandos para probar la imagen con PostgreSQL](docs/VALIDACION_GCP.md).
- [Auditoría del repositorio y los tres métodos de búsqueda](docs/AUDITORIA_GCP.md).

Cuando completes los accesos y valores pendientes, utiliza la guía de despliegue
como procedimiento paso a paso. No se ha ejecutado ninguna operación en GCP ni
publicación en Netlify al crear este archivo.
