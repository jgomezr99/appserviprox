Hecho por JUAN PALO GOMEZ ROBLES
PROYECTO DE LA UNIVERSIDAD 
1. Clonar el repositorio
git clone https://github.com/jgomezr99/appserviprox
cd appserviprox
2. Instalar dependencias
npm install
Si aparece algún error de dependencias, prueba:
npm install --legacy-peer-deps
3. Instalar Ionic CLI (si aún no lo tienes)
npm install -g @ionic/cli
Verifica la instalación:
ionic --version
4. Probar con las imagenes Docker existentes

Con Docker Desktop abierto, desde la raiz del proyecto:

```powershell
docker compose -f docker-compose.yml up -d --no-build --no-recreate --pull never db backend
npm.cmd run dev
```

Abre http://localhost:8100/. Se reutilizan las imagenes locales y los contenedores
existentes; si falta un contenedor, se crea usando la imagen disponible.
No se construyen ni descargan imagenes, no se recrean contenedores existentes y
estos comandos no aplican migraciones ni seeds. Si falta una imagen local,
Compose informa el error en lugar de construirla o descargarla.

Si los contenedores ya estan ejecutandose, basta con `npm.cmd run dev`.
Si existen pero estan detenidos, tambien puedes usar
`docker compose -f docker-compose.yml start db backend`.
El Compose actual contiene Django y PostgreSQL; Vite ejecuta solo el frontend y no puede iniciar Python local.

5. Lanzadores manuales con Docker

`iniciar_serviprox.bat` inicia tus contenedores existentes y el frontend.
`backend/start_local.bat` inicia solo los contenedores existentes.
Los lanzadores no crean .venv, instalan dependencias, aplican migraciones ni cargan seeds.
Los scripts de inicio automatico quedaron deshabilitados.

6. Configuracion historica de Render (no usar para el despliegue nuevo)

El blueprint `render.yaml` configura Django con `DEBUG=False`, una clave secreta
generada, PostgreSQL, almacenamiento S3 y migraciones al iniciar el servicio.
Antes del primer despliegue:

1. Crea una base PostgreSQL persistente y un bucket S3 (o compatible) fuera del
   disco efímero del servicio web.
2. Al aplicar el blueprint, completa `POSTGRES_DB`, `POSTGRES_USER`,
   `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `SERVIPROX_S3_BUCKET_NAME`,
   `SERVIPROX_S3_ACCESS_KEY_ID`, `SERVIPROX_S3_SECRET_ACCESS_KEY` y
   `SERVIPROX_S3_REGION_NAME`. Configura `POSTGRES_SSLMODE` y
   `SERVIPROX_S3_ENDPOINT_URL` solo si el proveedor los requiere.
3. Revisa `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` para incluir los
   dominios reales del frontend. El host de Render se agrega desde
   `RENDER_EXTERNAL_HOSTNAME`; agrega manualmente cualquier dominio propio.
4. En el despliegue del frontend, configura `VITE_API_URL` con la URL HTTPS del
   backend seguida de `/api/v1`.
5. Crea un usuario de administración y carga el catálogo real. No ejecutes
   `backend/seed_demo.py` en producción: crea usuarios y datos de demostración.
   Las palabras clave de búsqueda se mantienen como listas JSON en cada
   categoría y servicio desde Django Admin. Crea el usuario desde la consola del
   servicio con `cd backend && python manage.py createsuperuser`.

El inicio del backend aplica las migraciones antes de levantar Gunicorn. No se
incluyen credenciales ni se crea infraestructura de pago automáticamente; el
proveedor, la región y los permisos de PostgreSQL/S3 deben configurarse para la
cuenta de despliegue.

Credenciales demo:
- Cliente: camila@demo.serviprox.co / serviprox2026
- Profesional: andres.ruiz@demo.serviprox.co / serviprox2026

Recuperacion de contrasena:
- En desarrollo, sin configurar correo, el codigo de 6 digitos aparece en la consola del backend.
- Para enviarlo por correo real, copia las variables `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`,
  `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` y `EMAIL_USE_TLS` desde `.env.example` a `.env`.
  Al definir `EMAIL_HOST`, Django usa SMTP automáticamente.
- Los cambios de entorno requieren actualizar explicitamente el contenedor; start conserva su configuracion actual.

<img width="2056" height="765" alt="image" src="https://github.com/user-attachments/assets/4915fc92-bb99-4232-870f-7c424c0b6d6e" />

## Produccion definitiva: Netlify + Google Cloud

El frontend permanece en Netlify. Django, PostgreSQL privado y Caddy se ejecutan
con Docker Compose en Ubuntu 24.04 Compute Engine. No se ha desplegado infraestructura.

- [Requerimientos y lista previa al despliegue](REQUERIMIENTOS_DESPLIEGUE.md)
- [Auditoria y tres metodos de busqueda](docs/AUDITORIA_GCP.md)
- [Guia exacta de VM, DNS, HTTPS, Netlify, backups y rollback](docs/DESPLIEGUE_GCP.md)
- [Resultados y validaciones pendientes](docs/VALIDACION_GCP.md)

Produccion usa compose.prod.yml y .env.production (no versionado). El Compose local
se conserva. render.yaml es historico, no forma parte del procedimiento nuevo.
VITE_API_URL=https://DOMINIO_API/api/v1 se fija al compilar en Netlify/apps; nunca
contiene secretos. El build productivo exige una API HTTPS publica configurada.
Para builds locales HTTP usar --mode development y, solo para Capacitor local,
CAPACITOR_ALLOW_CLEARTEXT=true. No ejecutar seeds demo en produccion.
