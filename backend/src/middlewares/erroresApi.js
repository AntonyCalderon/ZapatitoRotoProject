// Se instala después de todas las rutas /api, también después de express.json().
// Mantiene el formato esperado por los clientes incluso ante errores de Express.
export function instalarErroresApi(app) {
  app.use('/api', (req, res) => {
    res.status(404).json({ mensaje: 'La ruta solicitada no existe.' });
  });
  app.use('/api', (error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof URIError) {
      return res.status(400).json({ mensaje: 'La URL contiene una codificación inválida.' });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ mensaje: 'El cuerpo debe contener un objeto JSON válido.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ mensaje: 'El cuerpo de la solicitud supera el tamaño permitido.' });
    }
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
    return res.status(status).json({ mensaje: status === 500
      ? 'No se pudo procesar la solicitud.' : 'La solicitud no es válida.' });
  });
}
