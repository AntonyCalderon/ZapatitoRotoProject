-- =====================================================
-- MIGRACIÓN 010: Margen de utilidad por segmento (HU22)
-- Basada en AyM_Shafet_BD.sql.
-- =====================================================

BEGIN;

CREATE TABLE tipo_cliente (
    id_tipo_cliente SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(40) NOT NULL UNIQUE,
    segmento VARCHAR(3) NOT NULL CHECK (segmento IN ('B2G', 'B2B', 'B2C'))
);

-- Tres tipos de cliente: cada uno corresponde a un segmento.
INSERT INTO tipo_cliente (nombre, segmento) VALUES
    ('Estatal', 'B2G'),
    ('Privado', 'B2B'),
    ('Particular', 'B2C');

-- Un único margen vigente por segmento (RN-02), con usuario y fecha del último cambio (RN-06).
CREATE TABLE margen_utilidad (
    id_margen SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    segmento VARCHAR(3) NOT NULL UNIQUE CHECK (segmento IN ('B2G', 'B2B', 'B2C')),
    porcentaje NUMERIC(6,2) NOT NULL CHECK (porcentaje >= 0),
    id_usuario INTEGER NOT NULL REFERENCES usuario (id_usuario),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;