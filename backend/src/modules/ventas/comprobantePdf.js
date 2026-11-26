import { MOTIVOS_NOTA_CREDITO } from './comprobante.domain.js';

// Mismo formato que ordenPdf.js: A4, fuente estándar y codificación WinAnsi, sin librerías.
const LEYENDA = 'REPRESENTACION INTERNA. NO VALIDO COMO COMPROBANTE ELECTRONICO ANTE SUNAT.';

const soles = valor => 'S/ ' + Number(valor).toFixed(2);

export function pdfComprobante({ tipo, serie, numero, estado, fecha, documento_emitido: doc, referencia, motivo, sustento }) {
  const contenido = [];
  function agregar(texto) {
    const limpio = String(texto).replace(/\s+/g, ' ').trim();
    contenido.push(...(limpio.match(/.{1,85}(?:\s+|$)|.{1,85}/gu) || ['']));
  }
  agregar('AyM Shafety');
  agregar(LEYENDA);
  if (estado === 'Anulado') agregar('ESTE COMPROBANTE FUE ANULADO CON UNA NOTA DE CREDITO.');
  agregar('');
  agregar(`${doc.cliente.tipo_documento}: ${doc.cliente.numero_documento}`);
  agregar(`Cliente: ${doc.cliente.nombre}`);
  agregar(`Dirección: ${doc.cliente.direccion}`);
  if (doc.documento_respaldo) agregar(`Documento de respaldo: ${doc.documento_respaldo.tipo ?? ''} ${doc.documento_respaldo.numero}`);
  if (referencia) {
    agregar(`Comprobante que modifica: ${referencia}`);
    agregar(`Motivo: ${motivo} - ${MOTIVOS_NOTA_CREDITO[motivo] ?? ''}`);
    agregar(`Sustento: ${sustento}`);
  }
  agregar('');
  for (const linea of doc.lineas) {
    agregar(`${linea.codigo_sku} | ${linea.modelo} | ${linea.color} | Talla ${Number(linea.talla)}`);
    agregar(`${linea.cantidad} pares x ${soles(linea.precio_unitario)} = ${soles(linea.importe)} (sin IGV)`);
  }
  agregar('');
  agregar(`Op. gravada: ${soles(doc.subtotal)}`);
  agregar(`IGV (${(Number(doc.tasa_igv) * 100).toFixed(0)} %): ${soles(doc.igv)}`);
  agregar(`Importe total: ${soles(doc.total)}`);

  const titulo = `${tipo.toUpperCase()} ${serie}-${numero}`;
  const objetos = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'];
  const paginas = [];
  for (let inicio = 0; inicio < contenido.length; inicio += 44) {
    const pagina = objetos.length + 1;
    paginas.push(pagina + ' 0 R');
    const texto = [titulo, 'Fecha: ' + fecha + '  |  Página ' + paginas.length, '', ...contenido.slice(inicio, inicio + 44)];
    const comandos = texto.map(linea => '(' + linea.replace(/[^\x20-\xff]/gu, '?').replace(/[\\()]/g, '\\$&') + ') Tj T*');
    const stream = ['BT /F1 10 Tf 15 TL 40 795 Td', ...comandos, 'ET'].join('\n');
    objetos.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + (pagina + 1) + ' 0 R >>',
      '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
  }
  objetos[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objetos[1] = '<< /Type /Pages /Count ' + paginas.length + ' /Kids [' + paginas.join(' ') + '] >>';
  let pdf = '%PDF-1.4\n';
  const offsets = ['0000000000 65535 f '];
  objetos.forEach((objeto, i) => {
    offsets.push(String(pdf.length).padStart(10, '0') + ' 00000 n ');
    pdf += (i + 1) + ' 0 obj\n' + objeto + '\nendobj\n';
  });
  const inicioIndice = pdf.length;
  pdf += 'xref\n0 ' + offsets.length + '\n' + offsets.join('\n') + '\ntrailer\n<< /Size ' + offsets.length +
    ' /Root 1 0 R >>\nstartxref\n' + inicioIndice + '\n%%EOF\n';
  return Buffer.from(pdf, 'latin1');
}
