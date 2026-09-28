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
4. Ejecutar la aplicación completa en el navegador

Haz doble clic en `iniciar_serviprox.bat` desde la carpeta del proyecto. El
archivo inicia el backend, aplica las migraciones de SQLite y arranca el
frontend automáticamente.

El modo local usa siempre `backend/db.sqlite3`. Docker selecciona PostgreSQL
de forma explícita y conserva sus datos en el volumen `postgres_data`.

Para que se inicie automáticamente cada vez que entres a Windows, ejecuta una
sola vez `activar_inicio_automatico.bat`. Esto crea un acceso directo en la
carpeta de Inicio de Windows.

También puedes ejecutar solo el frontend con:

```text
ionic serve
```
Tu app se abrirá en:
👉 http://localhost:8100/

5. Ejecutar backend y base de datos local manualmente

En otra terminal, desde la carpeta del proyecto:

backend\start_local.bat

Este comando crea el entorno virtual, instala las dependencias, aplica las migraciones
de SQLite, carga los datos demo y deja la API disponible en:
http://localhost:8000/api/v1/

Para usar la app en un emulador Android, el backend local queda disponible en
`http://10.0.2.2:8000` automáticamente. Para usar la app en un celular
conectado a la misma red Wi-Fi:

1. Ejecuta `ipconfig` y copia la IPv4 del computador, por ejemplo `192.168.1.20`.
2. Crea un archivo `.env.local` en la raiz del proyecto con:

```text
VITE_API_URL=http://192.168.1.20:8000/api/v1
```

3. Mantén el backend ejecutándose con `backend\start_local.bat`.
4. Ejecuta `npm.cmd run build` y después `npx cap sync android` o `npx cap sync ios`.

El celular y el computador deben estar en la misma red. En una instalación publicada,
usa una URL HTTPS real en `VITE_API_URL` y desactiva `server.cleartext`.

Credenciales demo:
- Cliente: camila@demo.serviprox.co / serviprox2026
- Profesional: andres.ruiz@demo.serviprox.co / serviprox2026

Recuperacion de contrasena:
- En desarrollo, sin configurar correo, el codigo de 6 digitos aparece en la consola del backend.
- Para enviarlo por correo real, copia las variables `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`,
  `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` y `EMAIL_USE_TLS` desde `.env.example` a `.env`.
  Al definir `EMAIL_HOST`, Django usa SMTP automáticamente.
- Después de editar `.env`, cierra y vuelve a ejecutar `iniciar_serviprox.bat`.

<img width="2056" height="765" alt="image" src="https://github.com/user-attachments/assets/4915fc92-bb99-4232-870f-7c424c0b6d6e" />
