# Despliegue de Serviprox en Compute Engine

Estado: preparacion del repositorio, no despliegue realizado.
Arquitectura definitiva: Netlify (React/Capacitor) -> HTTPS -> Caddy -> Gunicorn/
Django -> PostgreSQL privado en una VM Ubuntu 24.04 LTS. No Redis/Celery/PostGIS.
Los comandos siguientes son para ejecutar por un operador autorizado; no se han
ejecutado en GCP/Netlify. Sustituir TODOS los placeholders antes de usarlos.

## 1. Requisitos y recursos iniciales

Necesitas proyecto GCP con facturacion, Compute Engine habilitado, permisos para
VM/red/IP/firewall e IAM/OS Login/IAP; acceso al repositorio, DNS de un dominio y
configuracion de builds en Netlify. No hay proyecto, VM, IP ni dominio asumidos.
El frontend permanece en su sitio actual.

Para MVP: e2-medium (2 vCPU compartidas, 4 GiB), Ubuntu 24.04 LTS x86_64 y disco
persistente pd-balanced de 50 GB como inicio. Evaluar e2-standard-2 (2 vCPU,
8 GiB) para carga sostenida, builds o mayor concurrencia. Dos workers Gunicorn,
dos threads cada uno; medir CPU/RAM/latencia/espacio antes de subir concurrencia.
Las fotos crecen: alertar al 70/85% y ampliar disco antes de agotarlo.
Elegir region por latencia medida desde Colombia, disponibilidad y presupuesto;
no se estiman precios. Una VM no proporciona alta disponibilidad.

Los volumenes Docker viven en el disco persistente de la VM (/var/lib/docker).
Se evita borrar el disco al eliminar la VM, pero se requieren backups fuera de
esa VM. No cambiar el data-root de Docker sin una migracion documentada.
No poner bases ni fotos en el repositorio.

## 2. Crear red, IP estatica, firewall y VM

En Cloud Shell o equipo con gcloud autenticado (solo despues de autorizacion):

```bash
export PROJECT_ID="PROJECT_ID"
export REGION="REGION_GCP"
export ZONE="ZONA_DE_LA_REGION"
export VM_NAME="serviprox-api"
export NETWORK="serviprox"
gcloud config set project "$PROJECT_ID"
gcloud services enable compute.googleapis.com iap.googleapis.com
gcloud compute networks create "$NETWORK" --subnet-mode=custom
gcloud compute networks subnets create serviprox-subnet \
  --network="$NETWORK" --region="$REGION" --range=10.80.0.0/24
gcloud compute addresses create serviprox-api-ip --region="$REGION"
gcloud compute addresses describe serviprox-api-ip --region="$REGION" \
  --format='get(address)'
# Copiar la IP reservada:
export STATIC_IP="IP_ESTATICA_RESERVADA"
gcloud compute firewall-rules create serviprox-web \
  --network="$NETWORK" --direction=INGRESS --action=ALLOW \
  --rules=tcp:80,tcp:443 --source-ranges=0.0.0.0/0 --target-tags=serviprox-api
gcloud compute firewall-rules create serviprox-ssh-iap \
  --network="$NETWORK" --direction=INGRESS --action=ALLOW \
  --rules=tcp:22 --source-ranges=35.235.240.0/20 --target-tags=serviprox-api
gcloud compute instances create "$VM_NAME" \
  --zone="$ZONE" --machine-type=e2-medium \
  --subnet=serviprox-subnet --address="$STATIC_IP" \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB --boot-disk-type=pd-balanced \
  --no-boot-disk-auto-delete --shielded-secure-boot --no-service-account \
  --metadata=enable-oslogin=TRUE --tags=serviprox-api
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --tunnel-through-iap
```

El operador necesita permisos IAP TCP y OS Login con sudo (por ejemplo roles
iap.tunnelResourceAccessor y compute.osAdminLogin, segun la politica del proyecto).
No conceder roles a usuarios publicos. Alternativa: SSH desde IP del operador /32,
nunca abrir 22 a todo Internet. No crear reglas para 5432 ni 8000. Revisar tambien
reglas heredadas/politicas organizacionales: un firewall nuevo no anula otros ALLOW.

Crear registro DNS A de DOMINIO_API (ej. api.tudominio.com) hacia STATIC_IP. No usar
el dominio del frontend como dominio API. No crear AAAA sin configurar IPv6.
Esperar propagacion; usar DNS directo durante la primera emision de certificados.
Puertos 80 y 443 deben alcanzar Caddy desde Internet para ACME.
La IP reservada puede generar cargos incluso sin uso; gestionarla conscientemente.

## 3. Instalar Docker Engine y Compose en Ubuntu 24.04

En la VM:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git openssl ufw
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo usermod -aG docker "$USER"
```

Salir y reconectar por SSH para aplicar grupo docker. Ese grupo equivale a acceso
root; solo operadores de confianza. Si ya hay Docker instalado, revisar origen
antes de mezclar paquetes. Mantener actualizaciones de seguridad de Ubuntu/Docker.

Firewall del host, conservando la sesion SSH actual:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 35.235.240.0/20 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Docker puede eludir reglas UFW para puertos publicados; la proteccion principal
es no publicar backend/DB y limitar GCP. Solo Caddy publica 80/443.

## 4. Repositorio, entorno y secretos

```bash
sudo install -d -m 0750 -o "$USER" -g "$USER" /srv/serviprox
git clone REPOSITORIO_GIT /srv/serviprox/app
cd /srv/serviprox/app
git checkout COMMIT_REVISADO
umask 077
cp .env.production.example .env.production
chmod 600 .env.production
git rev-parse HEAD
openssl rand -hex 32
openssl rand -hex 32
nano .env.production
```

Generar dos valores distintos: DJANGO_SECRET_KEY y POSTGRES_PASSWORD. Pegarlos
solo en el archivo protegido; no pegarlos en Git, chat, argumentos CLI ni VITE_*.
Guardar copia del entorno en gestor de secretos/caja cifrada fuera de la VM.
No ejecutar source .env.production: es un env file de Compose, no un script.

Completar:
- API_DOMAIN: solo hostname, sin https:// ni ruta. ACME_EMAIL: correo del operador.
- SERVIPROX_RELEASE: commit revisado (tag de imagen local, conservar el anterior).
- DJANGO_SECRET_KEY: aleatoria >=50 caracteres, no reutilizar clave de desarrollo.
- DJANGO_ALLOWED_HOSTS=DOMINIO_API,127.0.0.1 (127.0.0.1 es health interno).
- CORS_ALLOWED_ORIGINS: origen EXACTO Netlify y dominios propios usados realmente.
  El sitio encontrado es https://serviproxweb.netlify.app: confirmar su vigencia.
  Mantener https://localhost Android y capacitor://localhost iOS si corresponden.
  Sin barras finales, comodines ni previews globales; previews solo si se aprueban.
- CSRF_TRUSTED_ORIGINS=https://DOMINIO_API para Admin; agregar origen HTTPS del
  frontend solo si se introduce un flujo con cookies/CSRF. JWT no las requiere.
- POSTGRES_DB, POSTGRES_USER y POSTGRES_PASSWORD. Compose fija host db, puerto 5432,
  y SSL desactivado dentro de red Docker privada de la misma VM.
- SERVIPROX_DATABASE=postgres y SERVIPROX_MEDIA_STORAGE=filesystem.
- DJANGO_DEBUG=False. Perfil config.settings_production rechaza opciones inseguras.
- GUNICORN_WORKERS=2, DEFAULT_SEARCH_RADIUS_KM=5, TIME_ZONE=America/Bogota.
- SMTP: DEFAULT_FROM_EMAIL, EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER,
  EMAIL_HOST_PASSWORD, EMAIL_USE_TLS=True para recuperacion de contrasena real.
  Sin SMTP esa funcion queda pendiente; produccion no imprime codigos en consola.

HSTS inicial 3600 segundos. Tras verificar HTTPS puede subirse a 31536000. Aplica
includeSubDomains solo bajo el dominio API; no enviar a la lista preload antes de
revisar todos sus subdominios y la duracion. Cookies Admin Secure/HttpOnly/SameSite
Lax, sin cookies cross-site para JWT. Caddy sobrescribe X-Forwarded-Proto y es el
unico acceso al puerto privado de Gunicorn. No publicar 8000 ni agregar proxies
delante de Caddy sin revisar la cadena de confianza.

## 5. Validar y desplegar por primera vez

Primero probar la imagen y la suite sobre una base desechable separada: ver
VALIDACION_GCP.md. Nunca ejecutar tests contra el volumen productivo.

```bash
cd /srv/serviprox/app
bash deploy/compose.sh config --quiet
bash deploy/deploy.sh initial
bash deploy/compose.sh exec backend python manage.py createsuperuser
bash deploy/compose.sh exec backend python manage.py check --deploy
bash deploy/compose.sh ps
```

El script construye la imagen, inicia PostgreSQL saludable, hace check de
seguridad estricto, muestra plan y ejecuta migraciones como tarea separada, y
solo entonces inicia Gunicorn/Caddy. Gunicorn nunca migra ni ejecuta seed.
collectstatic se realiza al construir la imagen, WhiteNoise sirve /static/.
El usuario del backend es UID/GID 10001 y el volumen media hereda su propiedad.
Credenciales del superusuario se introducen interactivamente, sin variables
versionadas. No ejecutar seed_demo.py ni seed_contractor_services.py.

Las migraciones existentes se conservan; no aplicar migraciones regresivas a
ciegas. En BD nueva, el catalogo debe cargarse con datos reales por Django Admin
o una exportacion revisada sin usuarios/solicitudes demo. La migracion de keywords
solo actualiza registros existentes. Configurar servicios/keywords, profesionales,
cobertura y ubicaciones reales antes de probar resultados de busqueda.

Caddy obtiene y renueva certificados automaticamente para API_DOMAIN; /data y
/config son persistentes. No borrar caddy_data entre reinicios, ni usar un dominio
ficticio para solicitar certificados. Repetir emisiones fallidas puede alcanzar
limites ACME. Examinar errores con:

```bash
bash deploy/compose.sh logs --tail=100 caddy backend db
curl -i https://DOMINIO_API/api/v1/health/
curl -I http://DOMINIO_API/api/v1/health/
curl -I https://DOMINIO_API/static/admin/css/base.css
curl -i https://DOMINIO_API/api/v1/categories/
curl -i https://DOMINIO_API/api/v1/auth/me/
curl -i -X OPTIONS https://DOMINIO_API/api/v1/auth/token/ \
  -H 'Origin: https://serviproxweb.netlify.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

Esperar health 200 con status ok/database connected, HTTP redirigido a HTTPS,
static 200, catalogo 200 con datos reales, perfil anonimo 401; preflight incluye
Access-Control-Allow-Origin EXACTO. Repetir OPTIONS con un origen ajeno y verificar
ausencia de ese header. CORS limita navegadores, no sustituye autorizacion JWT.
No usar curl -k. Revisar que 5432/8000 no sean accesibles externamente.

Fotos y evidencias estan en media_data, sin file_server publico. Solicitudes:
requests/ID/images/ID/; evidencias: orders/ID/evidence/ID/, requieren JWT y
pertenencia. El frontend descarga blobs autenticados sin cambiar su aspecto.
No hay enlaces publicos directos /media/. Limite Caddy: 25 MB por solicitud.

## 6. Conectar Netlify, Android e iOS

En el proyecto existente Netlify: Project configuration -> Environment variables,
crear VITE_API_URL con alcance Builds/contexto Production:

```dotenv
VITE_API_URL=https://DOMINIO_API/api/v1
```

No poner secretos en VITE_*. Conservar comando npm run build y directorio dist,
ya definidos en netlify.toml. Desencadenar una NUEVA compilacion/deploy; cambiar
una variable no modifica archivos ya compilados. Si fuera necesario, limpiar
cache de build. El build rechaza URL ausente, HTTP, localhost o rutas incorrectas.
Los hosts guardados del prototipo se ignoran en produccion. El fallback de sesion
demo solo funciona en desarrollo. No hay cambios de pantallas.

Desde el sitio Netlify, DevTools/Network debe mostrar peticiones HTTPS a API real
y respuestas JSON (nunca index.html SPA). Comprobar Authorization Bearer, login/
recarga/perfil/refresh y todos los flujos de la tabla del apartado 9.
No se envian cookies del frontend; Admin usa sus cookies de mismo origen.

Capacitor reutiliza el mismo VITE_API_URL al compilar y despues npx cap sync
android o ios. Empaquetar/republicar la app; .env en la VM no actualiza bundles.
CORS permite origenes WebView predeterminados indicados arriba; comprobar el
Origin real en dispositivos. cleartext queda desactivado por defecto.
Solo para pruebas locales HTTP, CAPACITOR_ALLOW_CLEARTEXT=true al ejecutar cap
sync y build --mode development; nunca usar ese ajuste en una release publicada.

Web y movil se conectan al mismo backend HTTPS; nunca deben conectarse directamente
a PostgreSQL. Django reutiliza conexiones por 60 segundos y verifica su salud antes
de reusarlas, renovando una conexion cerrada. La API y Compose tienen health checks,
pero una VM unica no garantiza alta disponibilidad si la VM o PostgreSQL se detienen.
No se requiere cambiar appId ni server.url. Probar permisos de ubicacion y archivos
en dispositivo real: el build web no los certifica.

## 7. Actualizaciones, copias y rollback

Versionar/revisar todos los cambios antes de desplegar. Guardar commit y tag de
imagen anteriores. No ejecutar git pull sobre cambios sin revisar.
En cada actualizacion:

```bash
cd /srv/serviprox/app
git fetch --tags origin
git checkout NUEVO_COMMIT_REVISADO
# Editar solo SERVIPROX_RELEASE al commit nuevo en .env.production.
bash deploy/deploy.sh update
```

El script construye primero, valida seguridad y muestra plan. Luego detiene
escrituras, genera backup consistente DB/media, migra y arranca. Si falla durante
backup/migracion, permanece detenido: revisar logs; no reactivar sin entender el
estado. Las migraciones que hagan cambios de datos deben probarse con una copia
antes. No editar POSTGRES_PASSWORD en el env esperando cambiar una DB existente:
esa variable inicializa clusters nuevos; la rotacion requiere ALTER ROLE con
procedimiento seguro y actualizacion coordinada del entorno.

Backup manual (breve interrupcion):

```bash
bash deploy/backup.sh
```

Crea backups/FECHA_UTC con pg_dump custom, media.tar.gz, commit, imagenes y SHA256SUMS.
Para un backup previo a mantenimiento que conserve servicios detenidos:
bash deploy/backup.sh --keep-stopped. Nunca ejecutar dos backups/deploys a la vez.
El script no incluye credenciales en el archivo de copia. Guardar el entorno por
separado. No cambiar volumenes con down -v ni usar volume prune.

Programar backup diario fuera de horas pico; conservar por ejemplo 7 diarios y 4
semanales, cifrados y copiados fuera de la VM por el operador. Esto es una politica
propuesta, no un scheduler ya activo. Configurar destino y comprobar que la copia
externa termina antes de aplicar retencion; no borrar automaticamente el unico
backup. Snapshot de disco puede complementar, no sustituir dump+media coherentes.
Objetivo inicial propuesto: RPO 24h; medir RTO mediante ensayo de restauracion.

Rollback de codigo: si la migracion no se ejecuto o es compatible con el codigo
anterior, restaurar commit y SERVIPROX_RELEASE anteriores y ejecutar
bash deploy/compose.sh up -d --no-build --wait backend caddy. Conservar imagen vieja
antes de podar. No usar el script update para revertir migraciones sin revision.
Si el esquema ya no es compatible, restaurar backup completo en VM/discos nuevos
y validar antes de mover DNS/IP. No ejecutar migrate APP CERO.

## 8. Restauracion y recuperacion

Ensayar en VM separada o proyecto Compose aislado, nunca sobre datos activos.
1. Crear Ubuntu/Docker con el procedimiento anterior y clonar commit del backup.
2. Recuperar .env.production desde gestor seguro (misma clave JWT si se desea
   mantener sesiones), corregir dominio/red, chmod 600.
3. Copiar dump y media cifrados a ruta protegida; validar SHA256SUMS.
4. Usar volumenes VACIOS nuevos. Antes de continuar verificar VM, proyecto,
   docker compose ps y volumenes. Si ya contienen datos, detenerse y elegir otro
   proyecto/VM, sin borrar los originales.
5. Ejecutar:

```bash
cd /srv/serviprox/app
export BACKUP_DIR="/RUTA_PROTEGIDA/FECHA_UTC"
(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)
bash deploy/compose.sh build backend
bash deploy/compose.sh up -d --wait db
bash deploy/compose.sh exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error --no-owner --no-acl' \
  < "$BACKUP_DIR/database.dump"
bash deploy/compose.sh run --rm --no-deps -T --entrypoint tar backend \
  -C /app/media --no-same-owner -xzf - < "$BACKUP_DIR/media.tar.gz"
bash deploy/compose.sh run --rm --no-deps backend python manage.py check --deploy
bash deploy/compose.sh run --rm --no-deps backend python manage.py migrate --plan
# Con el mismo commit del backup no deberia haber migraciones pendientes.
bash deploy/compose.sh up -d --wait --wait-timeout 180 backend caddy
```

Verificar conteos, login, catalogo, tres busquedas, solicitudes/ordenes y fotos,
no solo health. Solo despues asignar la IP estatica a la nueva VM (no simultanea
en dos VM) o cambiar DNS y validar HTTPS/Netlify. Para recuperar el propio disco
tras perder VM: adjuntarlo a una VM de recuperacion sin inicializarlo/formatearlo,
y seguir procedimiento del operador antes de iniciar otra instancia PostgreSQL
sobre esos archivos. Un dump restaurable ofrece recuperacion mas portatil.

## 9. Lista funcional de aceptacion (API + sitio + dispositivos)

Crear usuarios de prueba propios; no cargar seed_demo en produccion.
Verificar todos estos puntos en staging y luego con datos controlados en API real:

| Flujo | Evidencia esperada |
| --- | --- |
| Registro cliente/profesional | POST auth/register/ 201, rol correcto, sin password en respuesta; perfil/vivienda segun contrato. |
| Login, sesion y refresh | auth/token/ -> Bearer -> auth/me/; recargar conserva sesion; access expirado se refresca; refresh invalido cierra sesion. |
| Catalogo y metodo 1 | categories/ y services/?category=ID; professionals/?category=SLUG&service=ID solo ofertas compatibles. |
| Metodo 2 | diagnosis/sessions/ devuelve sugerencias; elegir/descartar y confirmar con requests/; verificar selected_service y followed_suggestion. |
| Metodo 3 y cercania | professionals/?lat=...&lng=...&radius_km=...; profesionales dentro de radio y cobertura, distancias ordenadas; comprobar datos reales en Network. |
| Vivienda | households/ del usuario, actualizar direccion/coordenadas; verificar en API que persistan. |
| Solicitudes | POST requests/ JSON o multipart; cliente solo ve propias, profesional destinatario acepta/rechaza; terceros no acceden. |
| Ordenes | Estado y profesional correctos, transiciones/ubicacion persisten. Se conserva pago demo; no certificar cobros reales. |
| Fotos y evidencias | Upload, lectura con JWT del cliente/profesional, 401/404 para tercero/anonimo; seguir disponibles despues de reinicio y restauracion. |
| Calificaciones | reviews/ para orden completada del cliente; promedio actualizado, terceros rechazados. |
| Plataformas | Netlify HTTPS y Android/iOS instalados: login/refresh, GPS, carga de fotos, red desconectada y reconexion. |

Mapa y seguimiento conservan datos/fallbacks demo del prototipo; una pantalla
con puntos en mapa NO demuestra conexion a PostgreSQL. Revisar respuestas y datos
persistidos. Revisar tambien proveedores externos de rutas/geocodificacion.
Cypress existente de Inbox no valida ninguno de estos flujos.
No declarar Serviprox desplegado hasta verificar VM, API publica y Netlify.

## Referencias oficiales consultadas

- [Django y soporte 5.2 LTS](https://www.djangoproject.com/download/)
- [Checklist Django](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/)
- [Docker para Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [IP estatica Compute Engine](https://docs.cloud.google.com/compute/docs/ip-addresses/configure-static-external-ip-address)
- [Caddy reverse proxy y encabezados](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [Variables de build Netlify](https://docs.netlify.com/build/configure-builds/environment-variables/)
