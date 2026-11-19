-- =====================================================
-- MIGRACIÓN 005: Compras (orden de compra / borrador)
-- Basada en AyM_Shafet_BD.sql. HU01 solo usa estado Borrador.
-- =====================================================

BEGIN;

CREATE TABLE proveedor (
    id_proveedor INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    razon_social VARCHAR(160) NOT NULL,
    ruc CHAR(11) NOT NULL UNIQUE CHECK (ruc ~ '^[0-9]{11}$'),
    direccion VARCHAR(200),
    telefono VARCHAR(20),
    correo VARCHAR(160)
);

CREATE TABLE orden_compra (
    id_orden_compra INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE,
    estado VARCHAR(12) NOT NULL DEFAULT 'BORRADOR'
        CHECK (estado IN ('BORRADOR', 'EMITIDA', 'CANCELADO')),
    id_proveedor INTEGER REFERENCES proveedor (id_proveedor),
    id_usuario_creador INTEGER NOT NULL REFERENCES usuario (id_usuario),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_usuario_emisor INTEGER REFERENCES usuario (id_usuario),
    fecha_emision TIMESTAMPTZ,
    id_usuario_confirma INTEGER REFERENCES usuario (id_usuario),
    fecha_confirmacion TIMESTAMPTZ,
    id_usuario_cierre INTEGER REFERENCES usuario (id_usuario),
    fecha_cierre TIMESTAMPTZ,
    id_usuario_cancela INTEGER REFERENCES usuario (id_usuario),
    fecha_cancelacion TIMESTAMPTZ,
    subtotal NUMERIC(12,2) CHECK (subtotal >= 0),
    total NUMERIC(12,2) CHECK (total >= 0),
    observacion VARCHAR(500),

    CONSTRAINT ck_oc_cancelada CHECK (
        estado <> 'CANCELADO'
        OR (id_usuario_cancela IS NOT NULL AND fecha_cancelacion IS NOT NULL AND codigo IS NULL)
    )
);

CREATE INDEX ix_oc_estado ON orden_compra (estado, fecha_emision);

COMMIT;