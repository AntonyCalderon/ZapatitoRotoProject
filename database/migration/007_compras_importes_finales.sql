BEGIN;
LOCK TABLE orden_compra IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM orden_compra WHERE upper(estado) NOT IN ('BORRADOR','EMITIDA','CANCELADO')) THEN
    RAISE EXCEPTION 'Hay estados fuera de BORRADOR, EMITIDA y CANCELADO. Revisar antes de migrar.';
  END IF;
END $$;
ALTER TABLE orden_compra
  DROP CONSTRAINT IF EXISTS ck_oc_emitida_completa,
  DROP CONSTRAINT IF EXISTS ck_oc_recibida,
  DROP CONSTRAINT IF EXISTS ck_oc_cerrada,
  DROP CONSTRAINT IF EXISTS ck_oc_cancelada,
  DROP CONSTRAINT IF EXISTS orden_compra_estado_check;
UPDATE orden_compra SET estado = upper(estado) WHERE estado <> upper(estado);
ALTER TABLE orden_compra
  ALTER COLUMN estado SET DEFAULT 'BORRADOR',
  ADD CONSTRAINT orden_compra_estado_check CHECK (estado IN ('BORRADOR','EMITIDA','CANCELADO')),
  ADD CONSTRAINT ck_oc_cancelada CHECK (estado <> 'CANCELADO' OR
    (id_usuario_cancela IS NOT NULL AND fecha_cancelacion IS NOT NULL AND codigo IS NULL)),
  DROP COLUMN IF EXISTS tasa_igv,
  DROP COLUMN IF EXISTS igv;
COMMENT ON COLUMN detalle_orden_compra.costo_unitario IS 'Costo final por par informado por el proveedor; no se agrega impuesto.';
COMMENT ON COLUMN detalle_orden_compra.importe IS 'Cantidad por costo unitario final. Puede quedar pendiente en el borrador.';
COMMENT ON COLUMN orden_compra.total IS 'Importe final de compra; sin recargo tributario calculado por el sistema.';
COMMIT;
