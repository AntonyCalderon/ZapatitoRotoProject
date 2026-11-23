export function OpIcon({ name, className = '' }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    bolsa: 'M6 7h12l2 14H4L6 7ZM9 8V6a3 3 0 0 1 6 0v2',
    caja: 'm3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10M7.5 4.5l9 5',
    ventas: 'M3 4h2l2.5 12H19l2-9H6M9 20h.01M18 20h.01',
    salir: 'M9 4H4v16h5M14 8l4 4-4 4M8 12h10',
    mas: 'M12 5v14M5 12h14',
    buscar: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    documento: 'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h5',
    guardar: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',
    cerrar: 'm6 6 12 12M6 18 18 6',
    menu: 'M4 6h16M4 12h16M4 18h16',
    quitar: 'M4 7h16M9 7V3h6v4M6 7l1 14h10l1-14M10 11v6M14 11v6',
    reloj: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    check: 'm5 12 4 4L19 6'
  }
  return <svg className={`ops-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.documento} /></svg>
}
export function EstadoCompra({ estado }: { estado: string }) {
  return <span className={`ops-badge ${estado === 'BORRADOR' ? 'ops-badge-draft' : ''}`}>{estado === 'BORRADOR' ? 'Borrador' : estado === 'EMITIDA' ? 'Emitida' : estado === 'CERRADO' ? 'Cerrado' : 'Cancelado'}</span>
}
export const fechaCompra = (valor: string) => new Date(valor).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
export const soles = (valor: string | number | null | undefined) =>
  valor == null ? 'Pendiente' : moneda.format(valor as number | `${number}`)
