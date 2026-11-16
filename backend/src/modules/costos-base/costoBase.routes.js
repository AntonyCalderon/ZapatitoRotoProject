
/*
ESTA RUTA ES PARA LA PRIMERA API
Descripcion: Define las rutas HTTP del módulo costos base.
Responsabilidad: Relacionar un método HTTP y una dirección URL con la función del controlador correspondiente.
 */

import { Router } from 'express';
import { obtenerOpciones, //primer controler
        obtenerCostoBase, // segundo controler, para mas detalle revisar controller.
        guardarCostoBase // tercer controller.

} from './costoBase.controller.js';

import { // esto es para las autorizaciones
        requerirAutenticacion,
        autorizarRoles
      } from '../../middlewares/autorizarRoles.js';

// Creamos un enrutador de Express.
const router = Router();

// Antes de utilizar cualquier ruta de este módulo,
// comprobamos que sea un Administrador autenticado.
router.use(
        requerirAutenticacion,
        autorizarRoles('Administrador')
      ); // Como está antes de los tres endpoints, protege todo el módulo.



/*
1. ESTA RUTA ES PARA LA PRIMERA API. Obtiene los modelos y tallas disponibles para el formulario de registro de costos base.
*/
router.get('/opciones', obtenerOpciones); 
//Significa que cuando llega una petición GET a /opciones, Express debe ejecutar la función obtenerOpciones() del Controller.


// 2. sigue la segunda ruta para la segunda API
router.get('/', obtenerCostoBase);


// 3. l presionar Guardar costo, registramos el nuevo importe.
router.post('/', guardarCostoBase);

export default router;


