import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import ComprasRoute from './components/ComprasRoute'
import AdminLayout from './components/AdminLayout'
import { useAuthStore } from './store/authStore'

import MargenesPage from './pages/MargenesPage'
import PendientesDespachoPage from './pages/PendientesDespachoPage'

import Home from './pages/Home'
import Login from './pages/Login'
import CostoBasePage from './pages/CostoBasePage'
import ModelosPage from './pages/ModelosPage'
import TallasPage from './pages/TallasPage'
import ColoresPage from './pages/ColoresPage'
import ProductosSkuPage from './pages/ProductosSkuPage'
import AdminInicio from './pages/AdminInicio'
import CambiarPasswordPage from './pages/CambiarPasswordPage'
import UsuariosPage from './pages/UsuariosPage'
import ComprasBorradoresPage from './pages/ComprasBorradoresPage'
import ComprasEmitidasPage from './pages/ComprasEmitidasPage'
import ComprasHistoricoPage from './pages/ComprasHistoricoPage'
import CompraEditorPage from './pages/CompraEditorPage'
import PendientesRecepcionPage from './pages/PendientesRecepcionPage'
import RolRoute from './components/RolRoute'
import ExistenciasPage from './pages/ExistenciasPage'
import KardexDetallePage from './pages/KardexDetallePage'
import DisponibilidadVentaPage from './pages/DisponibilidadVentaPage'
import VentaClientePage from './pages/VentaClientePage'
import VentaPreciosPage from './pages/VentaPreciosPage'

export function InicioRoute() {
  const esAdministrador = useAuthStore((state) => state.user?.roles.includes('Administrador') ?? false)
  const esCompras = useAuthStore((state) => state.user?.roles.includes('Compras') ?? false)
  const esAlmacen = useAuthStore(s => s.user?.roles.includes('Almacen'))
  const esVentas = useAuthStore(s => s.user?.roles.includes('Ventas'))
  if (esAdministrador) return <AdminInicio />
  if (esCompras) return <Navigate to="/compras" replace />
  if (esAlmacen) return <Navigate to="/almacen" replace />
  if (esVentas) return <Navigate to="/ventas" replace />
  return <Home />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Al abrir el sistema, mostramos el login. */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Login único para los cuatro roles. */}
        <Route path="/login" element={<Login />} />

        {/* Todas estas páginas requieren una sesión activa. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
          <Route element={<AdminLayout />}>
            {/* Inicio específico para Administrador y para los demás roles. */}
            <Route path="/inicio" element={<InicioRoute />} />

            <Route element={<RolRoute rol="Almacen" />}>
              <Route path="/almacen/kardex" element={<ExistenciasPage />} />
              <Route path="/almacen/kardex/:skuId" element={<KardexDetallePage />} />
              <Route path="/almacen/pendientes-despacho/:idDespacho?" element={<PendientesDespachoPage />} />
            </Route>

            {/* HU02: productos y tallas dentro de un borrador, solo rol Compras. */}
            <Route element={<ComprasRoute />}>
              <Route path="/compras/borrador/:idOrden" element={<CompraEditorPage />} />
              <Route path="/compras/borrador/:idOrden/productos" element={<CompraEditorPage />} />
            </Route>

            <Route element={<RolRoute rol="Ventas" />}>
              <Route path="/ventas" element={<VentaClientePage />} />
              <Route path="/ventas/disponibilidad" element={<DisponibilidadVentaPage />} />
              <Route path="/ventas/borradores/:id/cliente" element={<VentaClientePage />} />
              <Route path="/ventas/precios/:idOrden?" element={<VentaPreciosPage />} />
            </Route>
            <Route element={<RolRoute rol="Almacen" />}>
              <Route path="/almacen" element={<PendientesRecepcionPage />} />
              <Route path="/almacen/pendientes/:id" element={<PendientesRecepcionPage />} />
            </Route>

            {/* Funcionalidades exclusivas del Administrador. */}
            <Route element={<AdminRoute />}>
              <Route path="/usuarios" element={<UsuariosPage />} />
              {/* HU22: márgenes de utilidad por tipo de cliente. */}
              <Route path="/margenes" element={<MargenesPage />} />
              {/* HU23: registro de costos base de Lima. */}
              <Route path="/costos-base" element={<CostoBasePage />} />

              {/* Gestión del catálogo de modelos. */}
              <Route path="/modelos" element={<ModelosPage />} />

              {/* Gestión del catálogo de tallas. */}
              <Route path="/tallas" element={<TallasPage />} />

              {/* Gestión del catálogo de colores. */}
              <Route path="/colores" element={<ColoresPage />} />

              {/* Gestión de variantes SKU. */}
              <Route path="/productos-sku" element={<ProductosSkuPage />} />
            </Route>

            {/* HU01: borradores de solicitud de compra, solo rol Compras. */}
            <Route element={<ComprasRoute />}>
              <Route path="/compras" element={<ComprasBorradoresPage />} />
              <Route path="/compras/emitidas" element={<ComprasEmitidasPage />} />
              <Route path="/compras/historico" element={<ComprasHistoricoPage />} />
              <Route path="/compras/historico/:idOrden" element={<ComprasHistoricoPage />} />
            </Route>
          </Route>
        </Route>

        {/* Si la dirección no existe, regresamos al login. */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
