# Diagnóstico del flujo de servicios

Fecha: 3 de noviembre de 2026.

Alcance: código local de creación de solicitudes, aceptación profesional, seguimiento, pagos, solicitudes guardadas, estilos y datos iniciales. Este documento propone correcciones; no modifica el funcionamiento ni los registros existentes.

La revisión confirma causas concretas para los problemas funcionales. La procedencia exacta de los registros de producción y el aspecto en dispositivos reales requieren contrastar el despliegue con este código.

## 1. El servicio aparece iniciado antes de que el profesional acepte — prioridad alta

### Causa

- `backend/apps/service_requests/views.py:97`: crear una solicitud dirigida también crea una orden con estado `traveling` y un evento que anuncia que el profesional está en camino. La solicitud conserva su estado inicial `open`.
- `backend/apps/service_requests/services.py:78`: aceptar busca una orden existente. Si ya existe, la reutiliza sin cambiar su estado. Por tanto, la aceptación no corrige la orden creada anticipadamente.
- `src/pages/ClientProfessionalDetail.tsx:388` y `src/components/servicios/TomarServicioModal.tsx:275`: ambos envíos redirigen automáticamente al seguimiento, usando indistintamente el ID de orden o el de solicitud.
- `src/pages/WorkTrackingPage.tsx:133`: cuando no encuentra una orden, la pantalla puede fabricar un objeto con estado `traveling`, profesional de respaldo, calificación, código y coordenadas. Esto también afecta solicitudes sin profesional asignado.
- `src/pages/WorkTrackingPage.tsx:638`: los estados `requested`, `accepted`, `scheduled` y `cancelled` carecen de etiquetas en esta pantalla y pueden mostrarse como “En camino”.

Las opciones “Puedo esperar”, “Esta semana” y “Urgente” se envían como `urgency`. El bloque que crea la orden en camino no depende de esa opción. Estos formularios tampoco envían una fecha `scheduled_for`.

### Corrección propuesta

Crear inicialmente una solicitud pendiente de respuesta. Crear la orden `accepted` al aceptar el profesional, o mantener una orden `requested` y hacer su transición real al aceptar; elegir un único contrato y aplicarlo en todos los accesos. Separar aceptación, agenda e inicio del desplazamiento. El seguimiento debe representar todos los estados reales del servidor y los errores de carga explícitamente.

Al rechazar, cancelar cualquier orden pendiente asociada según la política elegida: hoy `reject_request` solo cambia la solicitud, de modo que puede quedar una solicitud rechazada con una orden en camino.

## 2. El mapa y la distancia siguen visibles después de llegar — prioridad alta

### Causa

- `src/pages/WorkTrackingPage.tsx:673`: el mapa y sus tarjetas se renderizan para cualquier estado. La leyenda de la línea 677 siempre dice “en ruta”.
- `src/pages/WorkTrackingPage.tsx:323`: si las posiciones coinciden, se desplaza artificialmente al profesional para que exista un trayecto visible.
- Las estimaciones de respaldo imponen al menos 1,1 km y 4 minutos; la barra visual tiene un progreso fijo del 65 % (`:772`). Los textos de tráfico se deducen de la duración, sin una fuente de tráfico en vivo.
- Hay ubicaciones y una dirección de Bogotá como respaldo. Además, crear la solicitud puede guardar coordenadas ficticias en viviendas y perfiles que no tenían coordenadas (`backend/apps/service_requests/views.py:87`).
- La consulta de ruta y el observador GPS no se restringen a un servicio en desplazamiento. El efecto de Leaflet depende del objeto completo `order`, que se reemplaza en cada actualización, provocando recreaciones innecesarias del mapa.

### Corrección propuesta

Mostrar ruta, distancia y llegada estimada durante `traveling`. Al llegar, sustituir el trayecto por “Profesional en el lugar”; durante la ejecución, mostrar progreso del trabajo y evidencias. Usar coordenadas reales y un estado “Ubicación no disponible” cuando falten. Mantener estimaciones claramente identificadas y eliminar desplazamientos y progresos inventados. Separar creación del mapa y actualización de marcadores. Detener el seguimiento GPS cuando termine o se cancele el servicio.

## 3. No se puede terminar y falta una experiencia de servicio finalizado — prioridad alta

### Causa

- `backend/apps/orders/services.py:35`: solo se permite `completed` desde una transición válida y con `payment_status=paid`. Un trabajo en ejecución con pago pendiente recibe un error 400 específico.
- `src/pages/WorkTrackingPage.tsx:538`: todos los errores se sustituyen por “Este cambio de estado todavía no está disponible”, ocultando el motivo y la siguiente acción.
- La creación directa y la aceptación no fijan `estimate_min`, `estimate_max` ni `final_price`. La tarifa que se ve en el perfil no se copia automáticamente a la orden.
- `backend/apps/orders/views.py:82` y `src/components/historiadepago/historiapago.tsx:151`: el checkout necesita un monto y el botón de pago se deshabilita si no existe. El flujo habitual no incluye una acción conectada para acordar y guardar ese monto.
- `src/pages/WorkTrackingPage.tsx:872`: el profesional ve todos los botones, aunque el servidor rechace saltos de estado. El cliente no tiene una acción de cierre en esta pantalla.
- Aunque una orden llegue a `completed`, se conserva la misma pantalla: mapa, estimaciones y controles. El párrafo del encabezado incluso sigue diciendo que el profesional está realizando el servicio (`:644`). La transición tampoco cierra la solicitud asociada.

### Corrección propuesta

Separar el estado del trabajo del estado de pago. Como propuesta de producto, permitir “Trabajo terminado” al concluir la ejecución y mostrar por separado “Pago pendiente” hasta que llegue la confirmación; la regla actual exige cobrar antes de finalizar. Si se conserva esa regla, incorporar primero el acuerdo de precio, el checkout y mensajes claros sobre el bloqueo.

Ofrecer únicamente las transiciones válidas para el actor y el estado actual. Añadir una vista final con fecha de cierre obtenida del evento, resumen, precio acordado, estado de pago, evidencias y calificación. Sincronizar la solicitud y la orden en una transacción, y retirar controles incompatibles con estados terminales.

## 4. Salir del seguimiento impide retomarlo — prioridad alta

### Causa

Los registros sí se guardan y la ruta `/seguimiento/:id` sí existe. El problema combina navegación incompleta, ambigüedad de IDs y carga de listas:

- Cliente: `src/components/misreservas/misreserva.tsx:352` ya tiene “Ver seguimiento” si hay ID de orden. Para solicitudes sin orden no ofrece ese acceso.
- Profesional: `src/pages/ProfessionalRequestDetailPage.tsx:108` redirige al seguimiento al aceptar, pero el detalle posterior solo ofrece aceptar, rechazar y volver. No hay un botón para retomar la orden.
- `src/App.tsx:310`: `/profesional/trabajos` está implementada con `RolePlaceholderPage`, sin consultar trabajos reales.
- `src/pages/WorkTrackingPage.tsx:116`: primero se interpreta el ID como orden y, solo si falla, como solicitud. Una solicitud y otra orden propia pueden compartir el número; el destino puede ser incorrecto. Los permisos de consulta del backend siguen limitando qué registros puede recuperar cada usuario.
- El botón de regreso del seguimiento apunta siempre a `/cliente/solicitudes`, incluso para profesionales.
- Las listas se cargan al montar, sin usar la entrada de vista de Ionic para actualizar al regresar. En el cliente se convierten errores individuales en listas vacías, lo que puede aparentar que desaparecieron registros.
- `src/services/serviprox.ts:104` y `:127` descartan las páginas posteriores de solicitudes y órdenes. El backend pagina de 20 en 20 (`backend/config/settings.py:261`); los servicios más antiguos pueden quedar fuera de la interfaz.

### Corrección propuesta

Implementar “Servicios activos” e historial para ambos roles, con acceso permanente al detalle o seguimiento de cada registro. Usar rutas de solicitud y orden con identificadores inequívocos; resolver la relación en el servidor. Añadir “Continuar seguimiento” al detalle profesional, regreso según rol, actualización al entrar a la vista y paginación explícita. Los errores de carga deben distinguirse de una lista realmente vacía.

## 5. Adaptación a móvil incompleta — prioridad media

Hay estilos adaptables, por lo que el código no permite afirmar que todas las vistas carezcan de responsive. Sí se encuentran puntos concretos que explican los problemas reportados:

- `src/pages/WorkTrackingPage.css:75`, `:116` y `:673`: barra del mapa, acciones y etiquetas de progreso en filas flex sin cambio de disposición para pantallas estrechas. El único bloque móvil (`:588`) ajusta la barra de datos y el código, pero no esas filas.
- `src/pages/WorkTrackingPage.tsx:808`: nombre e insignia comparten una fila sin ajuste de línea; `.tracking-person-info` carece de `min-width: 0`.
- `src/pages/ClientProfessionalDetail.css:131`: el resumen exige columnas de al menos 280 px, además del padding del contenedor y de la tarjeta. Puede exceder el espacio disponible en móviles de 320 px.
- `src/pages/RolePages.css:89`: los encabezados de tarjetas mantienen título y badge en una fila, con ajustes móviles específicos solo para algunas pantallas.

### Corrección propuesta

Permitir salto de línea y apilado en las filas citadas, usar `min-width: 0` y cortes de texto largo, adaptar los mínimos de las grillas al espacio disponible y revisar los estilos compartidos. Verificar visualmente 320, 360, 390, 768 y 1024 px, orientación horizontal, nombres/direcciones largos y teclado abierto. Esta auditoría de estilos no sustituye esa comprobación visual.

## 6. Hay datos demo tanto en pantallas como en mecanismos de carga — prioridad alta

### Fuentes confirmadas en el código

| Fuente | Comportamiento | Evidencia |
| --- | --- | --- |
| Mapa de profesionales | Arranca con contratistas fijos; conserva la lista previa si la API falla, responde vacía o no tiene coordenadas válidas. En una carga inicial puede aparentar profesionales reales con una base vacía. | `src/pages/ContractorMapPage.tsx:260`, `:360`, `:376`; `src/data/contractorMapData.ts:68` |
| Tienda | Agrega siempre cuatro productos fijos a los productos del servidor, incluso en producción. | `src/pages/StorePage.tsx:124`, `:186` |
| Administración | Inicializa clientes, profesionales, beneficios, PQR e incidencias con listas fijas. En PQR e incidencias combina respuestas reales con elementos iniciales que no comparten ID, en lugar de reemplazarlos. | `src/admin/AdminDashboard.tsx:241`, `:308`, `:423`, `:656`, `:948`, `:1825`, `:1868`, `:2192`, `:2222` |
| Panel profesional | Inicializa conversaciones de ejemplo y utiliza una caché de perfil cuya clave no incluye la cuenta. | `src/pages/ProfessionalDashboard.tsx:56`, `:91`, `:117` |
| Seguimiento | Puede generar una orden solo en memoria, con datos de respaldo. Además presenta 5,0 como calificación cuando no hay una positiva. | `src/pages/WorkTrackingPage.tsx:133`, `:819` |
| Persistencia del navegador | Conserva listas y configuraciones entre visitas; varias claves no están separadas por cuenta. | `src/admin/AdminDashboard.tsx:397`; `src/pages/ProfessionalDashboard.tsx:91` |
| Seed de Django | Crea categorías, servicios, usuarios, viviendas, perfiles, métricas, PQR, incidencias y solicitudes de ejemplo. | `backend/seed_demo.py:233`, `:279`, `:341`, `:496`, `:562`, `:676` |
| Lanzador local | Ejecuta `seed_demo.py` si no existe `.seed_done`; elimina ese marcador al aplicar migraciones pendientes y vuelve a intentar cargar el seed. | `backend/start_local.bat:55`, `:69` |

El README afirma que el lanzador no aplica seeds, pero el archivo actual sí lo hace. Los archivos Compose y Render revisados no invocan directamente `seed_demo.py`; por ello no se puede atribuir la carga en producción a ese lanzador sin revisar cómo se desplegó o si se restauró una base existente.

Las listas iniciales de PQR del módulo `src/data/pqrInitialData.ts:119` están vacías: no deben confundirse con las listas iniciales del panel administrativo. La selección de cuentas demo en autenticación está condicionada a `import.meta.env.DEV` (`src/context/AuthContext.tsx:115`); los datos fijos de mapa, tienda y administración no tienen esa misma restricción.

### Corrección propuesta

Usar exclusivamente respuestas de API para información operativa en producción, con estados de carga, vacío y error. Aislar los ejemplos en un modo demo explícito. Reemplazar las listas del servidor en lugar de mezclarlas con datos iniciales. Separar cachés por usuario y limpiarlas al cerrar sesión. Convertir la carga de datos demo en una operación manual exclusiva de desarrollo.

Para aclarar los datos ya desplegados: identificar API y versión publicadas, comparar registros de API con lo dibujado en pantalla, inventariar la base y revisar sus importaciones. Con respaldo y clasificación del origen, hacer una limpieza selectiva que conserve datos reales. El `--reset` del seed borra todas las órdenes y solicitudes (`backend/seed_demo.py:401`); no sirve como limpieza selectiva.

## Hallazgos adicionales del mismo flujo

- **Autorización de estados:** `backend/apps/orders/views.py:55` comprueba acceso a la orden, pero no diferencia qué transiciones puede ejecutar un cliente y cuáles un profesional. Ocultar botones en React no impide que un cliente use la API sobre su propia orden. Definir y validar permisos por acción en el servidor.
- **Código de llegada:** `src/pages/WorkTrackingPage.tsx:847` solo compara el código en el navegador y muestra un toast; no persiste una verificación. El mismo código también se muestra al profesional. Incorporar validación del servidor y registrar quién verificó y cuándo.
- **Viviendas ajenas:** `backend/apps/service_requests/serializers.py:124` sustituye una vivienda que no pertenece al usuario, o crea una copiando su dirección. Debe devolver un error de pertenencia. Esta validación también introduce escrituras durante la validación y puede producir registros inesperados.
- **Pago demo:** `backend/apps/orders/views.py:104` bloquea la confirmación simulada solo cuando Wompi está configurado y `DEBUG` es falso. Si Wompi falta, el endpoint permite confirmar sin cobro incluso con `DEBUG=False`. Restringirlo mediante una bandera explícita de pruebas y deshabilitarlo en producción.

## Orden recomendado de corrección

1. Unificar creación, aceptación, rechazo y permisos; eliminar órdenes simuladas y reparar los estados de registros existentes según sus eventos reales.
2. Completar precio, pago y cierre; ofrecer transiciones válidas y mensajes que expliquen bloqueos.
3. Implementar recuperación de servicios activos e historial para ambos roles, IDs inequívocos y paginación.
4. Hacer que mapa, controles y resumen dependan del estado real; retirar coordenadas y métricas inventadas.
5. Retirar fuentes demo de producción y revisar los registros existentes con clasificación de origen.
6. Corregir responsive y validar visualmente el flujo completo.

## Casos de aceptación para la corrección

- Crear solicitudes flexibles, semanales y urgentes: ninguna anuncia desplazamiento antes de la acción profesional correspondiente.
- Crear una solicitud sin profesional: permanece pendiente de asignación y no muestra un profesional inventado.
- Aceptar o rechazar una solicitud creada por la API: solicitud, orden y eventos concuerdan; repetir la acción no duplica órdenes.
- Cambiar sucesivamente a en camino, llegó y trabajando: la ruta de llegada se muestra únicamente mientras corresponde.
- Terminar con pago pendiente y pagado según la política elegida; definir monto y completar checkout en entorno de pruebas. Mostrar el error concreto ante una transición inválida.
- Salir, recargar y volver en ambos roles; recuperar el mismo servicio desde su lista. Incluir más de 20 registros y IDs de solicitud/orden coincidentes.
- Abrir una base vacía, una API caída y un navegador sin caché: ninguna pantalla presenta ejemplos como datos operativos.
- Cambiar de cuenta en el mismo navegador: el perfil, los servicios y los datos guardados corresponden a la sesión actual.
- Validar móviles y tabletas con contenido largo y todos los estados, incluido el cierre.
- Verificar que el cliente no puede ejecutar transiciones profesionales, que la llegada se valida en el servidor y que producción rechaza pagos demo.

## Verificación de esta auditoría

- Revisión estática de rutas, controladores, modelos, serializadores, componentes, estilos, scripts de inicio y pruebas existentes.
- `npm.cmd run typecheck`: terminó sin errores. `npm.cmd run test.unit -- --run`: 5 archivos y 22 pruebas aprobados. Las pruebas actuales del frontend no incluyen el recorrido completo de solicitud, aceptación, seguimiento y cierre.
- `git diff --check`: sin errores de formato. El único archivo agregado por la auditoría es este informe.
- La prueba de aceptación existente (`backend/apps/service_requests/tests.py:237`) crea la solicitud directamente con el ORM, omitiendo el endpoint que introduce la orden anticipada. La prueba de creación (`:133`) no comprueba que el servicio siga sin iniciar. Esta separación deja sin cubrir el caso real reportado.
- Las pruebas de pago existentes (`:361` y `:389`) documentan el bloqueo de cierre sin pago y el cierre con pago confirmado.
- La ejecución de pruebas Django no estuvo disponible: el Python local no tiene Django y Docker devolvió un error 500 al consultar los contenedores. No se iniciaron servicios ni se aplicaron migraciones o seeds para esta auditoría.
- Pendiente de contraste: URL y versión de producción, respuestas reales de su API, inventario de registros desplegados y comprobación visual por tamaño de pantalla.
