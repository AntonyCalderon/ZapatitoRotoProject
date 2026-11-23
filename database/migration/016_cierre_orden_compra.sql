BEGIN;

ALTER TABLE orden_compra DROP CONSTRAINT orden_compra_estado_check;
ALTER TABLE orden_compra
  ADD CONSTRAINT orden_compra_estado_check CHECK (estado IN ('BORRADOR','EMITIDA','CANCELADO','CERRADO')),
  ADD CONSTRAINT ck_oc_cierre CHECK (
    (estado = 'CERRADO' AND id_usuario_cierre IS NOT NULL AND fecha_cierre IS NOT NULL
      AND id_usuario_confirma IS NOT NULL AND fecha_confirmacion IS NOT NULL
      AND codigo IS NOT NULL AND documento_emitido IS NOT NULL)
    OR (estado <> 'CERRADO' AND id_usuario_cierre IS NULL AND fecha_cierre IS NULL)
  );

CREATE FUNCTION fn_validar_cierre_compra() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'CERRADO' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Una compra cerrada conserva su información histórica.' USING ERRCODE = '23514';
  END IF;
  IF NEW.estado = 'CERRADO' AND OLD.estado <> 'CERRADO' THEN
    IF OLD.estado <> 'EMITIDA' OR NOT EXISTS (
      SELECT 1 FROM recepcion_compra r WHERE r.id_orden_compra = NEW.id_orden_compra
      AND EXISTS (SELECT 1 FROM detalle_orden_compra d WHERE d.id_orden_compra = NEW.id_orden_compra)
      AND NOT EXISTS (
        SELECT 1 FROM detalle_orden_compra d WHERE d.id_orden_compra = NEW.id_orden_compra
        AND NOT EXISTS (SELECT 1 FROM kardex_movimiento k WHERE k.id_recepcion = r.id_recepcion
          AND k.id_sku = d.id_sku AND k.tipo_movimiento = 'ENTRADA_COMPRA' AND k.cantidad = d.cantidad)
      )
    ) THEN
      RAISE EXCEPTION 'Solo se cierra una compra emitida con recepción completa verificada.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validar_cierre_compra BEFORE UPDATE ON orden_compra
FOR EACH ROW EXECUTE FUNCTION fn_validar_cierre_compra();

COMMIT;
