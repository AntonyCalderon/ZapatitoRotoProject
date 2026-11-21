/*
@file app.js
@description Punto de entrada del backend AyM Shafety.

Configura Express, registra las rutas HTTP e inicia el servidor.
*/

import express from 'express';
import { instalarErroresApi } from './middlewares/erroresApi.js';
import 'dotenv/config';

import margenRoutes from './modules/margenes/margen.routes.js';

import ordenCompraRoutes from './modules/ordenes-compra/ordenCompra.routes.js';

import costoBaseRoutes from './modules/costos-base/costoBase.routes.js';

import authRoutes from './modules/auth/auth.routes.js';
import usuarioRoutes from './modules/usuarios/usuario.routes.js';
import { sessionMiddleware } from './config/session.js';

// import para el seleccionar y agregar de modelos
import modeloRoutes from './modules/modelos/modelo.routes.js';
import tallaRoutes from './modules/tallas/talla.routes.js';
import colorRoutes from './modules/colores/color.routes.js';
import productoSkuRoutes from './modules/productos-sku/productoSku.routes.js';
import costoAdquisicionRoutes from './modules/compras/costoAdquisicion.routes.js';
import despachoRoutes from './modules/almacen/despacho.routes.js';


// HU02: selección de modelos, colores y tallas dentro de un borrador de compra.
import lineaCompraRoutes from './modules/lineas-compra/lineaCompra.routes.js';

const app = express();

// Permite interpretar solicitudes que contienen JSON.
app.use(express.json());

// para el inicio de sesion este pertenece a modulos perooooo especificamente a auth
// Primero habilitamos las sesiones.
app.use(sessionMiddleware);

// Después registramos las rutas de autenticación.
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);

// Registra las rutas del módulo de costos base.
app.use('/api/costos-base', costoBaseRoutes);


// API de márgenes de utilidad por tipo de cliente (Administrador).
app.use('/api/margenes', margenRoutes);

app.use('/api/compras', costoAdquisicionRoutes);
app.use('/api/almacen/pendientes-despacho', despachoRoutes);

// API de administración del catálogo de modelos.
app.use('/api/modelos', modeloRoutes);

// API administrativa del catálogo de tallas.
app.use('/api/tallas', tallaRoutes);

// API administrativa del catálogo de colores.
app.use('/api/colores', colorRoutes);

// API administrativa de variantes SKU.
app.use('/api/productos-sku', productoSkuRoutes);


// API de líneas de compra: productos y cantidades de un borrador (rol Compras).
app.use('/api/lineas-compra', lineaCompraRoutes);

// API de Compras: borradores de órdenes de compra.
app.use('/api/ordenes-compra', ordenCompraRoutes);

instalarErroresApi(app);

// Puerto donde escuchará el backend.
const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`Backend ejecutándose en http://localhost:${PORT}`);
});
