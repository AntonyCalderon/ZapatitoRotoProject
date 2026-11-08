
-- ====================================================
-- MVP AyM Shafety
-- PostgreSQL - Modelo fisico del catalogo y costos
-- ====================================================

-- 1. MODELO
CREATE TABLE modelo (
    id_modelo INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_modelo VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. COLOR
CREATE TABLE color (
    id_color INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_color VARCHAR(50) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. TALLA
CREATE TABLE talla (
    id_talla INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_talla NUMERIC(4,1) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_talla_positiva CHECK (numero_talla > 0)
);

-- 4. PRODUCTO SKU
CREATE TABLE producto_sku (
    id_sku INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_sku VARCHAR(50) NOT NULL UNIQUE,
    id_modelo INTEGER NOT NULL,
    id_color INTEGER NOT NULL,
    id_talla INTEGER NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_sku_modelo
        FOREIGN KEY (id_modelo)
        REFERENCES modelo(id_modelo),

    CONSTRAINT fk_sku_color
        FOREIGN KEY (id_color)
        REFERENCES color(id_color),

    CONSTRAINT fk_sku_talla
        FOREIGN KEY (id_talla)
        REFERENCES talla(id_talla),

    CONSTRAINT uq_sku_variante
        UNIQUE (id_modelo, id_color, id_talla)
);

-- 5. COSTO BASE
CREATE TABLE costo_base (
    id_costo_base INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_modelo INTEGER NOT NULL,
    id_talla INTEGER NOT NULL,
    costo_vigente NUMERIC(12,2) NOT NULL,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_costo_modelo
        FOREIGN KEY (id_modelo)
        REFERENCES modelo(id_modelo),

    CONSTRAINT fk_costo_talla
        FOREIGN KEY (id_talla)
        REFERENCES talla(id_talla),

    CONSTRAINT uq_costo_modelo_talla
        UNIQUE (id_modelo, id_talla),

    CONSTRAINT ck_costo_positivo
        CHECK (costo_vigente > 0)
);

-- 6. HISTORIAL DE COSTO BASE
CREATE TABLE historial_costo_base (
    id_historial INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_costo_base INTEGER NOT NULL,
    costo_anterior NUMERIC(12,2) NOT NULL,
    costo_nuevo NUMERIC(12,2) NOT NULL,
    fecha_cambio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_historial_costo
        FOREIGN KEY (id_costo_base)
        REFERENCES costo_base(id_costo_base)
        ON DELETE RESTRICT,

    CONSTRAINT ck_historial_anterior
        CHECK (costo_anterior > 0),

    CONSTRAINT ck_historial_nuevo
        CHECK (costo_nuevo > 0),

    CONSTRAINT ck_historial_diferente
        CHECK (costo_anterior <> costo_nuevo)
);

-- INDICES
CREATE INDEX idx_sku_modelo ON producto_sku(id_modelo);
CREATE INDEX idx_sku_color ON producto_sku(id_color);
CREATE INDEX idx_sku_talla ON producto_sku(id_talla);

CREATE INDEX idx_costo_talla ON costo_base(id_talla);

CREATE INDEX idx_historial_costo_fecha
ON historial_costo_base(id_costo_base, fecha_cambio DESC);

-- ====================================================
-- AUTOMATIZACION DEL HISTORIAL
-- ====================================================

-- Actualiza la fecha del costo cuando cambia su valor.
CREATE OR REPLACE FUNCTION fn_actualizar_fecha_costo()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_fecha_costo
BEFORE UPDATE OF costo_vigente ON costo_base
FOR EACH ROW
WHEN (OLD.costo_vigente IS DISTINCT FROM NEW.costo_vigente)
EXECUTE FUNCTION fn_actualizar_fecha_costo();

-- Registra el costo anterior y nuevo automaticamente.
CREATE OR REPLACE FUNCTION fn_registrar_historial_costo()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO historial_costo_base (
        id_costo_base,
        costo_anterior,
        costo_nuevo,
        fecha_cambio
    )
    VALUES (
        NEW.id_costo_base,
        OLD.costo_vigente,
        NEW.costo_vigente,
        NEW.fecha_actualizacion
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registrar_historial_costo
AFTER UPDATE OF costo_vigente ON costo_base
FOR EACH ROW
WHEN (OLD.costo_vigente IS DISTINCT FROM NEW.costo_vigente)
EXECUTE FUNCTION fn_registrar_historial_costo();

-- ====================================================
-- FIN DEL MODELO FISICO INICIAL
-- ====================================================
