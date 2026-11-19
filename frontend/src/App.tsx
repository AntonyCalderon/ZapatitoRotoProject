import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import ComprasRoute from './components/ComprasRoute'
import AdminLayout from './components/AdminLayout'
import { useAuthStore } from './store/authStore'

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
import SeleccionCompraPage from './pages/SeleccionCompraPage'

export function InicioRoute() {
  const esAdministrador = useAuthStore((state) => state.user?.roles.includes('Administrador') ?? false)
  return esAdministrador ? <AdminInicio /> : <Home />
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

            {/* HU02: productos y tallas dentro de un borrador, solo rol Compras. */}
            <Route element={<ComprasRoute />}>
              <Route path="/compras/borrador/:idOrden/productos" element={<SeleccionCompraPage />} />
            </Route>

            {/* Funcionalidades exclusivas del Administrador. */}
            <Route element={<AdminRoute />}>
              <Route path="/usuarios" element={<UsuariosPage />} />
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