function aCentimos(costoUnitario) {
  if (typeof costoUnitario !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(costoUnitario)) {
    throw new RangeError('El costo debe expresarse en soles con hasta dos decimales.');
  }

  const [soles, decimales = ''] = costoUnitario.split('.');
  const centimos = BigInt(soles) * 100n + BigInt(decimales.padEnd(2, '0'));
  if (centimos === 0n) {
    throw new RangeError('El costo debe ser mayor que cero.');
  }
  return centimos;
}

function aSoles(centimos) {
  const soles = centimos / 100n;
  const decimales = (centimos % 100n).toString().padStart(2, '0');
  return `${soles}.${decimales}`;
}

// Los costos y la tasa se reciben como texto decimal, tal como salen de PostgreSQL.
// Un costo null indica que el par modelo y talla aún no tiene un costo registrado.
export function calcularCostoAdquisicion(lineas, tasaIgv) {
  if (typeof tasaIgv !== 'string' || !/^\d+(?:\.\d{1,4})?$/.test(tasaIgv)) {
    throw new RangeError('La tasa de IGV debe tener hasta cuatro decimales.');
  }

  const [entero, decimales = ''] = tasaIgv.split('.');
  const tasaEscalada = BigInt(entero) * 10_000n + BigInt(decimales.padEnd(4, '0'));
  if (tasaEscalada > 10_000n) {
    throw new RangeError('La tasa de IGV debe expresarse como una fracción entre 0 y 1.');
  }

  let subtotalConocido = 0n;
  let faltaCosto = false;
  const lineasCalculadas = lineas.map((linea) => {
    if (!Number.isSafeInteger(linea.cantidad) || linea.cantidad < 1) {
      throw new RangeError('La cantidad de cada línea debe ser un entero positivo.');
    }
    if (linea.costoUnitario === null) {
      faltaCosto = true;
      return { ...linea, importe: null };
    }

    const importe = BigInt(linea.cantidad) * aCentimos(linea.costoUnitario);
    subtotalConocido += importe;
    return { ...linea, importe: aSoles(importe) };
  });

  // El IGV se aplica al subtotal y se redondea al centavo más próximo.
  const igv = (subtotalConocido * tasaEscalada + 5_000n) / 10_000n;
  return {
    lineas: lineasCalculadas,
    subtotalConocido: aSoles(subtotalConocido),
    igv: faltaCosto ? null : aSoles(igv),
    total: faltaCosto ? null : aSoles(subtotalConocido + igv)
  };
}
