/*
Rutas HTTP del módulo de márgenes de utilidad (solo Administrador).
*/

import { Router } from 'express';
import {
  listarMargenesController,
  guardarMargenController
} from './margen.controller.js';
import { requerirAutenticacion, autorizarRoles } from '../../middlewares/autorizarRoles.js';

const router = Router();

// Protege todo el módulo: sesión activa y rol Administrador.
router.use(requerirAutenticacion, autorizarRoles('Administrador'));

router.get('/', listarMargenesController);
router.put('/:segmento', guardarMargenController);

export default router;