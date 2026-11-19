import { useId, useState } from 'react'
import FormField from './FormField'

interface CampoCostoFaltanteProps {
  idSku: number
  actualizarResumen: () => Promise<void>
}

async function guardarCostoFaltante(idSku: number, costoUnitario: string) {
  const respuesta = await fetch(`/api/compras/costos-faltantes/${idSku}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ costoUnitario }),
  })

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null)
    throw new Error(datos?.mensaje || 'No se pudo registrar el costo.')
  }
}

export default function CampoCostoFaltante({ idSku, actualizarResumen }: CampoCostoFaltanteProps) {
  const idCampo = useId()
  const [importe, setImporte] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const textoBoton = guardado ? 'Actualizar resumen' : 'Guardar costo'
  const textoEnCurso = guardado ? 'Actualizando…' : 'Guardando…'

  async function guardarYActualizar() {
    if (ocupado) return
    setOcupado(true)
    setError('')

    try {
      if (!guardado) {
        const monto = importe.trim().replace(',', '.')
        if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(monto) || Number(monto) <= 0) {
          throw new Error('Ingresa un importe mayor a cero con hasta dos decimales.')
        }

        await guardarCostoFaltante(idSku, monto)
        setGuardado(true)
      }

      try {
        await actualizarResumen()
      } catch {
        setError('El costo ya se guardó. Vuelve a actualizar el resumen.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo registrar el costo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="ml-auto max-w-64 min-w-48 space-y-2 text-left whitespace-normal">
      {guardado ? (
        error && <p role="alert" className="text-sm text-rose-600">{error}</p>
      ) : (
        <FormField
          id={idCampo}
          label={`Costo en soles para el SKU ${idSku}`}
          inputMode="decimal"
          value={importe}
          error={error}
          disabled={ocupado}
          onChange={(event) => setImporte(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void guardarYActualizar()
            }
          }}
        />
      )}
      <button
        type="button"
        disabled={ocupado}
        onClick={() => void guardarYActualizar()}
        className="rounded-lg bg-cat px-3 py-2 text-sm font-semibold text-black hover:bg-cat-dark disabled:opacity-60"
      >
        {ocupado ? textoEnCurso : textoBoton}
      </button>
    </div>
  )
}
