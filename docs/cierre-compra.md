# PROYEC-20: cierre e histórico de compras

## Navegación y flujo

El sidebar de Compras ofrece tres páginas protegidas por el mismo rol Compras:

- `/compras`: creación, consulta y cancelación de borradores.
- `/compras/emitidas`: seguimiento de recepción, confirmación comercial y cierre.
- `/compras/historico`: compras cerradas, responsable y fecha, detalle y PDF.
- `/compras/historico/:idOrden`: consulta de la compra cerrada con productos tomados del documento emitido y su auditoría.

Guardar un borrador conserva BORRADOR. Emitirlo cambia a EMITIDA y lleva a Órdenes emitidas. Confirmar comercialmente no lo cierra: habilita Cerrar orden si existe recepción física completa verificada. El cierre pide confirmación con el código de orden, cambia a CERRADO y lleva al Histórico. La orden desaparece de la consulta de emitidas.

La separación de páginas evita cargar emitidas al consultar borradores. Los servicios HTTP y el componente de seguimiento se reutilizan; cada página carga su propia consulta. El sidebar marca únicamente la sección actual.

## Contrato de API

Se mantienen las rutas de emisión, recepción y confirmación comercial existentes. Se agregan:

| Método y ruta | Respuesta |
| --- | --- |
| POST `/api/ordenes-compra/:id/cierre` | `{mensaje, orden, repetida}` |
| GET `/api/ordenes-compra/historico` | Lista de compras CERRADO, ordenadas por fecha de cierre descendente |
| GET `/api/ordenes-compra/historico/:id` | `{orden}` con documento emitido, total y auditoría |

El POST no requiere cuerpo. Usuario y fecha se obtienen de sesión y servidor. Requiere estado EMITIDA, recepción completa contrastada con sus entradas de Kardex y confirmación comercial registrada. No basta con una cabecera de recepción vacía ni con habilitar visualmente un botón.

Devuelve 400 para identificador inválido, 401 sin sesión, 403 sin rol Compras, 404 si la compra no existe y 409 si no está completada. Un cierre repetido devuelve 200 y conserva el primer responsable y fecha. El bloqueo de la orden serializa cierres concurrentes. Un fallo revierte la transacción.

El PDF se sigue descargando con `GET /api/ordenes-compra/:id/pdf`; no se regenera con precios actuales. El detalle histórico utiliza el documento persistido al emitir, en lugar de reconstruir los productos con nombres actuales del catálogo.

## Base de datos

Aplicar `016_cierre_orden_compra.sql` una sola vez después de 015, en la BD usada por backend. Ya fue aplicada en la instalación local durante el desarrollo; otros entornos requieren su propia aplicación.

No agrega tablas ni columnas. Reutiliza `orden_compra.id_usuario_cierre` (FK existente a usuario) y `fecha_cierre`. Amplía la restricción de estados a BORRADOR, EMITIDA, CANCELADO y CERRADO. Este acuerdo sustituye el límite anterior de tres estados.

La restricción de cierre exige auditoría, confirmación comercial, código y documento. El trigger valida la recepción física completa al cerrar y protege los datos de la cabecera cerrada contra posteriores modificaciones. Los endpoints existentes solo modifican líneas de BORRADOR. No se ofrece reapertura ni eliminación de órdenes cerradas.

El cierre no escribe stock, Kardex, costos, importes, código ni documento emitido. Los estados logísticos En tránsito y Recibida siguen calculándose por separado.

## Verificación

Desde backend, `node scripts/probarRecepcionCompra.mjs` ejecuta 54 peticiones contra un esquema aislado. Incluye recepción y sus reintentos, rechazo de cierre prematuro, permisos, cierre concurrente, conservación de auditoría, traslado de emitidas al histórico, consulta del documento y PDF. Comprueba que todos los saldos y movimientos permanecen idénticos antes y después del cierre, y rechaza modificaciones de cabeceras cerradas.

Desde frontend, `npm test -- --run --maxWorkers=1` cubre navegación separada, botón bloqueado, cancelación del diálogo, cierre, errores/reintentos, histórico y detalle. `npm run build` verifica TypeScript y compilación.

Las pruebas de integración y la revisión visual utilizan datos de QA; no cierran automáticamente las compras del esquema público.
