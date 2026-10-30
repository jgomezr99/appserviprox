Hecho por JUAN PALO GOMEZ ROBLES
PROYECTO DE LA UNIVERSIDAD

abrir el proyecto  git clone -b base https://github.com/jgomezr99/appserviprox.git appserviprox && cd appserviprox && code .
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
`activar_inicio_automatico.bat` registra la tarea programada "Serviprox API" (sin permisos
de administrador): al iniciar sesion ejecuta `servidor_api.ps1`, que mantiene Django con
SQLite activo en el puerto 8000 y lo reinicia si se detiene. Aplica migraciones pendientes
al arrancar, escribe su registro en `%LOCALAPPDATA%\Serviprox\api.log` y desactiva accesos
de Inicio que apunten a otra copia del proyecto. Para quitarla:
`Unregister-ScheduledTask -TaskName "Serviprox API" -Confirm:$false`.

6. Despliegue rápido: Netlify + Render

El blueprint `render.yaml` crea el servicio Django `serviprox-backend` y la base
PostgreSQL `serviprox-db`. Render inyecta la cadena privada en `DATABASE_URL`;
no copies esa cadena al repositorio ni a una variable `VITE_*`.

1. En Render, crea un **Blueprint** desde este repositorio y acepta ambos
   recursos. Espera a que la comprobación
   `https://serviprox-backend.onrender.com/api/v1/health/` responda
   `{"status":"ok","database":"connected"}`.
2. `npm run build` y `netlify.toml` usan
   `https://serviprox-backend.onrender.com/api/v1` por defecto, por lo que
   Netlify, Vercel y Cloudflare pueden compilar el frontend. Si Render asigna
   otro hostname, configura `VITE_API_URL` con la URL correcta en el proveedor
   y vuelve a desplegar.
3. Si el sitio Netlify productivo no es `https://serviproxweb.netlify.app`,
   actualiza `CORS_ALLOWED_ORIGINS` en Render con su origen HTTPS exacto y
   vuelve a desplegar el backend. No uses comodines.
4. Crea un usuario de administración y carga el catálogo real desde la consola
   de Render con `cd backend && python manage.py createsuperuser`. No ejecutes
   `backend/seed_demo.py` en producción.

El plan gratuito usa almacenamiento local efímero para fotos y evidencias: los
archivos pueden perderse al reiniciar o redesplegar. Configura almacenamiento
persistente antes de usarlo con datos reales.

Credenciales demo:
- Cliente: camila@demo.serviprox.co / serviprox2026
- Profesional: andres.ruiz@demo.serviprox.co / serviprox2026

_______________________________________________________________________________________________
admin  login 
  email: adimin@serviprox.com
 clave:  serviprox2026

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
se conserva. La ruta Render anterior permite validar la aplicación rápidamente;
para datos reales, mantén la arquitectura de VM, volúmenes y copias indicada en
esta sección. VITE_API_URL=https://DOMINIO_API/api/v1 se fija al compilar en
Netlify/apps; nunca contiene secretos. El build productivo exige una API HTTPS publica configurada.
Para builds locales HTTP usar --mode development y, solo para Capacitor local,
CAPACITOR_ALLOW_CLEARTEXT=true. No ejecutar seeds demo en produccion.

Web y Capacitor usan la misma `VITE_API_URL`; ninguno se conecta directamente a
PostgreSQL. Django conserva conexiones PostgreSQL y comprueba su estado antes de
reutilizarlas. La compilacion de produccion se detiene si falta una URL HTTPS valida,
para evitar publicar clientes sin backend.

### Publicar el frontend en Vercel

`vercel.json` configura el build Vite, `dist` y el fallback SPA para que las rutas
internas funcionen al abrirlas o recargarlas directamente. Usa la URL del backend
de Render como valor predeterminado y permite sustituirla con `VITE_API_URL` en
Production y Preview. Vercel solo sirve el frontend; Django y PostgreSQL siguen
ejecutandose en el servidor backend.

Agrega el origen HTTPS exacto del proyecto Vercel a `CORS_ALLOWED_ORIGINS` en el
backend; no habilites comodines para previews. Para una release movil, compila con
el mismo `VITE_API_URL` y despues ejecuta `npx cap sync android` o `npx cap sync ios`.
