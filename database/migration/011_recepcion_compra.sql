BEGIN;
CREATE TABLE recepcion_compra (
    id_recepcion INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_orden_compra INTEGER NOT NULL UNIQUE REFERENCES orden_compra,
    id_usuario_almacen INTEGER NOT NULL REFERENCES usuario,
    fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT now(),
    observacion VARCHAR(500)
);
COMMIT;
