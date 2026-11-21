/*
Responsabilidad: leer y guardar los márgenes de utilidad en PostgreSQL.
No recibe peticiones HTTP ni aplica reglas de negocio.
*/

import pool from '../../config/database.js';

// Lista los tipos de cliente con el margen de su segmento (null si aún no se configuró).
export async function listarMargenes() {
  const resultado = await pool.query(`
    SELECT t.id_tipo_cliente, t.nombre, t.segmento,
           m.porcentaje, m.fecha_actualizacion
    FROM tipo_cliente t
    LEFT JOIN margen_utilidad m ON m.segmento = t.segmento
    ORDER BY t.id_tipo_cliente
  `);

  return resultado.rows;
}

// Crea el margen del segmento o lo actualiza si ya existía (un único margen vigente por segmento).
export async function guardarMargen(segmento, porcentaje, idUsuario) {
  const resultado = await pool.query(
    `INSERT INTO margen_utilidad (segmento, porcentaje, id_usuario)
     VALUES ($1, $2, $3)
     ON CONFLICT (segmento) DO UPDATE
       SET porcentaje = EXCLUDED.porcentaje,
           id_usuario = EXCLUDED.id_usuario,
           fecha_actualizacion = now()
     RETURNING segmento, porcentaje, fecha_actualizacion`,
    [segmento, porcentaje, idUsuario]
  );

  return resultado.rows[0];
}