-- Evita colores duplicados al ignorar mayúsculas y espacios externos.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM color
    GROUP BY lower(btrim(nombre_color))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existen nombres de color duplicados normalizados';
  END IF;
END;
$$;

CREATE UNIQUE INDEX uq_color_nombre_normalizado
ON color (lower(btrim(nombre_color)));

COMMIT;
