-- PROYEC-6: mínimo acordado de cinco pares para todos los SKU actuales.
-- Requiere 013. No modifica cantidades físicas ni movimientos de Kardex.
BEGIN;

ALTER TABLE stock_sku ALTER COLUMN stock_minimo SET DEFAULT 5;

UPDATE stock_sku SET stock_minimo = 5
WHERE stock_minimo IS DISTINCT FROM 5;

ALTER TABLE stock_sku ALTER COLUMN stock_minimo SET NOT NULL;

COMMENT ON COLUMN stock_sku.stock_minimo IS
    'Mínimo de pares por SKU. Acuerdo inicial: 5 para los actuales y como predeterminado para nuevos SKU. Stock cero = agotado; de 1 al mínimo = stock bajo; superior al mínimo = disponible.';

COMMIT;
