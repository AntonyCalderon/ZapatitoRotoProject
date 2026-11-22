# APIs de existencias y Kardex físico

PROYEC-6. El módulo está en `backend/src/modules/almacen/` y sigue repositorio → servicio → controlador → rutas. Las tres rutas son GET y no modifican stock, mínimos ni movimientos. El saldo siempre representa pares físicos; no hay precios ni costos.

## Sesión y permisos

Base local habitual: `http://localhost:3000`. Antes de consultar, enviar `POST /api/auth/login` con JSON `{ "correo": "tu correo", "password": "tu contraseña" }`. Usar una cuenta habilitada con rol `Almacen` y contraseña inicial ya cambiada. Postman conserva automáticamente la cookie `aym.sid`. Mantener el mismo host: no mezclar localhost y 127.0.0.1.

Sin sesión: 401. Rol distinto o cambio de contraseña obligatorio: 403. Los errores de autenticación conservan el formato existente `{ mensaje }`. Los errores propios de estas consultas devuelven `{ codigo, mensaje }`. No copiar credenciales a archivos versionados.

## Existencias

`GET /api/almacen/existencias`

| Parámetro | Regla |
| --- | --- |
| `q` | Búsqueda literal sin distinguir mayúsculas en SKU, modelo, color o talla; máximo 100 caracteres. |
| `id_modelo`, `id_color`, `id_talla` | Identificadores enteros positivos opcionales, entre 1 y 2147483647. |
| `catalogo` | `activos` por defecto; también `inactivos` o `todos`. |
| `situacion` | `todos` por defecto; `agotado`, `stock_bajo`, `disponible` o `sin_minimo`. |
| `pagina` | Entero positivo; predeterminado 1. |
| `tamano` | Entero de 1 a 100; predeterminado 20. |

Respuesta 200: `{ items, pagina, tamano, total }`. Cada producto incluye `id_sku`, `codigo_sku`, `modelo`, `color`, `talla`, `cantidad_actual`, `stock_minimo`, `catalogo_activo` y `situacion`. `total` cuenta las coincidencias de todas las páginas, no pares. Orden estable por código SKU e identificador.

Un SKU solo se considera activo para la consulta si también están activos su modelo, color y talla. Los inactivos conservan existencias e historial y pueden consultarse con sus filtros. Una búsqueda sin resultados devuelve 200 e items vacío.

Situación vigente tras 014: cero → agotado; de 1 a 5 → stock_bajo; de 6 en adelante → disponible. Todos los SKU actuales tienen mínimo 5 y los nuevos lo reciben automáticamente. El filtro sin_minimo se conserva por compatibilidad, pero no devuelve coincidencias con el esquema actualizado.

## Catálogo de filtros

`GET /api/almacen/catalogo?catalogo=activos`

Respuesta 200: `{ modelos, colores, tallas }`. Cada opción tiene su identificador y nombre, o `numero_talla` en tallas. Las opciones pertenecen a SKU del estado de catálogo consultado. No es necesario seleccionar un modelo para pedir colores o tallas. Los filtros se combinan al consultar existencias; una combinación inexistente devuelve una lista vacía.

## Kardex físico

`GET /api/almacen/kardex/:skuId`

Admite `pagina`, `tamano`, `desde`, `hasta` y `tipo_movimiento`. Fechas válidas en formato YYYY-MM-DD; desde no puede superar hasta. Las fechas representan días completos en `America/Lima`: inicio inclusivo y día posterior a hasta exclusivo. Los tipos actuales son `todos`, `APERTURA`, `ENTRADA_COMPRA` y `SALIDA_VENTA`. Cambios no se habilitan hasta que exista su flujo y migración acordada.

Respuesta 200: `{ producto, cantidad_actual, items, pagina, tamano, total }`. Cada movimiento incluye:

- `id_movimiento`: cadena decimal, para conservar la precisión de BIGINT.
- `fecha`: fecha y hora ISO 8601 con zona.
- `tipo_movimiento`, `entrada`, `salida`, `saldo_posterior` y `responsable`.
- `documento_origen`: `{ tipo, id, codigo }`. Recepción muestra el código de compra; despacho muestra su código; apertura tiene id y código NULL.

`cantidad_actual` es el stock físico presente. `saldo_posterior` es el stock histórico después de ese movimiento. Filtrar o paginar no cambia ninguno de esos valores. El orden es del más reciente al más antiguo, usando fecha e identificador. El producto, saldo, total y movimientos se leen en una misma transacción de solo lectura con snapshot consistente.

SKU existente sin movimientos: 200 con items vacío. SKU inexistente: 404 y `SKU_NO_ENCONTRADO`. Los históricos pueden consultarse aunque el producto esté inactivo.

## Errores y privacidad

Filtros inválidos, repetidos o fuera de rango: 400 y `FILTRO_INVALIDO`. Fallo inesperado: 500 y `INVENTARIO_ERROR`, sin SQL ni detalles internos en la respuesta. Los filtros reconocidos se validan y los valores se parametrizan. Las respuestas autorizadas incluyen `Cache-Control: private, no-store`.

## Probar en Postman

1. Si el backend ya estaba ejecutándose sin reinicio automático, detenerlo en su terminal con Ctrl+C. Desde `backend`, ejecutar `npm start`.
2. En Postman pulsar Import y elegir `docs/postman/PROYEC-6-inventario.postman_collection.json`.
3. Abrir la colección y sus Variables. Definir valores locales de `correo` y `password` con la cuenta de Almacén; `base_url` debe ser `http://localhost:3000`. No compartir esos valores ni exportarlos con contraseñas.
4. Enviar la petición 01 de login. Después probar 02 Catálogo y 03 Existencias. La petición 03 selecciona automáticamente el primer `sku_id` para los ejemplos siguientes; también se puede cambiar manualmente por un ID devuelto por la API.
5. Abrir 04 Stock bajo, 05 Agotados y 06 Kardex. Fechas y tipos son editables en Params. La petición 07 usa 2026 como intervalo de ejemplo, no como límite del sistema.
6. Las peticiones 08 y 09 esperan 400, la 10 espera 404, la 11 cierra sesión y la 12 espera 401. Ejecutar de nuevo login para seguir consultando después del logout.

El mínimo acordado es 5. Stock bajo incluye cantidades físicas entre 1 y 5; Agotados incluye cero. Las cantidades e históricos dependen de las operaciones registradas; las consultas no crean pares ficticios.

## Validación automatizada

Desde `backend`: `node scripts/probarApiInventario.mjs` prueba SQL y peticiones HTTP con login real y fixtures en un esquema aislado. `node scripts/probarApiInventario.mjs --postman` ejecuta además la colección con Postman CLI instalado. Las cuentas de prueba solo existen en ese esquema y se eliminan al terminar; no se modifican usuarios, órdenes ni sesiones públicas.

Pruebas de permisos y validación sin BD: `node --test src/modules/almacen/inventario.routes.test.js`. La prueba de migración permanece en `scripts/probarMigracionInventario.mjs`.


## Interfaz de consulta

En el frontend, entrar con Almacén y abrir Kardex en el sidebar. Rutas: /almacen/kardex para existencias y /almacen/kardex/:skuId para el historial. Recepción y despacho conservan sus rutas. Todas las rutas de Almacén requieren el rol Almacen; Administrador por sí solo no concede acceso.

Los filtros y la paginación de existencias se conservan en la URL. La búsqueda se envía con Buscar o Enter. Los selectores de modelo, color y talla son independientes; no es obligatorio seleccionar un modelo primero. El catálogo de opciones se consulta con catalogo=todos para que una selección no desaparezca al cambiar Activos o Inactivos. Volver del detalle conserva la búsqueda anterior.

El detalle permite consultar fechas y tipo de movimiento, mantiene el stock actual separado del histórico y muestra fechas en hora de Perú. Los rangos invertidos se rechazan antes de enviar la consulta. Hay estados de carga, vacío, error y reintento, así como botones para actualizar la lectura. Se refrescan consultas al volver a enfocar la aplicación; no se implementa WebSocket ni se simulan movimientos.

Archivos nuevos: frontend/src/services/inventarioService.ts, frontend/src/components/InventarioUI.tsx, frontend/src/pages/ExistenciasPage.tsx, frontend/src/pages/KardexDetallePage.tsx y frontend/src/inventario.css. La integración de navegación utiliza App.tsx, OperacionLayout.tsx y AdminLayout.tsx. Las pruebas están en frontend/src/pages/InventarioPages.test.tsx.

La pantalla muestra la situación según la BD. No incluye mantenimiento del mínimo ni modifica cantidades. La migración 014 establece automáticamente el mínimo de 5 pares. Las operaciones de recepción/salida pertenecen a sus propias HU. Los datos ficticios usados en las pruebas de interfaz no se cargan en PostgreSQL ni forman parte de la aplicación normal.
