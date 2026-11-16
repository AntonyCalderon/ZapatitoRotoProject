import { useEffect, useState } from 'react'
import { obtenerModelos } from '../services/modeloService'
import { obtenerProductosSku } from '../services/productoSkuService'

export default function AdminInicio() {
  const [resumen, setResumen] = useState<{ modelos: number; productos: number } | null>(null)
  const [error, setError] = useState('')

  // Los indicadores cuentan registros reales de las API administrativas.
  useEffect(() => {
    let vigente = true
    void Promise.all([obtenerModelos(), obtenerProductosSku()])
      .then(([modelos, productos]) => {
        if (vigente) setResumen({ modelos: modelos.length, productos: productos.length })
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.')
      })
    return () => { vigente = false }
  }, [])

  return (
    <div className="space-y-[15px]">
      <section className="rounded-[17px] border border-[#E8E8EA] bg-white px-[15px] py-[17px]">
        <div className="flex items-center gap-[11px] text-[15px] font-medium text-[#292A2D]">
          <svg className="h-[19px] w-[19px] text-[#008D50]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Sesión activa
        </div>
        <p className="mt-[8px] text-[13px] text-[#737478]">Administrador</p>
      </section>

      <section className="rounded-[17px] border border-[#E8E8EA] bg-white px-[15px] pb-[15px] pt-[16px]">
        <h2 className="text-[16px] font-semibold text-[#292A2D]">Resumen del catálogo</h2>
        <div className="mt-[9px] grid gap-[10px] sm:grid-cols-2">
          <div className="min-h-[77px] rounded-[11px] bg-[#F5F5F6] px-[10px] py-[10px]">
            <p className="text-[13px] text-[#737478]">Modelos</p>
            <p className="mt-[12px] text-[25px] font-semibold leading-6 text-[#292A2D]">{resumen?.modelos ?? '—'}</p>
          </div>
          <div className="min-h-[77px] rounded-[11px] bg-[#F5F5F6] px-[10px] py-[10px]">
            <p className="text-[13px] text-[#737478]">Productos SKU</p>
            <p className="mt-[12px] text-[25px] font-semibold leading-6 text-[#292A2D]">{resumen?.productos ?? '—'}</p>
          </div>
        </div>
        <p className={`mt-[9px] text-[12px] ${error ? 'text-rose-700' : 'text-[#737478]'}`} role={error ? 'alert' : 'status'}>
          {error || (resumen ? 'Los valores se cargaron desde PostgreSQL.' : 'Cargando valores desde PostgreSQL...')}
        </p>
      </section>

      <section className="rounded-[17px] border border-[#E8E8EA] bg-white px-[15px] py-[17px]">
        <div className="flex items-center gap-[11px]">
          <svg className="h-[19px] w-[19px] text-[#777A7E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 9 7 5h10l3 4M4 9h16M4 13h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <h2 className="text-[16px] font-semibold text-[#292A2D]">Área de trabajo</h2>
        </div>
        <p className="mt-[11px] text-[14px] text-[#737478]">Aquí se mostrarán los formularios y tablas del módulo seleccionado.</p>
      </section>
    </div>
  )
}
