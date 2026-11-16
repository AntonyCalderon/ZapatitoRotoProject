import { useEffect, useState } from 'react';

import {
  obtenerOpciones,
  consultarCosto,
  registrarCosto
} from '../services/costoBaseService';

import type {
  Modelo,
  Talla
} from '../services/costoBaseService';

/*
Al abrir la pantalla cargamos modelos y tallas.
Al seleccionar ambos consultamos el costo vigente.
Si no existe, el administrador puede registrar uno nuevo.
 */
export default function CostoBasePage() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [tallas, setTallas] = useState<Talla[]>([]);

  const [idModelo, setIdModelo] = useState('');
  const [idTalla, setIdTalla] = useState('');
  const [importe, setImporte] = useState('');

  const [costoActual, setCostoActual] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const seleccionCompleta = Boolean(idModelo && idTalla);

  // Apenas se abre el formulario, pedimos las opciones a Express.
  useEffect(() => {
    async function cargarFormulario() {
      try {
        const datos = await obtenerOpciones();
        setModelos(datos.modelos);
        setTallas(datos.tallas);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Error al cargar el formulario.'
        );
      } finally {
        setCargando(false);
      }
    }

    void cargarFormulario();
  }, []);

  // Cada vez que cambia el modelo o la talla, buscamos su costo.
  useEffect(() => {
    let vigente = true;

    setCostoActual(null);
    setImporte('');
    setMensaje('');
    setError('');

    if (!idModelo || !idTalla) {
      setConsultando(false);
      return;
    }

    setConsultando(true);

    async function buscarCosto() {
      try {
        const resultado = await consultarCosto(
          Number(idModelo),
          Number(idTalla)
        );

        if (vigente) {
          setCostoActual(resultado.costo_vigente);
        }
      } catch (err) {
        if (vigente) {
          setError(
            err instanceof Error ? err.message : 'Error al consultar el costo.'
          );
        }
      } finally {
        if (vigente) setConsultando(false);
      }
    }

    void buscarCosto();

    // Ignoramos una respuesta antigua si el usuario cambia la selección.
    return () => {
      vigente = false;
    };
  }, [idModelo, idTalla]);

  // Limpiamos el formulario sin modificar ningún dato de PostgreSQL.
  function cancelar() {
    setIdModelo('');
    setIdTalla('');
    setImporte('');
    setCostoActual(null);
    setMensaje('');
    setError('');
  }

  // Solo guardamos cuando la combinación todavía no tiene costo.
  async function guardarCosto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMensaje('');

    if (!seleccionCompleta || consultando || costoActual !== null) {
      return;
    }

    const monto = importe.trim();

    // Aceptamos importes positivos con máximo dos decimales.
    if (!/^\d+(?:\.\d{1,2})?$/.test(monto) || Number(monto) <= 0) {
      setError('Ingresa un costo mayor que cero, con máximo dos decimales.');
      return;
    }

    setGuardando(true);

    try {
      const resultado = await registrarCosto({
        id_modelo: Number(idModelo),
        id_talla: Number(idTalla),
        costo_vigente: Number(monto)
      });

      // El backend confirmó el INSERT. Mostramos el costo registrado.
      setCostoActual(resultado.costo.costo_vigente);
      setImporte('');
      setMensaje('Costo base registrado correctamente.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo registrar el costo.'
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-w-0">
      <div className="min-w-0">
        {/* Formulario de la HU23. */}
        <section className="max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  
          <header className="border-b border-slate-200 px-6 py-7 sm:px-10">
            <h2 className="text-xl font-bold text-slate-900">
              Registrar costo base
            </h2>
  
            <p className="mt-1 text-slate-600">
              Administración de costos de compra
            </p>
          </header>
  
          <form
            onSubmit={guardarCosto}
            className="space-y-6 px-6 py-8 sm:px-10"
          >
  
            {/* Seleccionamos el modelo de zapatilla. */}
            <div>
              <label
                htmlFor="modelo"
                className="mb-2 block font-semibold text-slate-800"
              >
                Modelo de zapatilla
              </label>
  
              <select
                id="modelo"
                value={idModelo}
                disabled={cargando || guardando}
                onChange={(e) => setIdModelo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
              >
                <option value="">Seleccionar modelo</option>
  
                {modelos.map((modelo) => (
                  <option
                    key={modelo.id_modelo}
                    value={modelo.id_modelo}
                  >
                    {modelo.nombre_modelo}
                  </option>
                ))}
              </select>
            </div>
  
            {/* Seleccionamos la talla del modelo. */}
            <div>
              <label
                htmlFor="talla"
                className="mb-2 block font-semibold text-slate-800"
              >
                Talla
              </label>
  
              <select
                id="talla"
                value={idTalla}
                disabled={cargando || guardando}
                onChange={(e) => setIdTalla(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
              >
                <option value="">Seleccionar talla</option>
  
                {tallas.map((talla) => (
                  <option
                    key={talla.id_talla}
                    value={talla.id_talla}
                  >
                    {Number(talla.numero_talla)}
                  </option>
                ))}
              </select>
            </div>
  
            {/* Mostramos automáticamente el costo vigente. */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-4">
              <span className="text-sm text-slate-600">
                Costo vigente registrado:
              </span>
  
              <strong className="text-indigo-800">
                {consultando
                  ? 'Consultando...'
                  : !seleccionCompleta
                    ? '—'
                    : costoActual !== null
                      ? `S/ ${costoActual}`
                      : error
                        ? 'No disponible'
                        : 'Sin costo registrado'}
              </strong>
            </div>
  
            {/* Registramos el costo cuando no existe uno previo. */}
            <div>
              <label
                htmlFor="importe"
                className="mb-2 block font-semibold text-slate-800"
              >
                Costo base de compra (S/)
              </label>
  
              <input
                id="importe"
                type="text"
                inputMode="decimal"
                placeholder="Ej. 70.00"
                value={importe}
                disabled={
                  !seleccionCompleta ||
                  consultando ||
                  costoActual !== null ||
                  guardando ||
                  cargando ||
                  Boolean(error)
                }
                onChange={(e) => setImporte(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
  
              <p className="mt-2 text-sm text-slate-500">
                El costo debe ser mayor que cero. El flete se registra por separado.
              </p>
  
              {costoActual !== null && (
                <p className="mt-2 text-sm text-amber-700">
                  Este modelo y talla ya tienen costo. Su actualización
                  corresponde a otra funcionalidad.
                </p>
              )}
            </div>
  
            {/* Mensajes de error y confirmación. */}
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
  
            {mensaje && (
              <p
                role="status"
                className="rounded-lg bg-green-50 p-3 text-sm text-green-800"
              >
                {mensaje}
              </p>
            )}
  
            {/* Acciones del formulario. */}
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelar}
                disabled={guardando}
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
  
              <button
                type="submit"
                disabled={
                  !seleccionCompleta ||
                  consultando ||
                  costoActual !== null ||
                  guardando ||
                  cargando ||
                  Boolean(error)
                }
                className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
              >
                {guardando ? 'Guardando...' : 'Guardar costo'}
              </button>
            </div>
  
          </form>
        </section>
      </div>
    </div>
  );
  }
