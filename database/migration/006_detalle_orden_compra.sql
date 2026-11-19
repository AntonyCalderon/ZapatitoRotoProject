-- =====================================================
-- MIGRACIÓN 006: Líneas de la orden de compra (HU02)
-- Basada en AyM_Shafet_BD.sql. Requiere la migración 005.
-- En un borrador el costo puede faltar; HU03 lo calcula y HU05 lo exige al emitir.
-- =====================================================

BEGIN;

CREATE TABLE detalle_orden_compra (
    id_detalle_compra INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_orden_compra INTEGER NOT NULL REFERENCES orden_compra (id_orden_compra),
    id_sku INTEGER NOT NULL REFERENCES producto_sku (id_sku),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(10,2) CHECK (costo_unitario > 0),
    importe NUMERIC(12,2) CHECK (importe >= 0),

    -- RN-05: una sola línea por SKU en cada solicitud.
    CONSTRAINT uq_detalle_compra UNIQUE (id_orden_compra, id_sku)
);

CREATE INDEX ix_detalle_compra_sku ON detalle_orden_compra (id_sku);

COMMIT;
