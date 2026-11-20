// PDF A4 con fuente estándar y codificación WinAnsi. Las posiciones se miden en bytes.
export function pdfOrden({ codigo, fecha, total, documento_emitido }) {
  const { proveedor, lineas, pares } = documento_emitido;
  const contenido = [];
  function agregar(texto) {
    const limpio = String(texto).replace(/\s+/g, ' ').trim();
    contenido.push(...(limpio.match(/.{1,85}(?:\s+|$)|.{1,85}/gu) || ['']));
  }
  agregar('Proveedor: ' + proveedor.razon_social);
  agregar('RUC: ' + proveedor.ruc);
  agregar('Dirección: ' + proveedor.direccion);
  agregar('');
  for (const l of lineas) {
    agregar(l.codigo_sku + ' | ' + l.nombre_modelo + ' | ' + l.nombre_color + ' | Talla ' + l.numero_talla);
    agregar(l.cantidad + ' pares x S/ ' + l.costo + ' = S/ ' + l.importe);
  }
  agregar('');
  if (documento_emitido.igv != null) {
    agregar('Subtotal: S/ ' + documento_emitido.subtotal);
    agregar('IGV: S/ ' + documento_emitido.igv);
  }
  agregar('Total: ' + pares + ' pares  |  S/ ' + total);
  const objetos = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'];
  const paginas = [];
  for (let inicio = 0; inicio < contenido.length; inicio += 44) {
    const pagina = objetos.length + 1;
    paginas.push(pagina + ' 0 R');
    const texto = ['ORDEN DE COMPRA ' + codigo, 'Fecha: ' + fecha + '  |  Página ' + paginas.length, '',
      ...contenido.slice(inicio, inicio + 44)];
    const comandos = texto.map(linea => {
      const seguro = linea.replace(/[^\x20-\xff]/gu, '?').replace(/[\\()]/g, '\\$&');
      return '(' + seguro + ') Tj T*';
    });
    const stream = ['BT /F1 10 Tf 15 TL 40 795 Td', ...comandos, 'ET'].join('\n');
    objetos.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + (pagina+1) + ' 0 R >>',
      '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
  }
  objetos[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objetos[1] = '<< /Type /Pages /Count ' + paginas.length + ' /Kids [' + paginas.join(' ') + '] >>';
  let pdf = '%PDF-1.4\n';
  const offsets = ['0000000000 65535 f '];
  objetos.forEach((objeto, i) => {
    offsets.push(String(pdf.length).padStart(10,'0') + ' 00000 n ');
    pdf += (i+1) + ' 0 obj\n' + objeto + '\nendobj\n';
  });
  const inicioIndice = pdf.length;
  pdf += 'xref\n0 ' + offsets.length + '\n' + offsets.join('\n') + '\ntrailer\n<< /Size ' + offsets.length +
    ' /Root 1 0 R >>\nstartxref\n' + inicioIndice + '\n%%EOF\n';
  return Buffer.from(pdf, 'latin1');
}
