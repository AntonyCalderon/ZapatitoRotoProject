import CampoCostoFaltante from './CampoCostoFaltante'

interface LineaCostoAdquisicion {
  idSku: number
  cantidad: number
  costoUnitario: string | null
  importe: string | null
}

export interface DatosResumenCostoAdquisicion {
  lineas: LineaCostoAdquisicion[]
  subtotalConocido: string
  total: string | null
}

interface ResumenCostoAdquisicionProps {
  resumen: DatosResumenCostoAdquisicion
  actualizarResumen?: () => Promise<void>
}

export default function ResumenCostoAdquisicion({ resumen, actualizarResumen }: ResumenCostoAdquisicionProps) {
  const { lineas, subtotalConocido, total } = resumen

  return (
    <section aria-label="Resumen de costos de adquisición"
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-5 py-4 text-lg font-semibold text-slate-900">
        Resumen de costos de adquisición
      </h2>

      {lineas.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-600">Agrega productos al borrador para ver los costos.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">SKU</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Pares</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Costo unitario</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {lineas.map((linea) => (
                  <tr key={linea.idSku}>
                    <th scope="row" className="px-5 py-3 font-medium">{linea.idSku}</th>
                    <td className="px-5 py-3 text-right">{linea.cantidad}</td>
                    <td className="px-5 py-3 text-right">
                      {linea.costoUnitario !== null ? `S/ ${linea.costoUnitario}` : (
                        actualizarResumen ? (
                          <CampoCostoFaltante idSku={linea.idSku} actualizarResumen={actualizarResumen} />
                        ) : 'Falta costo'
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {linea.importe === null ? '—' : `S/ ${linea.importe}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div role="status" className="border-t border-slate-200 bg-slate-50 px-5 py-4">
            {total === null && (
              <p className="mb-3 text-sm text-amber-900">Registra los costos faltantes para obtener el total.</p>
            )}
            <dl className="ml-auto max-w-xs space-y-2 text-sm tabular-nums">
              <div className="flex justify-between gap-3">
                <dt>{total === null ? 'Subtotal conocido' : 'Subtotal'}</dt>
                <dd>S/ {subtotalConocido}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
                <dt>Total de adquisición</dt>
                <dd className={total === null ? 'text-amber-900' : 'text-slate-900'}>
                  {total === null ? 'Pendiente' : `S/ ${total}`}
                </dd>
              </div>
            </dl>
          </div>
        </>
      )}
    </section>
  )
}
