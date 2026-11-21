BEGIN;

-- Base de datos compartida por Ventas y Almacén para los pedidos enviados a despacho.
CREATE TABLE cliente (
    id_cliente INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_tipo_cliente SMALLINT NOT NULL REFERENCES tipo_cliente (id_tipo_cliente),
    tipo_documento VARCHAR(20) NOT NULL,
    numero_documento VARCHAR(24) NOT NULL UNIQUE,
    razon_social_nombre VARCHAR(180) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(32),
    correo VARCHAR(180)
);

CREATE TABLE orden_venta (
    id_orden_venta INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES cliente (id_cliente),
    id_usuario_vendedor INTEGER NOT NULL REFERENCES usuario (id_usuario),
    estado VARCHAR(32) NOT NULL DEFAULT 'Borrador',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_confirmacion TIMESTAMPTZ,
    tipo_documento_cliente VARCHAR(30),
    numero_documento_cliente VARCHAR(50),
    tasa_igv NUMERIC(5,4) CHECK (tasa_igv BETWEEN 0 AND 1),
    subtotal NUMERIC(12,2) CHECK (subtotal >= 0),
    igv NUMERIC(12,2) CHECK (igv >= 0),
    total NUMERIC(12,2) CHECK (total >= 0),
    UNIQUE (id_cliente, tipo_documento_cliente, numero_documento_cliente)
);

CREATE TABLE detalle_orden_venta (
    id_detalle_venta INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_orden_venta INTEGER NOT NULL REFERENCES orden_venta (id_orden_venta),
    id_sku INTEGER NOT NULL REFERENCES producto_sku (id_sku),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(12,2) CHECK (costo_unitario >= 0),
    margen_porcentaje NUMERIC(6,2) CHECK (margen_porcentaje >= 0),
    precio_unitario NUMERIC(12,2) CHECK (precio_unitario >= 0),
    importe NUMERIC(22,2) CHECK (importe >= 0),
    UNIQUE (id_orden_venta, id_sku)
);

CREATE TABLE comprobante_pago (
    id_comprobante INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_orden_venta INTEGER NOT NULL UNIQUE REFERENCES orden_venta (id_orden_venta),
    tipo VARCHAR(20) NOT NULL,
    serie VARCHAR(12) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
    igv NUMERIC(12,2) NOT NULL CHECK (igv >= 0),
    total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
    id_usuario INTEGER NOT NULL REFERENCES usuario (id_usuario),
    UNIQUE (tipo, serie, numero)
);

CREATE TABLE orden_despacho (
    id_orden_despacho INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    id_orden_venta INTEGER NOT NULL UNIQUE REFERENCES orden_venta (id_orden_venta),
    estado VARCHAR(32) NOT NULL DEFAULT 'Pendiente de Despacho',
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_usuario_salida INTEGER REFERENCES usuario (id_usuario),
    fecha_salida TIMESTAMPTZ
);

CREATE INDEX ix_orden_despacho_cola
ON orden_despacho (estado, fecha_emision, id_orden_despacho);

COMMIT;
