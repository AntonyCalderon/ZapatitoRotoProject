# Inventario y Kardex físico compartidos

La migración `013_inventario_kardex.sql` amplía la misma base utilizada por Administración, Compras y Almacén. Requiere las migraciones anteriores, incluidas 011 y 012. No vuelve a crear SKU, usuarios, compras, ventas, recepciones ni despachos.

## Relaciones

| Tabla nueva y columna | Referencia existente |
| --- | --- |
| `stock_sku.id_sku` | `producto_sku.id_sku` |
| `kardex_movimiento.id_sku` | `stock_sku.id_sku`, que es el mismo SKU del catálogo |
| `kardex_movimiento.id_usuario` | `usuario.id_usuario` |
| `kardex_movimiento.id_recepcion` | `recepcion_compra.id_recepcion` |
| `kardex_movimiento.id_orden_despacho` | `orden_despacho.id_orden_despacho` |

Los nombres de modelo, color y talla se obtienen desde `producto_sku`; no se duplican. El proveedor y el código de compra se consultan por recepción → compra. El código de despacho se obtiene por la orden de despacho.

Cada entrada por compra exige recepción y prohíbe despacho. Cada salida por venta exige despacho y prohíbe recepción. Una apertura inicial no utiliza esos documentos y conserva su usuario responsable.

El esquema actual no tiene `detalle_recepcion`. Para no crear otra tabla perteneciente a la HU de recepción, cada movimiento referencia su cabecera existente y su SKU. El trigger comprueba que ese SKU pertenece a las líneas del documento, donde ya hay una sola línea por SKU. Si el equipo introduce posteriormente detalles de recepción o despacho, deberá acordar una migración evolutiva; no crear otro Kardex.

## Contrato único para escribir existencias

Se eligió centralizar el efecto en stock mediante un trigger de BD. **Insertar el movimiento modifica stock y fija saldo posterior y fecha en la misma transacción. No sumar o restar stock otra vez desde el backend.** El código de recepción y salida debe respetar este contrato.

El caso de uso debe iniciar una transacción y utilizar el mismo cliente de PostgreSQL para el documento, sus movimientos y el cambio de situación correspondiente. Debe comprobar permisos, estado del documento y que todas las líneas requeridas estén incluidas antes de confirmar. El trigger no implementa esas HU ni confirma documentos automáticamente.

Para varios SKU se deben procesar/bloquear en orden ascendente de `id_sku`, de forma consistente entre recepción y despacho. El trigger bloquea el saldo por SKU y rechaza una salida con existencias insuficientes. Una operación fallida revierte también cualquier cambio de stock que hubiera hecho ese movimiento.

Entrada por recepción desde un repositorio parametrizado:

```sql
INSERT INTO kardex_movimiento
    (id_sku, tipo_movimiento, cantidad, id_usuario, id_recepcion)
VALUES ($1, 'ENTRADA_COMPRA', $2, $3, $4)
RETURNING id_movimiento, saldo_posterior, fecha_movimiento;
```

Salida por despacho:

```sql
INSERT INTO kardex_movimiento
    (id_sku, tipo_movimiento, cantidad, id_usuario, id_orden_despacho)
VALUES ($1, 'SALIDA_VENTA', $2, $3, $4)
RETURNING id_movimiento, saldo_posterior, fecha_movimiento;
```

El usuario se obtiene de la sesión autenticada; nunca del cuerpo enviado por el navegador. No enviar saldo ni fecha: los determina la BD. Los `$1` son parámetros de consultas del backend, no valores literales para pegar sin sustituir en pgAdmin.

## Reglas y límites

- Una entrada debe coincidir con la cantidad completa de su línea comprada. La HU de recepción debe verificar además el conjunto completo de líneas.
- La salida no puede superar lo solicitado en su línea de venta ni el stock existente. El flujo completo de despacho y su cierre pertenecen a la HU correspondiente.
- Solo se permite un movimiento por recepción y SKU, y uno por despacho y SKU. Las restricciones únicas evitan contabilizar dos veces un mismo origen.
- Los movimientos confirmados no se editan ni eliminan. Las correcciones y cambios requieren un flujo futuro acordado y movimientos compensatorios, sin reutilizar incorrectamente compra o venta.
- `APERTURA` permite registrar mercadería física inicial con responsable. Solo puede ser el primer movimiento de su SKU. Esta migración no registra aperturas ni crea una pantalla para ello.
- La migración 013 prepara saldos cero y la 014 fija el mínimo en 5. Cada SKU nuevo recibe automáticamente su registro de stock con ese mínimo. No se reconstruyen existencias desde compras emitidas ni recepciones antiguas; si ya había mercadería, debe reconciliarse mediante la apertura o un procedimiento acordado antes del uso real.
- `stock_minimo` es obligatorio tras la migración 014. El mínimo acordado es 5 pares para todos los SKU actuales y como predeterminado para los nuevos. Se conserva la restricción de entero no negativo; no se habilita una API de mantenimiento en esta HU.
- No modificar `cantidad_actual` directamente, borrar saldos ni usar TRUNCATE para corregir inventario. Las APIs de A5 serán únicamente de lectura. Los permisos de mantenimiento de BD se administran fuera de estas HU.
- No se agregan costos, precios, IGV, valorización ni nuevos estados a Compras.

## Situación que mostrará A5

Con el mínimo acordado de 5: cero → Agotado; de 1 a 5 → Stock bajo; de 6 en adelante → Disponible. La migración 014 elimina mínimos vacíos y configura el predeterminado para nuevas filas. La situación se calcula al consultar y no se guarda como otra columna.

## Aplicación y prueba

Ejecutar la migración completa una sola vez en la misma BD del backend, después de 012. Está delimitada por BEGIN y COMMIT. No modificar migraciones históricas. La aplicación de esta migración en la BD local no la ejecuta en las computadoras de los demás ni sube código a GitHub.

Desde `backend`, ejecutar `node scripts/probarMigracionInventario.mjs`. La prueba usa un esquema aislado que crea y elimina; no modifica órdenes, SKU, saldos o secuencias del esquema público. Verifica restricciones, duplicados, rollback, apertura, historial y concurrencia. La compatibilidad con las tablas públicas se comprueba sin aplicar cuando las nuevas tablas aún no existen.

Las migraciones no tienen un registro automático de ejecución en este proyecto: comprobar si existen ambas tablas antes de aplicarla. Si solo existe una, detenerse y revisar el estado; no ejecutar de nuevo el script completo ni borrar lo existente.


## Separación de roles y simulación local

Almacén ya no forma parte del panel administrativo. Sus rutas de interfaz y API requieren el rol Almacen; una cuenta con solo Administrador no tiene acceso a recepción, despacho ni Kardex. Una cuenta que tenga explícitamente ambos roles conserva sus permisos de Almacén. Esta decisión sustituye el acceso adicional de Administrador presente en los PR iniciales.

Para demostrar el recorrido de recepción se agregó backend/scripts/simularRecepcionCompra.mjs. No es una API ni implementa el botón de la HU de recepción. Solo admite compras EMITIDA del proveedor ficticio PROVEEDOR DE PRUEBA (NO REAL), con RUC 00000000000, y un usuario de Almacén activo.

El 22 de noviembre de 2026 se ejecutó una simulación persistente en la BD local: OC-2026-001, recepción 1, usuario de prueba operativa Yefri. Entraron 11 pares del SKU THR-NEG-40 y 3 del SKU de Colorado marrón talla 39, total 14. La observación de la recepción identifica expresamente que es una simulación local ejecutada desde un script. OC-2026-002 quedó pendiente. No se configuraron mínimos ni se alteraron costos.

El script bloquea la compra y los saldos, registra recepción y movimientos en una transacción, y deja que el trigger actualice el stock. Una repetición de la misma simulación no crea otra recepción ni vuelve a sumar los pares. Uso explícito desde backend: node scripts/simularRecepcionCompra.mjs --orden=3 --usuario=7 --confirmar-simulacion=si. No ejecutar para órdenes de proveedores reales.


## Mínimo acordado de cinco pares

Aplicar 014_stock_minimo_cinco.sql después de 013. Completa los SKU actuales con mínimo 5, establece DEFAULT 5 y prohíbe NULL. No modifica stock actual ni historial. La lógica de consulta compara saldo y mínimo; no se guarda otra columna de situación. Las compatibilidades de API con sin_minimo quedan sin coincidencias después de aplicar 014.

## Recepción completa implementada

El flujo de recepción física ya cuenta con interfaz y API transaccional; ver docs/recepcion-compra.md. El script de simulación anterior se conserva solo como herramienta de prueba. La confirmación comercial consulta la recepción verificada y nunca vuelve a sumar stock. Aplicar la migración 015 después de 014 en cada entorno.
