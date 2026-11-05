# Ajustes de estados y seguimiento

Rama: `estados`. Fecha: 4 de noviembre de 2026.

Implementación de los puntos 1 a 5 del diagnóstico. Las pruebas se agregaron y actualizaron, pero no se ejecutaron, según la instrucción recibida. La limpieza general de datos demo del punto 6 queda fuera de este cambio.

## Comportamiento nuevo

1. **Solicitud y aceptación:** enviar una solicitud dirigida la deja publicada y pendiente de respuesta, sin crear una orden en camino. Al aceptar, el profesional crea una orden aceptada y se conserva una copia del rango de tarifa de su servicio. Aceptar no inicia el desplazamiento. Las solicitudes sin destinatario muestran pendiente de asignación, sin fabricar un profesional ni una orden.
2. **Desplazamiento:** el profesional puede agendar una visita futura o iniciar expresamente el desplazamiento. El mapa, trayecto y estimación aparecen solo en camino, con coordenadas disponibles. Al confirmar llegada desaparecen. Se retiraron las coordenadas de respaldo, el desplazamiento artificial, el progreso fijo y los textos de tráfico inventados de la pantalla de seguimiento.
3. **Llegada y ejecución:** el código se muestra únicamente al cliente de la orden. El profesional lo ingresa al llegar; el servidor lo comprueba y registra la transición. Después puede comenzar el trabajo, tomar pausas, reanudar y terminar. El servidor restringe las acciones según el actor y el estado.
4. **Cierre y pago:** el profesional puede terminar con pago pendiente. El cierre guarda el evento, cierra la solicitud y presenta fecha, resumen, evidencias, precio, pago y calificación. Puede registrar el valor final acordado antes o después del cierre mientras no haya un pago confirmado o en proceso. El checkout exige ese valor final; el rango estimado no se cobra automáticamente. Las credenciales y configuración de Wompi siguen siendo necesarias para pagos reales.
5. **Retomar servicios:** el cliente dispone de seguimiento tanto para solicitudes pendientes como para órdenes. El profesional tiene Mis trabajos con activos e historial, accesible desde menú, inicio y solicitudes. Las páginas actualizan al regresar y recuperan todas las páginas de la API. Un error de carga se muestra como error, en lugar de aparentar una lista vacía.
6. **Móvil:** las tarjetas, formularios, acciones y textos largos se adaptan al ancho disponible. Se corrigieron mínimos de grillas, saltos de línea, inputs y distribución de botones en seguimiento, solicitud directa, modal de servicio y listas.

El flujo normal es:

`Pendiente de aceptación → Aceptado → [Visita agendada] → En camino → Profesional en el lugar → Trabajando → Trabajo terminado`

El pago tiene su propio estado: pendiente o pagado. Los servicios cancelados permanecen en el historial.

## Dónde validar manualmente

Usar un cliente y un profesional reales del entorno de pruebas, con un servicio ofrecido por ese profesional.

| Vista o ruta | Qué comprobar |
| --- | --- |
| Cliente: solicitud directa y modal Tomar servicio | Probar Puedo esperar, Esta semana y Urgente. El envío abre una solicitud pendiente; no anuncia En camino. |
| `/seguimiento/solicitud/ID_SOLICITUD` | Recargar una solicitud pendiente y salir/volver. Conserva datos reales, sin orden inventada. Cuando el profesional acepta, aparece su orden al actualizar. |
| `/profesional/solicitudes` y `/profesional/solicitudes/ID_SOLICITUD` | Aceptar o rechazar; después retomar el seguimiento desde la lista o el detalle. Aceptar deja Aceptado, no En camino. |
| `/profesional/trabajos` | Revisar Activos, Historial, Todos y búsqueda. Abrir el mismo servicio después de salir o recargar. |
| `/seguimiento/ID_ORDEN` | Profesional: agendar o iniciar desplazamiento, autorizar ubicación, ingresar el código visible al cliente, llegar, comenzar, pausar, reanudar y terminar. |
| Mis solicitudes del cliente | El estado se actualiza. Al llegar o trabajar ya no hay ruta. Al terminar aparece Ver resumen y el trabajo pasa al historial. |
| Resumen del servicio | Fecha real del evento, evidencias existentes, precio, estado del pago separado y calificación del cliente. |
| `/cliente/historialpago?order=ID_ORDEN` | Sin valor final: explica qué falta. Con valor final y Wompi configurado: permite iniciar el checkout. Incluye regreso al seguimiento. |
| Más de 20 solicitudes/órdenes propias | Comprobar que servicios antiguos siguen accesibles. |
| 320, 360, 390, 768 y 1024 px | Comprobar seguimiento, listas, solicitud directa y modal. Probar nombres/direcciones largos, orientación horizontal y teclado móvil. |

El seguimiento consulta cambios cada 8 segundos; las listas, cada 15 segundos y al volver a la vista. La ubicación del profesional se comparte durante el desplazamiento mientras la vista está activa; esta aplicación no implementa un servicio de GPS en segundo plano. Sin coordenadas válidas se informa que la ubicación no está disponible. Una falla de cálculo de ruta conserva los marcadores y explica que no se pudo calcular el trayecto.

## Migración de órdenes anticipadas existentes

Se agregó `orders.0006_reconcile_premature_orders`. No modifica el esquema. Reconoce únicamente el evento generado por el bug: “Solicitud enviada al profesional. En camino a la ubicación del cliente.”

Para órdenes todavía en camino y sin eventos profesionales ni otros avances, corrige el estado según la solicitud: publicada → solicitada, aceptada → aceptada, rechazada/cancelada → cancelada. Conserva los eventos anteriores y agrega uno que explica la corrección. Las órdenes con actividad profesional posterior se conservan. La reversión de esta migración no vuelve a introducir estados incorrectos.

También vuelve a dejar respondibles las solicitudes `matched` del endpoint antiguo de órdenes: si tienen una única orden solicitada y ningún destinatario incompatible, conserva esa orden y vincula al profesional destinatario, con la solicitud pendiente de respuesta.

La migración no fue aplicada durante esta implementación. Para revisar y aplicarla en el entorno local Docker, desde la raíz del repositorio:

```powershell
docker compose exec backend python manage.py migrate --plan
docker compose exec backend python manage.py migrate
```

Estos comandos usan la base del contenedor seleccionado. En producción deben ejecutarse como parte del despliegue del backend correspondiente. El frontend y el backend deben publicarse juntos: la interfaz usa las nuevas acciones autorizadas que devuelve la API.

## Comandos de pruebas para ejecutar

Todos los comandos siguientes se entregan para ejecución por el usuario. Las pruebas no se ejecutaron durante este trabajo.

Frontend, desde la raíz:

```powershell
npm.cmd run test.unit -- --run src/services/workflow.test.ts src/hooks/useLivePage.test.tsx src/pages/WorkTrackingPage.test.tsx src/pages/ServiceLists.test.tsx
```

Toda la suite de pruebas unitarias del frontend:

```powershell
npm.cmd run test.unit -- --run
```

Backend, con los contenedores locales ya ejecutándose y Django disponible:

```powershell
docker compose exec -e DJANGO_DEBUG=true -e DJANGO_SECURE_SSL_REDIRECT=false backend python manage.py test apps.orders apps.service_requests config.test_flows --noinput
```

Django crea una base de pruebas; el usuario de PostgreSQL necesita permiso para crearla. La suite nueva prueba el envío por API, aceptación, agenda, llegada, permisos, ejecución, cierre con pago pendiente, precio, checkout interceptado, recuperación, compatibilidad y migración. También se actualizaron las pruebas previas que exigían pago antes del cierre.

Alternativa si ya tienes Python con las dependencias de `backend/requirements.txt` instaladas, desde la carpeta `backend`:

```powershell
$env:DJANGO_DEBUG="true"
$env:DJANGO_SECURE_SSL_REDIRECT="false"
$env:SERVIPROX_DATABASE="sqlite"
$env:SERVIPROX_MEDIA_STORAGE="filesystem"
python manage.py test apps.orders apps.service_requests config.test_flows --noinput
```

Navegador: iniciar Vite en una terminal desde la raíz:

```powershell
npm.cmd run dev
```

En otra terminal, también desde la raíz:

```powershell
npx.cmd cypress install
npx.cmd cypress verify
npm.cmd run test.e2e -- --config baseUrl=http://localhost:8100 --spec cypress/e2e/service-workflow.cy.ts
```

`cypress install` descarga el ejecutable de la versión local de Cypress. El paquete npm por sí solo no garantiza que ese ejecutable exista en la caché de Windows. Una vez instalado y verificado, basta con ejecutar el último comando en las siguientes ocasiones.

El escenario Cypress intercepta la API y servicios de mapas, usa datos de prueba y no necesita conectarse a la base real. Revisa navegación, desaparición del mapa, cierre con pago pendiente y anchos móviles/tableta. La comprobación real de persistencia y permisos corresponde a Django. El comando selecciona el escenario nuevo; no ejecuta el antiguo ejemplo de Inbox que ya existía en el repositorio.

## Resultados compartidos por el usuario y correcciones posteriores

En la ejecución compartida el 4 de noviembre de 2026:

- Django informó que no había migraciones pendientes.
- El frontend aprobó 51 pruebas en 9 archivos. La salida “Sin conexión” corresponde a un fallo simulado intencionalmente por una prueba aprobada.
- El backend ejecutó 40 pruebas y terminó con 2 errores.
- Cypress no empezó a probar la aplicación porque faltaba `Cypress.exe` en su caché local.

Se corrigieron los dos errores del backend:

1. La prueba de checkout reemplazaba `PlatformSettings.load()` por un diccionario parcial que no incluía `features`. Ese reemplazo también afectaba la creación de la solicitud previa al pago. La prueba ahora guarda una configuración de pagos en su base temporal y utiliza la carga real de configuración, que incorpora todos los valores predeterminados.
2. La API de evidencias precargaba la lista de fotos y devolvía esa lista desactualizada después de crear una nueva evidencia. Ahora invalida únicamente la lista precargada de evidencias antes de serializar la respuesta. Se reforzó la prueba existente y se agregó una regresión que comprueba dos subidas consecutivas, su respuesta inmediata, su persistencia y la consulta por el cliente.

Archivos de esta corrección: `backend/apps/orders/views.py`, `backend/apps/orders/tests.py`, `backend/config/test_flows.py` y este documento. El frontend no requirió cambios.

Para repetir primero los casos afectados:

```powershell
docker compose exec -e DJANGO_DEBUG=true -e DJANGO_SECURE_SSL_REDIRECT=false backend python manage.py test apps.orders.tests.ServiceWorkflowTests.test_checkout_uses_final_price_instead_of_silently_charging_estimate config.test_flows.DeploymentFlowTests.test_evidence_is_private_and_completed_order_can_be_reviewed config.test_flows.DeploymentFlowTests.test_each_evidence_upload_returns_all_saved_photos_immediately --noinput
```

Después, repetir la suite completa de backend con el comando indicado arriba. Los mensajes HTTP 400/403/404/405 forman parte de varias comprobaciones de validación y permisos; el resumen final de Django indica si hubo errores o fallos. La advertencia sobre longitud de la clave JWT es independiente de los dos errores corregidos.

Estas correcciones se revisaron mediante análisis estático. El agente mantuvo la indicación de no ejecutar pruebas; su resultado posterior sigue pendiente de la ejecución del usuario.

## Comprobaciones realizadas sin ejecutar pruebas

### Corrección de aceptación y formulario con fotos

Ante el reporte posterior sobre la vista profesional y el modal de Tomar servicio:

- Se separaron las confirmaciones de aceptar y rechazar. Cada confirmación tiene un texto y un callback propios, con la acción explícita que debe ejecutar. Se dejó de decidir entre ambos endpoints mediante el estado cambiante de una única alerta. Volver o cerrar la confirmación no envía una respuesta y los clics repetidos no duplican la operación.
- El modal permite adjuntar fotos o usar la cámara, previsualizarlas y quitar cualquiera antes del envío. Se conservan si el envío falla y se limpian al cerrar o cambiar de categoría/cuenta. Las fotos se envían con los datos de la solicitud en una única petición multipart al endpoint que ya existía.
- Se admiten hasta 6 fotos, de máximo 10 MB cada una, y se informa si un archivo no es una imagen o supera los límites.
- El modal ocupa toda la pantalla en móvil. En tabletas y escritorio usa casi todo el alto disponible y hasta 1440 px de ancho; desde 1100 px distribuye el formulario en dos columnas. El encabezado y el botón de cerrar quedan fuera del contenido desplazable.
- No se requieren cambios de esquema ni una nueva migración para estos ajustes.

Validación manual: crear una solicitud desde `/cliente/servicios` → Tomar el servicio; adjuntar y quitar fotos antes de confirmar. Con el profesional, abrir `/profesional/solicitudes/ID_SOLICITUD`: Aceptar solicitud → Aceptar solicitud debe abrir el seguimiento; Volver no debe cambiar su estado; Rechazar solicitud requiere confirmar expresamente el rechazo.

Pruebas nuevas y ampliadas, entregadas sin ejecutar:

```powershell
npm.cmd run test.unit -- --run src/pages/ProfessionalRequestDetailPage.test.tsx src/components/servicios/TomarServicioModal.test.tsx src/services/workflow.test.ts
```

Se añadió una regresión que conserva los callbacks iniciales de la alerta para comprobar que aceptar nunca llama a rechazar, además de cancelación, error de aceptación, fotos, cámara, eliminación, reintento y limpieza al cerrar. El escenario Cypress también comprueba los diálogos reales de Ionic y el modal con fotos a 360 y 1440 px; se ejecuta con el comando E2E ya indicado.

Archivos de esta corrección: `src/pages/ProfessionalRequestDetailPage.tsx`, `src/pages/ProfessionalRequestDetailPage.test.tsx`, `src/components/servicios/TomarServicioModal.tsx`, `src/components/servicios/TomarServicioModal.css`, `src/components/servicios/TomarServicioModal.test.tsx`, `src/components/serviprox/RequestPhotoPicker.tsx`, `src/components/serviprox/RequestPhotoPicker.css`, `src/test/ionicMock.tsx`, `src/services/workflow.test.ts`, `cypress/e2e/service-workflow.cy.ts` y este documento.

### Apariencia unificada del proceso de servicio

Se completó el ajuste visual del catálogo, selección en mapa, solicitud directa, modales de servicio/orientación, listas de ambos perfiles, respuesta del profesional, seguimiento, resumen y pago.

- Fondo neutro `#f4f6fa` y superficies blancas. La acción principal, selección e iconos conservan la identidad de cada perfil: rojo `#dc2626` para cliente y azul `#193f70` para profesional. Bordes, radios, sombras, títulos, campos y botones comparten el mismo sistema.
- El estilo está limitado al proceso mediante `sp-service-flow`. Las reglas globales de cada perfil permiten este ámbito sin imponerle nuevamente los fondos rosa/azul. Se contemplaron también los selectores antiguos de modo oscuro para mantener legibilidad en estas superficies claras.
- El indicador Solicitud → Confirmación → Visita → Cierre distingue el formulario sin enviar, la solicitud pendiente y la visita iniciada. Aceptar o agendar no presenta la visita como iniciada. Cancelar o rechazar muestra una nota de cierre sin marcar etapas exitosas.
- Las acciones que avanzan el servicio tienen mayor peso visual; pausas y acciones secundarias usan borde. El rechazo y la cancelación conservan su tratamiento de advertencia. Las confirmaciones de Ionic usan la misma apariencia.
- Se unificaron filtros del mapa, selección de profesional, fotos, urgencia, información de llegada, historial y panel de pago. Los estados terminados, cancelados y en pausa tienen acentos distintos.
- En móvil los formularios y acciones se apilan, el indicador pasa a dos columnas y los textos largos pueden ajustarse. Se conserva el modal ampliado y su encabezado separado del contenido desplazable.

Validar con una sesión de cada perfil:

| Recorrido | Revisión visual |
| --- | --- |
| `/cliente/servicios` → Tomar el servicio / orientación | Fondo neutro, modal amplio, campos y fotos legibles, selección de servicio/profesional y botón de cierre. |
| `/cliente/mapa` → perfil → solicitar | Filtros y tarjetas coherentes con el formulario directo; dirección en una columna en móvil. |
| `/cliente/solicitudes` | Búsqueda, filtros, estados y botones para retomar el servicio. |
| `/profesional/solicitudes` → detalle | Tarjetas separadas, fotos, aceptación/rechazo y sus confirmaciones. |
| `/profesional/trabajos` → seguimiento | Filtros, indicador de etapas, acciones principales/secundarias, llegada y evidencias. |
| Seguimiento terminado/cancelado → `/cliente/historialpago?order=ID_ORDEN` | Diferenciar el cierre, consultar historial, valor final y pago. |
| 320, 360, 390, 768, 1024 y 1440 px | Sin desbordamiento de página; botones legibles y formularios utilizables. Los carruseles mantienen su desplazamiento propio. |

Se agregaron pruebas del indicador para solicitudes pendientes, aceptación, agenda, visita, cierre y rechazo/cancelación. Cypress comprueba que los fondos globales por perfil no vuelvan a imponerse al seguimiento ni al modal, y que las acciones del cliente sean rojas y las del profesional azules. Se entregan sin ejecutar:

```powershell
npm.cmd run test.unit -- --run src/components/serviprox/ServiceProgress.test.tsx src/components/servicios/TomarServicioModal.test.tsx src/pages/ProfessionalRequestDetailPage.test.tsx src/pages/WorkTrackingPage.test.tsx src/pages/ServiceLists.test.tsx
npm.cmd run test.e2e -- --config baseUrl=http://localhost:8100 --spec cypress/e2e/service-workflow.cy.ts
```

Archivos de esta etapa visual: `src/theme/service-flow.css`, `src/theme/variables.css`, `src/App.tsx`, `src/pages/RolePages.css`, `src/components/serviprox/ServiceProgress.tsx`, `src/components/serviprox/ServiceProgress.test.tsx`, `src/components/servicios/TomarServicioModal.tsx`, `src/components/servicios/OrientacionGuiadaModal.tsx`, `src/components/misreservas/misreserva.tsx`, `src/components/historiadepago/historiapago.tsx`, `src/pages/Page.tsx`, `src/pages/ContractorMapPage.tsx`, `src/pages/ClientProfessionalDetail.tsx`, `src/pages/ProfessionalRequestsPage.tsx`, `src/pages/ProfessionalRequestDetailPage.tsx`, `src/pages/ProfessionalJobsPage.tsx`, `src/pages/WorkTrackingPage.tsx`, `cypress/e2e/service-workflow.cy.ts` y este documento.

### Corrección de identidad por perfil y búsqueda orientada

Se restauró el rojo del cliente en acciones, campos enfocados, selección, iconos, avatares de respaldo y acentos del proceso. Los modales y confirmaciones también toman el color del perfil activo, aunque Ionic los monte fuera de la página. El azul queda para el profesional. Se conservaron el fondo neutro, las tarjetas blancas y la distribución aprobada; los estados semánticos de éxito y advertencia mantienen sus colores.

En la búsqueda orientada se protegió el render frente a respuestas incompletas: el componente daba por presentes `service_ranking`, la categoría de cada sugerencia y `matched_terms`. Esta protección se conserva. La traza de consola compartida después identificó un fallo diferente al montar el indicador de carga, descrito en la siguiente sección.

Ahora se normaliza la respuesta antes de guardarla en el estado de React. Las listas opcionales ausentes se convierten en listas vacías; las sugerencias sin identificación/categoría válida se descartan; si existe una categoría sugerida sin ranking, se consultan sus servicios. Una respuesta sin sesión válida o con un ranking de formato incorrecto muestra un error y permite reintentar conservando la descripción. Las respuestas tardías de una búsqueda cerrada se ignoran.

Validar en `/cliente/servicios` → **Orientación guiada**: describir una fuga de agua, buscar, seleccionar un servicio y continuar al modal de solicitud. Verificar acciones rojas y fondo neutro. Repetir sin coincidencias, con un error de conexión y cerrando/reabriendo el modal durante la consulta. En `/seguimiento/ID_ORDEN`, comprobar rojo en cliente y azul en profesional, incluido el trayecto del mapa.

Se ampliaron las regresiones unitarias y Cypress para respuestas sin ranking, sin términos, con entradas incompletas y con formatos inválidos. Se entregan sin ejecutar:

```powershell
npm.cmd run test.unit -- --run src/components/servicios/OrientacionGuiadaModal.test.tsx src/components/servicios/TomarServicioModal.test.tsx src/pages/WorkTrackingPage.test.tsx
npm.cmd run test.e2e -- --config baseUrl=http://localhost:8100 --spec cypress/e2e/service-workflow.cy.ts
```

Archivos de esta corrección: `src/theme/service-flow.css`, `src/components/servicios/TomarServicioModal.tsx`, `src/components/servicios/OrientacionGuiadaModal.tsx`, `src/components/servicios/OrientacionGuiadaModal.test.tsx`, `src/components/serviprox/TravelMap.tsx`, `src/utils/diagnosis.ts`, `cypress/e2e/service-workflow.cy.ts` y este documento. No requiere migraciones.

### Pantalla vacía al montar el indicador de carga

La consola compartida por el usuario muestra `NotFoundError: Failed to execute 'insertBefore' on 'Node'` en `ForwardRef(IonSpinner)`. El fallo sucede durante la actualización del DOM del botón al pasar de icono/texto a spinner/texto; no es un error de validación del formulario ni una espera de resultados. Al no haber un límite de errores en ese árbol, React deja de mostrar la interfaz y queda visible el fondo global del perfil.

Se sustituyeron los fragmentos condicionales del contenido por `ServiceButtonContent`: un único contenedor HTML estable dentro del botón, con icono, indicador y etiqueta en sus propios contenedores. El icono y el spinner permanecen montados; solo cambian su visibilidad, la pausa de animación y el texto de la etiqueta. Así no se insertan ni retiran nodos al alternar la carga dentro del contenido proyectado por Ionic.

Se aplicó a Buscar sugerencias, confirmar servicio desde el modal, enviar solicitud directa y pagar, que utilizaban el mismo patrón. Se conservan sus callbacks, permisos y condiciones de deshabilitado.

Comprobación manual realizada: tres ciclos consecutivos de carga en una vista aislada local, con React StrictMode e IonButton/IonSpinner reales. La interfaz permaneció visible y el botón volvió al estado inicial en los tres ciclos. Esa vista temporal fue eliminada; no crea solicitudes ni llama al backend. Esta comprobación no sustituye el recorrido completo de la búsqueda con una sesión autenticada.

Se añadió una regresión unitaria de las transiciones consecutivas y una de Cypress con componentes reales ya inicializados y respuesta de API retrasada. Cypress conserva su comportamiento de fallar ante excepciones de la aplicación; no se silencia el error. Las suites siguen sin ejecutar por indicación del usuario:

```powershell
npm.cmd run test.unit -- --run src/components/servicios/OrientacionGuiadaModal.test.tsx src/components/servicios/TomarServicioModal.test.tsx src/pages/WorkTrackingPage.test.tsx
npm.cmd run test.e2e -- --config baseUrl=http://localhost:8100 --spec cypress/e2e/service-workflow.cy.ts
```

Validar en `/cliente/servicios` → Orientación guiada: buscar varias veces, observar el indicador y esperar los resultados, seleccionar un servicio y continuar. Probar también el reintento tras un error y el envío de la solicitud.

Archivos de esta corrección: `src/components/serviprox/ServiceButtonContent.tsx`, `src/components/serviprox/ServiceButtonContent.css`, `src/components/servicios/OrientacionGuiadaModal.tsx`, `src/components/servicios/OrientacionGuiadaModal.test.tsx`, `src/components/servicios/TomarServicioModal.tsx`, `src/components/historiadepago/historiapago.tsx`, `src/pages/ClientProfessionalDetail.tsx`, `cypress/e2e/service-workflow.cy.ts` y este documento.

### Autocontratación, límites de tarifa y seguimiento por perfil

Se aplicaron los tres ajustes solicitados. El usuario confirmó que la tarifa final debe estar **entre el mínimo y el máximo publicados**, incluyendo ambos extremos.

- **Autocontratación:** la identidad es la misma cuenta de usuario aunque cambie de rol. El backend rechaza dirigir una solicitud o crear una orden hacia su propio perfil profesional. Tampoco permite aceptar solicitudes propias antiguas. El perfil propio se excluye de búsquedas y candidatos, y la ficha abierta por URL informa que no se puede contratar. Las órdenes propias irregulares anteriores no se pueden operar ni calificar desde el modo cliente.
- **Autoridad:** ser dueño de un perfil profesional no basta para gestionar una orden. También es necesario estar en el rol profesional, ser el asignado y no ser el cliente de esa orden. Se exige en tarifa, transiciones, ubicación y evidencias. El código de llegada, pago y calificación corresponden al cliente de la orden en su rol cliente. Los permisos se recuperan de nuevo si cambia el rol activo.
- **Tarifa:** el cliente consulta el valor final y no tiene un formulario para editarlo. La API deniega sus intentos de modificarlo, aunque envíe campos que simulen el rol profesional. Los límites enviados por el cliente al crear una orden se ignoran: se toman de la oferta del profesional. La aceptación conserva el rango publicado como referencia de esa orden; editar la oferta después no altera ese rango.
- **Validación:** el backend comprueba el mínimo y el máximo con decimales, y el formulario usa esos mismos límites. Si falta un límite en una orden anterior, se obtiene de la oferta publicada y se fija al confirmar la tarifa. Sin un rango completo válido no se permite confirmar el precio. Se mantienen los bloqueos con pago confirmado o en proceso. Wompi cobra el valor guardado en el servidor, rechaza valores antiguos fuera del rango e ignora importes enviados por el cliente.
- **Vistas separadas:** el cliente tiene seguimiento de su servicio, tarifa de consulta, código de llegada, pago, cancelación antes del desplazamiento y calificación al terminar. El profesional tiene gestión del trabajo, agenda, llegada, ejecución/pausas/cierre, confirmación de tarifa y subida de evidencias. Comparten los datos del servicio, etapas, mapa durante desplazamiento, galería e historial. Los componentes de acciones de cada perfil están separados; el cliente no recibe el panel de gestión profesional.

Las rutas de seguimiento se conservan para poder retomar el mismo servicio desde cada perfil. La identidad visual sigue siendo roja para cliente y azul para profesional, con el fondo neutro aprobado. No se requiere una migración nueva; frontend y backend deben actualizarse juntos.

Validación manual:

| Recorrido | Resultado esperado |
| --- | --- |
| Con una cuenta que tenga perfil profesional, cambiar a cliente y buscar su perfil | No aparece como candidato. Por URL directa, la ficha bloquea el envío. |
| Solicitud a otro profesional → aceptación → `/seguimiento/ID_ORDEN` como cliente | Tarifa y rango de consulta, código de llegada y pago. No hay campos de tarifa, agenda, llegada, ejecución ni subida de evidencia. |
| Mis trabajos → mismo seguimiento como profesional asignado | Herramientas de trabajo y tarifa; sin código de llegada revelado ni botón de pago del cliente. |
| Rango 50.000–90.000 COP | 50.000 y 90.000 se aceptan. 49.999,99 y 90.000,01 se rechazan sin cambiar el valor confirmado. |
| Cambiar después la oferta del profesional | La orden conserva el rango aceptado. |
| Cambiar de rol con el seguimiento abierto | Desaparecen los controles anteriores y se vuelve a comprobar el acceso. |
| Pago iniciado/confirmado | La edición del valor queda bloqueada. |

Pruebas nuevas/ampliadas de autocontratación, permisos, ambos límites, órdenes antiguas, protección del checkout, separación de controles y cambio de rol. Se entregan **sin ejecutar**:

```powershell
npm.cmd run test.unit -- --run src/pages/WorkTrackingPage.test.tsx src/components/servicios/TomarServicioModal.test.tsx src/pages/ServiceLists.test.tsx
docker compose exec -e DJANGO_DEBUG=true -e DJANGO_SECURE_SSL_REDIRECT=false backend python manage.py test apps.orders apps.service_requests apps.professionals config.test_flows --noinput
```

Con Vite iniciado, el escenario de navegador también comprueba el perfil propio por URL, la tarifa de consulta del cliente y los límites del formulario profesional:

```powershell
npm.cmd run test.e2e -- --config baseUrl=http://localhost:8100 --spec cypress/e2e/service-workflow.cy.ts
```

Archivos de esta etapa:

- `backend/apps/service_requests/serializers.py`
- `backend/apps/service_requests/services.py`
- `backend/apps/professionals/serializers.py`
- `backend/apps/professionals/views.py`
- `backend/apps/orders/serializers.py`
- `backend/apps/orders/services.py`
- `backend/apps/orders/views.py`
- `backend/apps/orders/tests.py`
- `src/types/serviprox.ts`
- `src/components/servicios/TomarServicioModal.tsx`
- `src/components/servicios/TomarServicioModal.test.tsx`
- `src/pages/ClientProfessionalDetail.tsx`
- `src/pages/WorkTrackingPage.tsx`
- `src/pages/WorkTrackingPage.test.tsx`
- `src/components/serviprox/tracking/ClientTrackingControls.tsx`
- `src/components/serviprox/tracking/ProfessionalTrackingControls.tsx`
- `src/components/serviprox/tracking/priceBounds.ts`
- `cypress/e2e/service-workflow.cy.ts`
- `docs/AJUSTES_ESTADOS.md`

### Comprobaciones estáticas

- Revisión del código y sus contratos entre frontend y backend.
- Comprobación de tipos TypeScript del frontend y del archivo Cypress.
- Compilación de producción del frontend con `npm.cmd run build` completada correctamente durante el ajuste visual.
- Análisis de sintaxis Python mediante `ast.parse`, sin importar Django ni ejecutar sus pruebas.
- Revisión de espacios y conflictos con `git diff --check`.

El navegador confirmó que la aplicación local responde, pero redirige a inicio de sesión: no había una sesión autenticada disponible para inspeccionar las pantallas del servicio. La revisión visual completa con ambos perfiles queda pendiente del recorrido anterior. No se ejecutaron pruebas, migraciones, seeds ni despliegues durante esta implementación.

## Archivos intervenidos

El inventario siguiente incluye implementación, migración, pruebas y documentación de esta entrega. `docs/DIAGNOSTICO_FLUJO_SERVICIOS.md` corresponde al informe previo y se conservó sin editar en esta etapa.

<!-- INVENTARIO -->
- `backend/apps/orders/migrations/0006_reconcile_premature_orders.py`
- `backend/apps/orders/serializers.py`
- `backend/apps/orders/services.py`
- `backend/apps/orders/tests.py`
- `backend/apps/orders/views.py`
- `backend/apps/professionals/serializers.py`
- `backend/apps/professionals/views.py`
- `backend/apps/service_requests/serializers.py`
- `backend/apps/service_requests/services.py`
- `backend/apps/service_requests/tests.py`
- `backend/apps/service_requests/views.py`
- `backend/config/test_flows.py`
- `cypress/e2e/service-workflow.cy.ts`
- `docs/AJUSTES_ESTADOS.md`
- `src/App.tsx`
- `src/components/historiadepago/historiapago.tsx`
- `src/components/misreservas/misreserva.css`
- `src/components/misreservas/misreserva.tsx`
- `src/components/servicios/TomarServicioModal.css`
- `src/components/servicios/TomarServicioModal.tsx`
- `src/components/servicios/TomarServicioModal.test.tsx`
- `src/components/servicios/OrientacionGuiadaModal.tsx`
- `src/components/servicios/OrientacionGuiadaModal.test.tsx`
- `src/components/serviprox/RequestPhotoPicker.css`
- `src/components/serviprox/RequestPhotoPicker.tsx`
- `src/components/serviprox/ServiceButtonContent.tsx`
- `src/components/serviprox/ServiceButtonContent.css`
- `src/components/serviprox/ServiceProgress.tsx`
- `src/components/serviprox/ServiceProgress.test.tsx`
- `src/components/serviprox/TravelMap.tsx`
- `src/components/serviprox/tracking/ClientTrackingControls.tsx`
- `src/components/serviprox/tracking/ProfessionalTrackingControls.tsx`
- `src/components/serviprox/tracking/priceBounds.ts`
- `src/hooks/useLivePage.test.tsx`
- `src/hooks/useLivePage.ts`
- `src/pages/ClientProfessionalDetail.css`
- `src/pages/ClientProfessionalDetail.tsx`
- `src/pages/ContractorMapPage.tsx`
- `src/pages/Page.tsx`
- `src/pages/ProfessionalDashboard.tsx`
- `src/pages/ProfessionalJobsPage.tsx`
- `src/pages/ProfessionalRequestDetailPage.tsx`
- `src/pages/ProfessionalRequestDetailPage.test.tsx`
- `src/pages/ProfessionalRequestsPage.tsx`
- `src/pages/RolePages.css`
- `src/pages/ServiceLists.test.tsx`
- `src/pages/WorkTrackingPage.css`
- `src/pages/WorkTrackingPage.test.tsx`
- `src/pages/WorkTrackingPage.tsx`
- `src/services/serviprox.ts`
- `src/services/workflow.test.ts`
- `src/test/ionicMock.tsx`
- `src/test/workflowFixtures.ts`
- `src/theme/service-flow.css`
- `src/theme/variables.css`
- `src/types/serviprox.ts`
- `src/utils/geocoding.ts`
- `src/utils/diagnosis.ts`
- `src/utils/workflow.ts`
