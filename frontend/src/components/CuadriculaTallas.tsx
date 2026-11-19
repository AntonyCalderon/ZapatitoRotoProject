import type { TallaCompra } from '../services/lineaCompraService'
import { esCantidadValida, formatearTalla } from '../utils/lineasCompra'

interface Props {
  tallas: TallaCompra[]
  cantidades: Record<number, string>
  deshabilitado?: boolean
  onCambio: (idSku: number, texto: string) => void
}

// Muestra una celda de cantidad por cada talla disponible y el total de pares de la cuadrícula.
export default function CuadriculaTallas({ tallas, cantidades, deshabilitado = false, onCambio }: Props) {
  const total = tallas.reduce((suma, talla) => {
    const texto = cantidades[talla.id_sku] ?? ''
    return suma + (esCantidadValida(texto) && texto !== '' ? Number(texto) : 0)
  }, 0)

  if (tallas.length === 0) {
    return <p className="text-sm text-slate-500">No hay tallas disponibles para esta combinación.</p>
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tallas.map((talla) => {
          const texto = cantidades[talla.id_sku] ?? ''
          const valida = esCantidadValida(texto)
          const etiqueta = `Talla ${formatearTalla(talla.numero_talla)}`

          return (
            <div key={talla.id_sku}>
              <label htmlFor={`talla-${talla.id_sku}`} className="mb-1 block text-sm font-semibold text-slate-800">
                {etiqueta}
              </label>
              <input
                id={`talla-${talla.id_sku}`}
                type="text"
                inputMode="numeric"
                value={texto}
                disabled={deshabilitado}
                aria-invalid={!valida}
                placeholder="0"
                onChange={(e) => onCambio(talla.id_sku, e.target.value.trim())}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 aria-[invalid=true]:border-rose-400 disabled:bg-slate-100"
              />
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">Total de la cuadrícula: {total} pares</p>
    </div>
  )
}
