# Disponibilidad de productos SKU

Para nuevas operaciones de Compras, Ventas y Almacén, un SKU está disponible solo si `producto_sku.activo`, `modelo.activo`, `talla.activo` y `color.activo` son `TRUE`. La consulta debe unir las cuatro tablas y aplicar las cuatro condiciones; el estado del SKU por sí solo no basta.

`codigo_sku`, `id_modelo`, `id_talla` e `id_color` definen la identidad de una variante y no tienen ruta de edición. La desactivación cambia únicamente `producto_sku.activo` y conserva las relaciones. HU23 continúa calculando el costo base por modelo y talla.
