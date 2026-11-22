import type { SituacionStock } from '../services/inventarioService'

const etiquetas: Record<SituacionStock, string> = {
  disponible: 'Disponible', stock_bajo: 'Stock bajo', agotado: 'Agotado', sin_minimo: 'Sin mínimo definido',
}
export function SituacionInventario({ situacion }: { situacion: SituacionStock }) {
  return <span className={`inv-badge inv-status-${situacion}`}><span aria-hidden="true">●</span>{etiquetas[situacion]}</span>
}
export function CatalogoInventarioBadge({ activo }: { activo: boolean }) {
  return <span className={`inv-badge ${activo ? 'inv-catalog-active' : 'inv-catalog-inactive'}`}>{activo ? 'Activo' : 'Inactivo'}</span>
}
export function ErrorInventario({ error, reintentar }: { error: Error; reintentar: () => void }) {
  return <div className="ops-alert ops-alert-error" role="alert">{error.message}<button type="button" className="ops-text-button" onClick={reintentar}>Reintentar</button></div>
}
export function paginaInventario(valor: string | null) {
  const n = Number(valor)
  return Number.isInteger(n) && n >= 1 && n <= 2147483647 ? n : 1
}
export function PaginacionInventario({ pagina, tamano, total, ocupado, cambiar, unidad = 'productos' }: {
  pagina: number; tamano: number; total: number; ocupado: boolean; cambiar: (pagina: number) => void; unidad?: string
}) {
  const paginas = Math.max(1, Math.ceil(total / tamano))
  const inicio = total && (pagina - 1) * tamano < total ? (pagina - 1) * tamano + 1 : 0
  return <footer className="inv-pagination">
    <span>{total ? `Mostrando ${inicio} a ${inicio ? Math.min(pagina * tamano, total) : 0} de ${total} ${unidad}` : `0 ${unidad}`}</span>
    <nav aria-label={`Paginación de ${unidad}`}>
      <button type="button" disabled={ocupado || pagina <= 1} onClick={() => cambiar(pagina - 1)}>Anterior</button>
      <span aria-live="polite">Página {pagina} de {paginas}</span>
      <button type="button" disabled={ocupado || pagina >= paginas} onClick={() => cambiar(pagina + 1)}>Siguiente</button>
    </nav>
  </footer>
}
