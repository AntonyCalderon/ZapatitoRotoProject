# ZapatitoRotoProject

#Con respecto al Package.Json
name: Identifica el paquete backend.
version:Versión actual del paquete.
private: true	Evita publicar accidentalmente este paquete en npm.
type: module	Indica a Node.js que utilice ES Modules (import/export).
scripts.start	Inicia el servidor Express mediante src/app.js.
scripts.test:db	Ejecuta únicamente la prueba de conexión PostgreSQL.
dependencies	Declara las bibliotecas externas necesarias.
dotenv	Carga las variables configuradas en .env.
express	Permite construir la API HTTP del backend.
pg	Permite ejecutar consultas SQL desde Node.js.

