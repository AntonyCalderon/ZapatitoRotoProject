import { useEffect, useState } from 'react'

import { obtenerMargenes, guardarMargen } from '../services/margenService'
import type { MargenTipoCliente } from '../services/margenService'

function formatearFecha(valor: string) {
  return new Date(valor).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
}

/*
El administrador configura el porcentaje de utilidad de cada tipo de cliente.
Cada tipo pertenece a un segmento y cada segmento tiene un único margen vigente.
*/
export default function MargenesPage() {
  const [margenes, setMargenes] = useState<MargenTipoCliente[]>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargar() {
      try {
        const datos = await obtenerMargenes()
        setMargenes(datos)
        setValores(Object.fromEntries(datos.map((m) => [m.segmento, m.porcentaje ?? ''])))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los márgenes.')
      } finally {
        setCargando(false)
      }
    }

    void cargar()
  }, [])

  async function guardar(margen: MargenTipoCliente) {
    setError('')
    setMensaje('')

    const texto = (valores[margen.segmento] ?? '').trim()

    // Aceptamos porcentajes de 0 en adelante, con máximo dos decimales.
    if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) {
      setError('Ingresa un porcentaje de 0 o más, con máximo dos decimales.')
      return
    }

    setGuardando(margen.segmento)

    try {
      const resultado = await guardarMargen(margen.segmento, Number(texto))

      setMargenes((anteriores) =>
        anteriores.map((m) =>
          m.segmento === margen.segmento
            ? {
                ...m,
                porcentaje: resultado.margen.porcentaje,
                fecha_actualizacion: resultado.margen.fecha_actualizacion
              }
            : m
        )
      )
      setValores((anteriores) => ({ ...anteriores, [margen.segmento]: resultado.margen.porcentaje }))
      setMensaje(`Margen de ${margen.nombre} guardado correctamente.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el margen.')
    } finally {
      setGuardando('')
    }
  }

  return (
    <div className="min-w-0">
      <section className="max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-7 sm:px-10">
          <h2 className="text-xl font-bold text-slate-900">Márgenes de utilidad</h2>
          <p className="mt-1 text-slate-600">Porcentaje de utilidad por tipo de cliente</p>
        </header>

        <div className="space-y-4 px-6 py-8 sm:px-10">
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {mensaje && (
            <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
              {mensaje}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-indigo-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tipo de cliente</th>
                  <th className="px-4 py-3 font-semibold">Segmento</th>
                  <th className="px-4 py-3 font-semibold">Margen (%)</th>
                  <th className="px-4 py-3 font-semibold">Última actualización</th>
                  <th className="px-4 py-3 text-right font-semibold">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {cargando ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Cargando márgenes...
                    </td>
                  </tr>
                ) : (
                  margenes.map((margen) => (
                    <tr key={margen.id_tipo_cliente}>
                      <td className="px-4 py-4 font-medium text-slate-800">{margen.nombre}</td>
                      <td className="px-4 py-4 text-slate-600">{margen.segmento}</td>
                      <td className="px-4 py-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Margen de ${margen.nombre}`}
                          placeholder="Ej. 25.00"
                          value={valores[margen.segmento] ?? ''}
                          disabled={guardando !== ''}
                          onChange={(e) =>
                            setValores((anteriores) => ({ ...anteriores, [margen.segmento]: e.target.value }))
                          }
                          className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {margen.fecha_actualizacion
                          ? formatearFecha(margen.fecha_actualizacion)
                          : 'Sin configurar'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => void guardar(margen)}
                            disabled={guardando !== ''}
                            className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {guardando === margen.segmento ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}