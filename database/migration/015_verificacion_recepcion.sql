-- Recepción completa verificada e idempotencia. Requiere 014.
-- No cambia los estados BORRADOR, EMITIDA y CANCELADO de Compras.
BEGIN;
ALTER TABLE recepcion_compra
    ADD COLUMN clave_idempotencia UUID,
    ADD COLUMN huella_verificacion VARCHAR(64),
    ADD CONSTRAINT uq_recepcion_idempotencia UNIQUE (clave_idempotencia),
    ADD CONSTRAINT ck_recepcion_verificacion CHECK (
        (clave_idempotencia IS NULL AND huella_verificacion IS NULL)
        OR (clave_idempotencia IS NOT NULL AND huella_verificacion IS NOT NULL
            AND huella_verificacion ~ '^[0-9a-f]{64}$')
    );
COMMENT ON COLUMN recepcion_compra.huella_verificacion IS
    'Huella de la orden, usuario y líneas verificadas para reconocer reintentos idénticos.';
COMMIT;
