# Catálogo y sugerencias en el panel Serviprox

Ingresa con tu cuenta administrativa real en `http://localhost:8100/login/administrativo` y abre **Catálogo y publicaciones** en la barra lateral. No necesitas entrar a Django Admin.

- **Categorías:** crear, consultar, editar, ordenar, activar/desactivar y eliminar categorías sin registros relacionados. Incluye descripción, icono opcional y palabras clave.
- **Servicios:** crear, consultar, editar, asignar categoría, definir tarifas orientativas y horas estimadas, activar/desactivar y eliminar servicios sin registros relacionados. Puedes buscar por nombre, descripción y palabras clave y filtrar por categoría y estado.
- **Sugerencias y palabras clave:** escribir un problema y consultar los resultados del mismo motor de búsqueda orientada del cliente. Muestra categorías, servicios y términos coincidentes; permite abrir el formulario del servicio recomendado.

## Palabras clave y sugerencias

Escribe una palabra o frase por línea, o sepáralas por comas. Por ejemplo, para un servicio de reparación de grifería: `grifo goteando`, `llave dañada`, `fuga de agua`. Se admiten hasta 50 frases de 120 caracteres; se unifican duplicados sin distinguir mayúsculas ni tildes. Puedes dejar la lista vacía.

Las palabras de una categoría orientan al sistema hacia ese grupo; las del servicio ayudan a identificar el trabajo concreto. Guarda los cambios antes de usar el probador. Los cambios se consultan desde la base de datos en las siguientes peticiones del catálogo o de diagnóstico; las pantallas de clientes que ya estaban abiertas pueden necesitar recarga.

El probador no crea sesiones de diagnóstico ni solicitudes. Utiliza `suggest_services` sin modificar sus pesos ni introducir otro método de búsqueda. Una descripción sin coincidencias devuelve un resultado vacío que puedes mejorar añadiendo términos al catálogo.

Los nombres pueden editarse sin cambiar los identificadores existentes (`slug`), para conservar URLs y referencias del diagnóstico. Un servicio inactivo o con categoría inactiva se retira del catálogo público y de las sugerencias nuevas. Desactivar una categoría no cambia el estado individual de sus servicios: al reactivarla vuelven a mostrarse los que estén activos.

La carga del catálogo público recorre todas las páginas de categorías y servicios, incluyendo el selector del profesional. La cuadrícula de inicio conserva su diseño y muestra todas las categorías activas; se eliminó el límite fijo de seis que ocultaba las categorías adicionales.

No se permiten eliminaciones en cascada desde este panel. Una categoría con servicios, un servicio ofrecido por profesionales o cualquier elemento referenciado por diagnósticos, solicitudes u otros registros devuelve un conflicto y debe desactivarse. Las operaciones guardan auditoría con la identidad autenticada del administrador.

## Permisos y API

Requiere autenticación JWT y cuenta activa con `role=staff` o `is_superuser=True`. Las cuentas de cliente y profesional no tienen acceso. Las sesiones de demostración locales no proporcionan autorización para modificar el catálogo. También se restringieron con este permiso los endpoints administrativos existentes de resumen, usuarios y acciones.

Endpoints nuevos, relativos a `/api/v1/`:

| Ruta | Métodos |
| --- | --- |
| `admin/catalog/categories/` | GET, POST |
| `admin/catalog/categories/ID/` | GET, PATCH, PUT, DELETE |
| `admin/catalog/services/` | GET, POST |
| `admin/catalog/services/ID/` | GET, PATCH, PUT, DELETE |
| `admin/catalog/suggestions/preview/` | POST con `{"description":"Tengo una fuga de agua"}` |

Las listas administrativas incluyen inactivos, paginación y filtros de estado; servicios también admite `category`. El cliente HTTP existente envía el JWT y gestiona su renovación. Los errores se muestran en pantalla; este módulo no sustituye fallos por datos de demostración.

## Comprobaciones para ejecutar tú

No se ejecutaron pruebas, compilaciones, migraciones ni operaciones Docker durante esta implementación. No se agregaron dependencias ni cambios de modelos o migraciones.

Desde la raíz del repositorio, con tus contenedores existentes encendidos:

```powershell
docker compose exec -T backend python manage.py test apps.catalog apps.diagnosis apps.professionals apps.service_requests config --noinput
npm.cmd run typecheck
npm.cmd run test.unit -- --run
```

Para verificar la compilación con configuración local:

```powershell
npm.cmd run build -- --mode development
```

Para la compilación de producción usa `npm.cmd run build` con `VITE_API_URL` configurada a la API pública HTTPS. El comando local anterior no reemplaza esa validación.

En el Compose de desarrollo actual, `./backend` está montado en `/app` y Django usa recarga automática; estos cambios de código no requieren reconstruir la imagen. El frontend en Vite también recarga el código. Si una página ya estaba abierta, recárgala.

Recorrido manual recomendado:

1. Crear una categoría y un servicio con palabras clave. Confirmar que se ven en la app del cliente al recargar el catálogo.
2. Editar nombre, descripción y palabras clave. Probar una descripción con esas frases en Sugerencias y comparar con la búsqueda orientada del cliente.
3. Desactivar el servicio y la categoría y comprobar que desaparecen de nuevas búsquedas, manteniéndose visibles en administración.
4. Intentar eliminar un servicio ya ofrecido o usado: debe mostrar el bloqueo sin borrar sus relaciones. Un elemento nuevo sin referencias sí puede eliminarse, previa confirmación.
5. Verificar los registros en Historial de Auditoría del panel y comprobar que una cuenta cliente/profesional recibe 403 al intentar acceder a la API administrativa.
