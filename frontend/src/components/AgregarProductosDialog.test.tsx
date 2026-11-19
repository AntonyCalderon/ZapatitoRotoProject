import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import AgregarProductosDialog from './AgregarProductosDialog'
import type { CatalogoCompra } from '../services/lineaCompraService'

const catalogo: CatalogoCompra = {
  modelos: [{ id_modelo: 1, nombre_modelo: 'Threshold' }, { id_modelo: 2, nombre_modelo: 'Colorado' }],
  tallas: [{ id_talla: 1, numero_talla: '40.0' }, { id_talla: 2, numero_talla: '41.0' }],
  colores: [{ id_color: 1, nombre_color: 'Negro' }, { id_color: 2, nombre_color: 'Honey' }],
  variantes: [
    {id_sku:1,codigo_sku:'TH-NEG-40',id_modelo:1,nombre_modelo:'Threshold',id_color:1,nombre_color:'Negro',id_talla:1,numero_talla:'40.0',costo_base_vigente:'200.00'},
    {id_sku:2,codigo_sku:'TH-HON-40',id_modelo:1,nombre_modelo:'Threshold',id_color:2,nombre_color:'Honey',id_talla:1,numero_talla:'40.0',costo_base_vigente:'200.00'},
    {id_sku:3,codigo_sku:'COL-NEG-41',id_modelo:2,nombre_modelo:'Colorado',id_color:1,nombre_color:'Negro',id_talla:2,numero_talla:'41.0',costo_base_vigente:null}
  ]
}
function mostrar(data: CatalogoCompra = catalogo) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(data), { status:200,headers:{'Content-Type':'application/json'} }))
  vi.stubGlobal('fetch',fetchMock)
  const agregar = vi.fn(), cerrar = vi.fn()
  render(<AgregarProductosDialog cerrar={cerrar} agregar={agregar} />)
  return { agregar, cerrar, fetchMock }
}
async function listo() { await screen.findByRole('option',{name:'Negro'}) }
function llenar(index=1,modelo='Threshold',talla='1',color='1',cantidad='3') {
  fireEvent.change(screen.getByLabelText(`Color de la fila ${index}`),{target:{value:color}})
  fireEvent.change(screen.getByLabelText(`Talla de la fila ${index}`),{target:{value:talla}})
  fireEvent.change(screen.getByLabelText(`Modelo de la fila ${index}`),{target:{value:modelo}})
  fireEvent.change(screen.getByLabelText(`Cantidad de la fila ${index}`),{target:{value:cantidad}})
}
afterEach(()=>{cleanup();vi.unstubAllGlobals()})

it('permite elegir color y talla antes del modelo y muestra el costo sin pedir color',async()=>{
  const {fetchMock}=mostrar();await listo()
  expect(screen.getByLabelText('Color de la fila 1')).toBeEnabled()
  expect(screen.getByLabelText('Talla de la fila 1')).toBeEnabled()
  fireEvent.change(screen.getByLabelText('Talla de la fila 1'),{target:{value:'1'}})
  fireEvent.change(screen.getByLabelText('Modelo de la fila 1'),{target:{value:'Threshold'}})
  expect(screen.getByText(/200\.00/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Color de la fila 1'),{target:{value:'2'}})
  expect(screen.getByText(/200\.00/)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith('/api/lineas-compra/catalogo',{credentials:'include'})
})
it('agrega varias filas y omite las vacías; no envía el costo consultado como costo de la orden',async()=>{
  const {agregar,cerrar}=mostrar();await listo();llenar()
  fireEvent.click(screen.getByRole('button',{name:'Agregar otra fila'}));llenar(2,'Colorado','2','1','5')
  expect(screen.getByText('Sin costo registrado')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Agregar otra fila'}))
  fireEvent.click(screen.getByRole('button',{name:'Agregar a la solicitud'}))
  expect(agregar).toHaveBeenCalledWith([
    {id_sku:1,codigo_sku:'TH-NEG-40',nombre_modelo:'Threshold',nombre_color:'Negro',numero_talla:'40.0',cantidad:3},
    {id_sku:3,codigo_sku:'COL-NEG-41',nombre_modelo:'Colorado',nombre_color:'Negro',numero_talla:'41.0',cantidad:5}
  ])
  expect(cerrar).toHaveBeenCalledOnce()
})
it('no inventa SKU y conserva las selecciones independientes al cambiar modelo',async()=>{
  mostrar();await listo();llenar(1,'Colorado','1','2')
  expect(screen.getByRole('alert')).toHaveTextContent('no tiene un SKU disponible')
  expect(screen.getByLabelText('Color de la fila 1')).toHaveValue('2')
  expect(screen.getByLabelText('Talla de la fila 1')).toHaveValue('1')
  expect(screen.getByRole('button',{name:'Agregar a la solicitud'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Modelo de la fila 1'),{target:{value:'Threshold'}})
  expect(screen.getByRole('button',{name:'Agregar a la solicitud'})).toBeEnabled()
})
it('rechaza cantidades inválidas y modelos escritos que no existen',async()=>{
  mostrar();await listo();llenar(1,'No existe','1','1','2')
  expect(screen.getByRole('alert')).toHaveTextContent('modelo del catálogo')
  for(const cantidad of ['0','-1','1.5','100001']) {
    llenar(1,'Threshold','1','1',cantidad)
    expect(screen.getByRole('button',{name:'Agregar a la solicitud'})).toBeDisabled()
  }
})
it('permite quitar una fila incompleta sin bloquear las otras líneas válidas',async()=>{
  mostrar();await listo();llenar()
  fireEvent.click(screen.getByRole('button',{name:'Agregar otra fila'}))
  fireEvent.change(screen.getByLabelText('Color de la fila 2'),{target:{value:'1'}})
  expect(screen.getByRole('button',{name:'Agregar a la solicitud'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Quitar fila 2'}))
  expect(screen.getByRole('button',{name:'Agregar a la solicitud'})).toBeEnabled()
})
it('muestra el fallo de consulta y permite reintentar sin tratarlo como catálogo vacío',async()=>{
  let falla=true
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(falla?{mensaje:'No se pudo consultar.'}:catalogo),{status:falla?500:200})))
  render(<AgregarProductosDialog cerrar={()=>{}} agregar={()=>undefined} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar.')
  expect(screen.getByRole('button',{name:'Agregar a la solicitud'})).toBeDisabled()
  falla=false;fireEvent.click(screen.getByRole('button',{name:'Reintentar consulta'}));await listo()
  expect(screen.getByLabelText('Color de la fila 1')).toBeEnabled()
})
