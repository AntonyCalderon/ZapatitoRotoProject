-- PROYEC-6: existencias y Kardex físico compartidos por Almacén.
-- Requiere 001, 002, 005, 006, 011 y 012. Ejecutar una sola vez.
-- No reconstruye movimientos a partir de compras o ventas existentes.
-- CONTRATO DE ESCRITURA: recepción/despacho insertan un movimiento por SKU
-- dentro de su transacción. El trigger actualiza stock: NO actualizarlo además.
BEGIN;

CREATE TABLE stock_sku (
    id_sku INTEGER PRIMARY KEY REFERENCES producto_sku (id_sku),
    cantidad_actual INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_actual >= 0),
    stock_minimo INTEGER CHECK (stock_minimo >= 0)
);

COMMENT ON COLUMN stock_sku.stock_minimo IS
    'Pares mínimos por SKU. NULL = sin mínimo definido; cero es un valor definido.';

CREATE TABLE kardex_movimiento (
    id_movimiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sku INTEGER NOT NULL REFERENCES stock_sku (id_sku),
    tipo_movimiento VARCHAR(20) NOT NULL
        CHECK (tipo_movimiento IN ('APERTURA', 'ENTRADA_COMPRA', 'SALIDA_VENTA')),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    saldo_posterior INTEGER NOT NULL CHECK (saldo_posterior >= 0),
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    id_usuario INTEGER NOT NULL REFERENCES usuario (id_usuario),
    id_recepcion INTEGER REFERENCES recepcion_compra (id_recepcion),
    id_orden_despacho INTEGER REFERENCES orden_despacho (id_orden_despacho),

    CONSTRAINT ck_kardex_origen CHECK (
        (tipo_movimiento = 'ENTRADA_COMPRA'
            AND id_recepcion IS NOT NULL AND id_orden_despacho IS NULL)
        OR (tipo_movimiento = 'SALIDA_VENTA'
            AND id_recepcion IS NULL AND id_orden_despacho IS NOT NULL)
        OR (tipo_movimiento = 'APERTURA'
            AND id_recepcion IS NULL AND id_orden_despacho IS NULL)
    ),
    CONSTRAINT uq_kardex_recepcion_sku UNIQUE (id_recepcion, id_sku),
    CONSTRAINT uq_kardex_despacho_sku UNIQUE (id_orden_despacho, id_sku)
);

CREATE UNIQUE INDEX uq_kardex_apertura_sku
    ON kardex_movimiento (id_sku) WHERE tipo_movimiento = 'APERTURA';
CREATE INDEX ix_kardex_sku_fecha
    ON kardex_movimiento (id_sku, fecha_movimiento DESC, id_movimiento DESC);
CREATE INDEX ix_kardex_usuario ON kardex_movimiento (id_usuario);

COMMENT ON TABLE kardex_movimiento IS
    'Historial físico inmutable. Cantidad positiva; el tipo determina entrada o salida. Sin costos.';

-- Saldo inicial cero para todo SKU del catálogo; mínimo todavía no configurado.
INSERT INTO stock_sku (id_sku) SELECT id_sku FROM producto_sku;

CREATE FUNCTION crear_stock_para_sku() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO stock_sku (id_sku) VALUES (NEW.id_sku);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crear_stock_sku
    AFTER INSERT ON producto_sku
    FOR EACH ROW EXECUTE FUNCTION crear_stock_para_sku();

CREATE FUNCTION aplicar_movimiento_inventario() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_actual INTEGER;
    v_esperada INTEGER;
    v_saldo BIGINT;
BEGIN
    IF NEW.cantidad IS NULL OR NEW.cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser un entero positivo.' USING ERRCODE = '23514';
    END IF;

    -- La FK verifica que exista el documento. Esta consulta verifica además
    -- que el SKU realmente pertenece a sus líneas, sin duplicar esas líneas.
    IF NEW.tipo_movimiento = 'ENTRADA_COMPRA' THEN
        SELECT d.cantidad INTO v_esperada
        FROM recepcion_compra r
        JOIN detalle_orden_compra d ON d.id_orden_compra = r.id_orden_compra
        WHERE r.id_recepcion = NEW.id_recepcion AND d.id_sku = NEW.id_sku
        FOR SHARE OF r, d;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El SKU no pertenece a la compra de esta recepción.' USING ERRCODE = '23514';
        END IF;
        IF NEW.cantidad <> v_esperada THEN
            RAISE EXCEPTION 'La recepción debe incluir la cantidad completa de la línea de compra.' USING ERRCODE = '23514';
        END IF;
    ELSIF NEW.tipo_movimiento = 'SALIDA_VENTA' THEN
        SELECT d.cantidad INTO v_esperada
        FROM orden_despacho o
        JOIN detalle_orden_venta d ON d.id_orden_venta = o.id_orden_venta
        WHERE o.id_orden_despacho = NEW.id_orden_despacho AND d.id_sku = NEW.id_sku
        FOR SHARE OF o, d;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El SKU no pertenece a la venta de este despacho.' USING ERRCODE = '23514';
        END IF;
        IF NEW.cantidad > v_esperada THEN
            RAISE EXCEPTION 'La salida supera la cantidad de la línea de venta.' USING ERRCODE = '23514';
        END IF;
    ELSIF NEW.tipo_movimiento IS DISTINCT FROM 'APERTURA' THEN
        RAISE EXCEPTION 'Tipo de movimiento no admitido.' USING ERRCODE = '23514';
    END IF;

    -- Serializa operaciones sobre el mismo SKU y mantiene saldo e historial
    -- en la misma transacción. Para varios SKU bloquear siempre por id_sku.
    SELECT cantidad_actual INTO v_actual FROM stock_sku
    WHERE id_sku = NEW.id_sku FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe stock para el SKU indicado.' USING ERRCODE = '23503';
    END IF;

    IF NEW.tipo_movimiento = 'APERTURA' AND (v_actual <> 0 OR EXISTS (
        SELECT 1 FROM kardex_movimiento WHERE id_sku = NEW.id_sku
    )) THEN
        RAISE EXCEPTION 'La apertura solo se registra antes del primer movimiento del SKU.' USING ERRCODE = '23514';
    END IF;

    v_saldo := v_actual::BIGINT + CASE WHEN NEW.tipo_movimiento = 'SALIDA_VENTA'
        THEN -NEW.cantidad::BIGINT ELSE NEW.cantidad::BIGINT END;
    IF v_saldo < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente para registrar la salida.' USING ERRCODE = '23514';
    END IF;
    IF v_saldo > 2147483647 THEN
        RAISE EXCEPTION 'La cantidad excede el rango admitido de stock.' USING ERRCODE = '23514';
    END IF;

    UPDATE stock_sku SET cantidad_actual = v_saldo::INTEGER WHERE id_sku = NEW.id_sku;
    NEW.saldo_posterior := v_saldo::INTEGER;
    NEW.fecha_movimiento := clock_timestamp();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aplicar_movimiento_inventario
    BEFORE INSERT ON kardex_movimiento
    FOR EACH ROW EXECUTE FUNCTION aplicar_movimiento_inventario();

CREATE FUNCTION proteger_historial_kardex() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Los movimientos de Kardex confirmados no se modifican ni eliminan.'
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_proteger_historial_kardex
    BEFORE UPDATE OR DELETE ON kardex_movimiento
    FOR EACH ROW EXECUTE FUNCTION proteger_historial_kardex();

COMMIT;
