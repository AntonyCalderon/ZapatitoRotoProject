import { Router } from 'express';
import {
  login,
  obtenerSesion,
  logout,
  cambiarPasswordController
} from './auth.controller.js';
import { autenticarSesion } from '../../middlewares/autorizarRoles.js';

const router = Router();

// El formulario enviará aquí las credenciales.
router.post('/login', login);

// Consulta la sesión actual.
router.get('/me', obtenerSesion);
router.post('/cambiar-password', autenticarSesion, cambiarPasswordController);

// Cierra la sesión del trabajador.
router.post('/logout', logout);

export default router;
