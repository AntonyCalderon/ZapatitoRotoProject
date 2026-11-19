export async function consultarTasaIgv(conexion) {
  const { rows } = await conexion.query(
    'SELECT valor::numeric(5,4)::text AS tasa FROM parametro_sistema WHERE clave = $1',
    ['IGV_TASA']
  );
  return rows[0]?.tasa ?? null;
}

/** Consulta el costo vigente por modelo y talla de las líneas de compra. */
export async function consultarCostosVigentesPorSku(conexion, idsSku) {
  if (idsSku.length === 0) return [];

  // El LEFT JOIN conserva el SKU cuando todavía no hay costo para su modelo y talla.
  const { rows } = await conexion.query(
    `SELECT p.id_sku, p.id_modelo, p.id_talla, c.costo_vigente::text AS costo_unitario
       FROM producto_sku AS p
       LEFT JOIN costo_base AS c
         ON c.id_modelo = p.id_modelo AND c.id_talla = p.id_talla
      WHERE p.id_sku = ANY($1::integer[])
      ORDER BY p.id_sku`,
    [idsSku]
  );
  return rows;
}
