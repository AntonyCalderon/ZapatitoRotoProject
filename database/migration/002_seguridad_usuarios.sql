
-- =====================================================
-- MIGRACIÓN 002: Usuarios y roles
-- Agrega el control de acceso sin alterar el catálogo.
-- =====================================================

BEGIN;

-- 1. Guardamos los cuatro roles del sistema.
CREATE TABLE rol (
    id_rol INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. Cada trabajador tendrá una cuenta.
CREATE TABLE usuario (
    id_usuario INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    password_hash TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_usuario_nombre
        CHECK (LENGTH(TRIM(nombre)) > 0),

    CONSTRAINT ck_usuario_password_hash
        CHECK (LENGTH(TRIM(password_hash)) > 0)
);

-- Evitamos correos duplicados aunque cambien mayúsculas.
CREATE UNIQUE INDEX uq_usuario_correo
ON usuario (LOWER(TRIM(correo)));

-- 3. Relacionamos usuarios y roles.
CREATE TABLE usuario_rol (
    id_usuario INTEGER NOT NULL,
    id_rol INTEGER NOT NULL,

    CONSTRAINT pk_usuario_rol
        PRIMARY KEY (id_usuario, id_rol),

    CONSTRAINT fk_usuario_rol_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_rol_rol
        FOREIGN KEY (id_rol)
        REFERENCES rol(id_rol)
        ON DELETE RESTRICT
);

CREATE INDEX idx_usuario_rol_id_rol
ON usuario_rol(id_rol);

-- Registramos únicamente los roles iniciales.
-- Todavía no creamos cuentas ni contraseñas.
INSERT INTO rol (nombre_rol)
VALUES
    ('Administrador'),
    ('Compras'),
    ('Almacen'),
    ('Ventas');

COMMIT;
