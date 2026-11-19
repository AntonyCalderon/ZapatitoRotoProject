import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ModeloCombobox({ valor, opciones, cambiar, etiqueta, descripcion, disabled }: {
  valor: string; opciones: string[]; cambiar: (valor: string) => void; etiqueta: string; descripcion?: string; disabled?: boolean
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [buscar, setBuscar] = useState(false)
  const [activo, setActivo] = useState(0)
  const [posicion, setPosicion] = useState({ left: 0, top: 0, width: 240, maxHeight: 240 })
  const visibles = buscar ? opciones.filter(o => o.toLocaleLowerCase('es').includes(valor.trim().toLocaleLowerCase('es'))) : opciones
  useLayoutEffect(() => {
    if (!abierto) return
    const colocar = () => {
      const rect = input.current?.getBoundingClientRect()
      if (!rect) return
      const alto = Math.min(240, Math.max(48, visibles.length * 42 + 12))
      const debajo = window.innerHeight - rect.bottom - 12
      const arriba = debajo < alto && rect.top > debajo
      const maxHeight = Math.min(alto, Math.max(48, arriba ? rect.top - 12 : debajo))
      const width = Math.min(rect.width || 240, window.innerWidth - 16)
      setPosicion({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: arriba ? Math.max(8, rect.top - maxHeight - 5) : rect.bottom + 5, width, maxHeight })
    }
    colocar()
    window.addEventListener('resize', colocar)
    window.addEventListener('scroll', colocar, true)
    return () => { window.removeEventListener('resize', colocar); window.removeEventListener('scroll', colocar, true) }
  }, [abierto, visibles.length])
  const elegir = (opcion: string) => { cambiar(opcion); setAbierto(false); setBuscar(false) }
  return <div className="ops-model-field">
    <input ref={input} role="combobox" aria-label={etiqueta} aria-describedby={descripcion} aria-autocomplete="list" aria-expanded={abierto} aria-controls={abierto ? id : undefined} aria-activedescendant={abierto && visibles[activo] ? `${id}-${activo}` : undefined} autoComplete="off" value={valor} disabled={disabled} placeholder="Escribe o selecciona"
      onFocus={() => { setBuscar(false); setActivo(0); setAbierto(true) }}
      onBlur={() => setAbierto(false)}
      onChange={e => { cambiar(e.target.value); setBuscar(true); setActivo(0); setAbierto(true) }}
      onKeyDown={e => {
        if (e.key === 'Escape' && abierto) { e.preventDefault(); e.stopPropagation(); setAbierto(false) }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); setAbierto(true)
          setActivo(i => !abierto ? 0 : Math.max(0, Math.min(visibles.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
        }
        if (e.key === 'Enter' && abierto && visibles[activo]) { e.preventDefault(); elegir(visibles[activo]) }
        if (e.key === 'Tab') setAbierto(false)
      }} />
    <button type="button" className="ops-model-toggle" aria-label={`Mostrar opciones: ${etiqueta}`} tabIndex={-1} disabled={disabled} onPointerDown={e => e.preventDefault()} onClick={() => { input.current?.focus(); setBuscar(false); setActivo(0); setAbierto(!abierto) }}>⌄</button>
    {abierto && !disabled && createPortal(<div id={id} role="listbox" aria-label="Modelos disponibles" className="ops-model-menu" style={posicion} onPointerDown={e => e.preventDefault()}>
      {visibles.length ? visibles.map((opcion, index) => <div key={opcion} id={`${id}-${index}`} role="option" aria-selected={index === activo} className={index === activo ? 'is-active' : ''} onMouseEnter={() => setActivo(index)} onClick={() => elegir(opcion)}>{opcion}</div>) : <p>No hay coincidencias</p>}
    </div>, document.body)}
  </div>
}
