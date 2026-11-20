BEGIN;
INSERT INTO parametro_sistema (clave, valor) VALUES ('LOTE_MINIMO_PARES', 12)
ON CONFLICT (clave) DO NOTHING;
CREATE TABLE IF NOT EXISTS correlativo_documento (
  id_correlativo smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_documento varchar(20) NOT NULL CHECK (tipo_documento IN ('OC','OD','CAMBIO','FACTURA','BOLETA')),
  serie varchar(4) NOT NULL DEFAULT '',
  anio smallint NOT NULL DEFAULT 0,
  ultimo_numero integer NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
  UNIQUE (tipo_documento, serie, anio)
);
CREATE TABLE IF NOT EXISTS origen_orden_compra (
  id_origen integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_orden_compra integer NOT NULL REFERENCES orden_compra,
  tipo varchar(12) NOT NULL CHECK (tipo IN ('Pedido','Contrato','Licitacion','Reposicion')),
  referencia varchar(80),
  CHECK (tipo = 'Reposicion' OR referencia IS NOT NULL)
);
-- Datos públicos tal como fueron aprobados, para reimprimir tras cambios en el catálogo.
ALTER TABLE orden_compra ADD COLUMN IF NOT EXISTS documento_emitido jsonb;
COMMIT;
