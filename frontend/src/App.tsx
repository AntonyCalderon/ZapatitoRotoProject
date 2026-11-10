import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import CostoBase from './pages/CostoBase'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/registro" replace />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/inicio" element={<Home />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/costo-base" element={<CostoBase />} />
        </Route>
        <Route path="*" element={<Navigate to="/registro" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App