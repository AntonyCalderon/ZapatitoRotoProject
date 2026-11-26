BEGIN;
-- HU14 (PROYEC-25): emitir y corregir comprobantes de pago.
-- Un comprobante emitido no se edita: se anula con una nota de crédito y la venta
-- puede recibir otro comprobante con el número siguiente. Por eso la regla pasa de
-- «un comprobante por venta» a «un comprobante vigente por venta».

ALTER TABLE comprobante_pago
    ADD COLUMN estado VARCHAR(10) NOT NULL DEFAULT 'Emitido'
        CONSTRAINT ck_comprobante_estado CHECK (estado IN ('Emitido', 'Anulado')),
    -- Copia de los datos impresos (cliente, líneas y montos), como orden_compra.documento_emitido.
    ADD COLUMN documento_emitido JSONB;

-- Las restricciones se crearon sin nombre en 009 y 012: se buscan por su definición.
DO $$
DECLARE restriccion record;
BEGIN
    FOR restriccion IN
        SELECT c.conname FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'id_orden_venta'
        WHERE c.conrelid = 'comprobante_pago'::regclass AND c.contype = 'u'
          AND c.conkey = ARRAY[a.attnum]::smallint[]
    LOOP
        EXECUTE format('ALTER TABLE comprobante_pago DROP CONSTRAINT %I', restriccion.conname);
    END LOOP;
    FOR restriccion IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'correlativo_documento'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%tipo_documento%'
    LOOP
        EXECUTE format('ALTER TABLE correlativo_documento DROP CONSTRAINT %I', restriccion.conname);
    END LOOP;
END $$;

CREATE UNIQUE INDEX uq_comprobante_vigente_venta
    ON comprobante_pago (id_orden_venta) WHERE estado = 'Emitido';

ALTER TABLE correlativo_documento ADD CONSTRAINT ck_correlativo_tipo_documento
    CHECK (tipo_documento IN ('OC', 'OD', 'CAMBIO', 'FACTURA', 'BOLETA', 'NOTA_CREDITO'));

CREATE TABLE nota_credito (
    id_nota_credito INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_comprobante INTEGER NOT NULL UNIQUE REFERENCES comprobante_pago (id_comprobante),
    serie VARCHAR(4) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    -- Códigos del catálogo 09 de SUNAT usados en el MVP.
    motivo CHAR(2) NOT NULL CHECK (motivo IN ('01', '02', '03')),
    sustento VARCHAR(250) NOT NULL CHECK (length(btrim(sustento)) >= 5),
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
    igv NUMERIC(12,2) NOT NULL CHECK (igv >= 0),
    total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_usuario INTEGER NOT NULL REFERENCES usuario (id_usuario),
    UNIQUE (serie, numero)
);

COMMENT ON TABLE nota_credito IS
    'Anula un comprobante_pago antes de enviar la venta a Almacén. El número anulado no se reutiliza.';

COMMIT;
