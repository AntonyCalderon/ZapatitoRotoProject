# Recepción completa y seguimiento en Compras

## Flujo y responsabilidades

Almacén abre una compra pendiente, contrasta cada código SKU y la cantidad física completa y marca todas las líneas como verificadas. El botón Confirmar recepción completa pide confirmación con el código de orden y los pares. No se admiten recepciones parciales.

La recepción registra el usuario autenticado y la fecha del servidor. Compras muestra el indicador verde «Lote verificado y recibido por Almacén», responsable y fecha; entonces habilita Confirmar comercialmente. Esta segunda confirmación registra únicamente `orden_compra.id_usuario_confirma` y `fecha_confirmacion`: no suma stock.

PROYEC-18 conserva los estados comerciales BORRADOR, EMITIDA y CANCELADO. PROYEC-20 incorpora CERRADO para finalizar y archivar la compra; consultar cierre-compra.md. En tránsito y Recibida son situaciones logísticas calculadas, no nuevos estados de la compra. En tránsito significa emitida sin recepción verificada; no implica seguimiento del transportista.

## APIs

Todas requieren sesión. Las rutas de Almacén exigen rol `Almacen`; las de Compras, rol `Compras`.

| Método y ruta | Función |
| --- | --- |
| GET `/api/almacen/pendientes-recepcion` | Compras emitidas sin recepción |
| GET `/api/almacen/pendientes-recepcion/:id` | Código SKU, variante y cantidad por verificar |
| POST `/api/almacen/recepciones/:id/confirmacion` | Recepción física completa |
| GET `/api/ordenes-compra/emitidas` | Documento y seguimiento físico/comercial |
| POST `/api/ordenes-compra/:id/confirmacion` | Confirmación comercial posterior a Almacén |

La confirmación física requiere encabezado `Idempotency-Key` con un UUID nuevo por operación y cuerpo:

```json
{
  "lineas": [
    {"id_detalle_compra": 1, "cantidad_recibida": 6, "verificado": true},
    {"id_detalle_compra": 2, "cantidad_recibida": 7, "verificado": true}
  ]
}
```

Los identificadores y cantidades son ejemplos: utilizar todas las líneas devueltas por el detalle real. El backend comprueba la coincidencia exacta contra la compra; no confía en totales, usuario ni saldos del navegador. Devuelve 201 la primera vez, 200 en un reintento idéntico y 409 si la orden ya fue recibida con otra operación o cambió la verificación. Conservar la misma clave y cuerpo al reintentar tras una pérdida de conexión.

La confirmación comercial no requiere cuerpo. Repetirla conserva el primer responsable y fecha. Sin lote verificado devuelve 409, aunque se intente llamar directamente a la API.

## Persistencia y concurrencia

Aplicar `015_verificacion_recepcion.sql` una sola vez después de 013 y 014. Añade clave UUID única y huella de verificación a `recepcion_compra`; conserva recepciones anteriores. Ya fue aplicada en la BD local durante este trabajo; otros entornos deben aplicarla por separado.

El repositorio bloquea la orden y los saldos por SKU en orden ascendente. En una sola transacción crea la recepción y todos sus movimientos ENTRADA_COMPRA. El trigger existente actualiza stock y saldo posterior. No actualizar stock manualmente desde otro servicio. Cualquier fallo revierte recepción, movimientos y saldos.

Una cabecera de recepción antigua sin movimientos completos no habilita la confirmación comercial. El indicador exige una entrada exacta por cada línea comprada. No se reconstruyen movimientos históricos automáticamente ni se completa una recepción antigua incompleta mediante este endpoint: requiere reconciliación del equipo.

## Ubicación del código y pruebas

Almacén utiliza `recepcion.routes.js`, controller, service, domain y repository en `backend/src/modules/almacen`. Compras consulta el resumen compartido desde `confirmacionCompra.repository.js` y sus rutas existentes. La interfaz utiliza `recepcionService.ts`, `PendientesRecepcionPage.tsx` y `OrdenesEmitidas.tsx`.

Desde backend: `node scripts/probarRecepcionCompra.mjs`. La prueba crea y elimina un esquema aislado; cubre permisos, verificación completa, duplicados, reintentos, rollback, concurrencia y confirmación comercial sin doble stock. No recibe órdenes del esquema público.

Desde frontend: `npm test -- --run --maxWorkers=1` y `npm run build`. Las pruebas de recepción verifican bloqueo del botón, confirmación, errores y conservación de la clave de reintento.
