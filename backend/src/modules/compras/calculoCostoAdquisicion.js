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

// Costos finales del proveedor; no se agrega un recargo tributario.
export function calcularCostoAdquisicion(lineas) {
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

  return {
    lineas: lineasCalculadas,
    subtotalConocido: aSoles(subtotalConocido),
    total: faltaCosto ? null : aSoles(subtotalConocido)
  };
}
