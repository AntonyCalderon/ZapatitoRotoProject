BEGIN;

CREATE TABLE IF NOT EXISTS parametro_sistema (
    clave VARCHAR(50) PRIMARY KEY,
    valor NUMERIC NOT NULL
);

-- Admite instalaciones previas de emision que guardaban el parametro como texto.
ALTER TABLE parametro_sistema ALTER COLUMN valor TYPE NUMERIC USING valor::numeric;
ALTER TABLE parametro_sistema ADD
    CONSTRAINT ck_parametro_tasa_igv CHECK (
        clave <> 'IGV_TASA' OR (valor BETWEEN 0 AND 1 AND valor = round(valor, 4))
    );

INSERT INTO parametro_sistema (clave, valor) VALUES ('IGV_TASA', 0.18) ON CONFLICT (clave) DO NOTHING;

ALTER TABLE detalle_orden_compra
    ALTER COLUMN costo_unitario TYPE NUMERIC(12,2),
    ALTER COLUMN importe TYPE NUMERIC(22,2);

COMMENT ON COLUMN detalle_orden_compra.costo_unitario IS 'Costo base por par sin IGV.';
COMMENT ON COLUMN detalle_orden_compra.importe IS 'Cantidad por costo unitario sin IGV.';
COMMENT ON COLUMN orden_compra.total IS 'Total de adquisición, con el IGV cuando corresponde.';

-- En el primer registro todavía no existe un costo anterior.
ALTER TABLE historial_costo_base ALTER COLUMN costo_anterior DROP NOT NULL;

CREATE FUNCTION fn_registrar_primer_costo()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO historial_costo_base (id_costo_base, costo_anterior, costo_nuevo, fecha_cambio)
    VALUES (NEW.id_costo_base, NULL, NEW.costo_vigente, NEW.fecha_actualizacion);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registrar_primer_costo
AFTER INSERT ON costo_base
FOR EACH ROW EXECUTE FUNCTION fn_registrar_primer_costo();

CREATE FUNCTION fn_verificar_costos_para_emision()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'EMITIDA' AND (
        TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM detalle_orden_compra WHERE id_orden_compra = NEW.id_orden_compra
        ) OR EXISTS (
            SELECT 1
            FROM detalle_orden_compra d
            JOIN producto_sku p ON p.id_sku = d.id_sku
            LEFT JOIN costo_base cb ON cb.id_modelo = p.id_modelo AND cb.id_talla = p.id_talla
            WHERE d.id_orden_compra = NEW.id_orden_compra AND cb.id_costo_base IS NULL
        ) THEN
            RAISE EXCEPTION 'La orden requiere productos y costos registrados para emitirse.'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verificar_costos_para_emision
BEFORE INSERT OR UPDATE OF estado ON orden_compra
FOR EACH ROW EXECUTE FUNCTION fn_verificar_costos_para_emision();

COMMIT;
