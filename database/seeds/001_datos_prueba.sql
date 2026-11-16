-- Modelos
INSERT INTO modelo (nombre_modelo)
VALUES ('Threshold'), ('Colorado');

-- Colores
INSERT INTO color (nombre_color)
VALUES ('Negro'), ('Marron');

-- Tallas
INSERT INTO talla (numero_talla)
VALUES (39), (40), (41);

-- Variantes SKU
INSERT INTO producto_sku
(codigo_sku, id_modelo, id_color, id_talla)
VALUES
('THR-NEG-40', 1, 1, 2),
('THR-MAR-40', 1, 2, 2),
('THR-NEG-41', 1, 1, 3);

-- Costo por modelo y talla
INSERT INTO costo_base
(id_modelo, id_talla, costo_vigente)
VALUES
(1, 2, 180.00),
(1, 3, 190.00);

-- HU-07: Actualizar costo Threshold talla 40
UPDATE costo_base
SET costo_vigente = 195.00
WHERE id_modelo = 1 AND id_talla = 2;

-- Ver costos vigentes
SELECT
    m.nombre_modelo,
    t.numero_talla,
    cb.costo_vigente,
    cb.fecha_actualizacion
FROM costo_base cb
JOIN modelo m ON m.id_modelo = cb.id_modelo
JOIN talla t ON t.id_talla = cb.id_talla;

-- Ver historial de costos
SELECT
    m.nombre_modelo,
    t.numero_talla,
    h.costo_anterior,
    h.costo_nuevo,
    h.fecha_cambio
FROM historial_costo_base h
JOIN costo_base cb ON cb.id_costo_base = h.id_costo_base
JOIN modelo m ON m.id_modelo = cb.id_modelo
JOIN talla t ON t.id_talla = cb.id_talla
ORDER BY h.fecha_cambio DESC;

-- Consultar el costo vigente de cada SKU
SELECT
    p.codigo_sku,
    m.nombre_modelo,
    c.nombre_color,
    t.numero_talla,
    cb.costo_vigente
FROM producto_sku p
JOIN modelo m ON m.id_modelo = p.id_modelo
JOIN color c ON c.id_color = p.id_color
JOIN talla t ON t.id_talla = p.id_talla
LEFT JOIN costo_base cb
    ON cb.id_modelo = p.id_modelo
   AND cb.id_talla = p.id_talla;
