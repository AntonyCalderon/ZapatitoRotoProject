BEGIN;
-- Se conserva Estatal para clientes anteriores cuya entidad aún no fue clasificada.
INSERT INTO tipo_cliente (nombre, segmento) VALUES
    ('Gobierno Regional', 'B2G'), ('Municipio', 'B2G');
ALTER TABLE orden_venta ADD COLUMN id_tipo_cliente SMALLINT REFERENCES tipo_cliente;
UPDATE orden_venta v SET id_tipo_cliente = c.id_tipo_cliente
FROM cliente c WHERE c.id_cliente = v.id_cliente;
-- El cálculo de HU12 deja pendientes los importes cuando falta stock, margen o costo.
ALTER TABLE detalle_orden_venta
    ALTER COLUMN costo_unitario DROP NOT NULL,
    ALTER COLUMN margen_porcentaje DROP NOT NULL,
    ALTER COLUMN precio_unitario DROP NOT NULL,
    ALTER COLUMN importe DROP NOT NULL;
COMMIT;
