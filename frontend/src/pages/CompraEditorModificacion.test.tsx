import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter,Route,Routes} from 'react-router-dom'
import {afterEach,expect,it,vi} from 'vitest'
import CompraEditorPage from './CompraEditorPage'

const originales=[
  {id_detalle_compra:101,id_sku:1,codigo_sku:'TH-NEG-40',nombre_modelo:'Threshold',nombre_color:'Negro',numero_talla:'40.0',cantidad:4},
  {id_detalle_compra:102,id_sku:2,codigo_sku:'TH-HON-41',nombre_modelo:'Threshold',nombre_color:'Honey',numero_talla:'41.0',cantidad:2}
]
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
function mostrar({fallaSegunda=false,estado='BORRADOR'}={}){
  let lineas=originales.map(l=>({...l})),fallo=fallaSegunda
  const peticion=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(url)
    if (path === '/api/ordenes-compra/proveedores') return json([])
    if(path==='/api/ordenes-compra/7')return json({orden:{id_orden_compra:7,estado,id_usuario_creador:1,creador:'Paolo',fecha_creacion:'2026-11-19T18:00:00Z',observacion:null,id_proveedor:null,total:null}})
    if(path==='/api/ordenes-compra/7/detalles')return json({estado,lineas})
    if(path.startsWith('/api/ordenes-compra/7/detalles/')){
      const id=Number(path.split('/').at(-1))
      if(fallo&&id===102){fallo=false;return json({mensaje:'Error temporal.'},500)}
      if(init?.method==='DELETE')lineas=lineas.filter(l=>l.id_detalle_compra!==id)
      else{const datos=JSON.parse(String(init?.body));lineas=lineas.map(l=>l.id_detalle_compra===id?{...l,cantidad:datos.cantidad}:l)}
      return json({lineas,total_pares:lineas.reduce((s,l)=>s+l.cantidad,0),pares_por_modelo:[]})
    }
    if(path==='/api/compras/ordenes/7/resumen-costos'){
      const {lineas:pedidas}=JSON.parse(String(init?.body)) as {lineas:{id_sku:number;cantidad:number}[]}
      const subtotal=pedidas.reduce((s,l)=>s+l.cantidad*200,0)
      return json({lineas:pedidas.map(l=>({idSku:l.id_sku,cantidad:l.cantidad,costoUnitario:'200.00',importe:(l.cantidad*200).toFixed(2)})),subtotalConocido:subtotal.toFixed(2),igv:(subtotal*.18).toFixed(2),total:(subtotal*1.18).toFixed(2)})
    }
    throw Error('Ruta inesperada '+path)
  })
  vi.stubGlobal('fetch',peticion)
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/compras/borrador/7']}><Routes><Route path="/compras/borrador/:idOrden" element={<CompraEditorPage/>}/></Routes></MemoryRouter></QueryClientProvider>)
  return peticion
}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
it('habilita edición, guarda con PATCH y recalcula el resumen con IGV',async()=>{
  const p=mostrar();fireEvent.click(await screen.findByRole('button',{name:'Modificar borrador'}))
  fireEvent.change(screen.getByLabelText('Cantidad de Threshold, talla 40, Negro'),{target:{value:'7'}})
  await waitFor(()=>expect(screen.getByText('Total de adquisición').nextElementSibling).toHaveTextContent('2,124.00'))
  fireEvent.click(screen.getByRole('button',{name:'Guardar borrador'}));await screen.findByText('Borrador guardado correctamente.')
  expect(p).toHaveBeenCalledWith('/api/ordenes-compra/7/detalles/101',expect.objectContaining({method:'PATCH',body:JSON.stringify({cantidad:7,cantidad_anterior:4})}))
  expect(screen.getByRole('button',{name:'Guardar borrador'})).toBeDisabled()
})
it('confirma quitar y llama DELETE únicamente cuando se guarda',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true);const p=mostrar();fireEvent.click(await screen.findByRole('button',{name:'Modificar borrador'}))
  fireEvent.click(screen.getByRole('button',{name:'Quitar Threshold, talla 40, Negro'}))
  expect(p.mock.calls.some(([,init])=>init?.method==='DELETE')).toBe(false)
  fireEvent.click(screen.getByRole('button',{name:'Guardar borrador'}));await screen.findByText('Borrador guardado correctamente.')
  expect(p).toHaveBeenCalledWith('/api/ordenes-compra/7/detalles/101',{method:'DELETE',credentials:'include'})
  expect(screen.getByText('TH-HON-41')).toBeInTheDocument();expect(screen.queryByText('TH-NEG-40')).not.toBeInTheDocument()
})
it('permite deshacer eliminaciones y rechaza cantidades vacías o cero',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true);mostrar();fireEvent.click(await screen.findByRole('button',{name:'Modificar borrador'}))
  const campo=screen.getByLabelText('Cantidad de Threshold, talla 40, Negro')
  fireEvent.change(campo,{target:{value:''}});expect(screen.getByRole('button',{name:'Guardar borrador'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Deshacer cambios de productos'}));expect(campo).toHaveValue(4)
  fireEvent.click(screen.getByRole('button',{name:'Quitar Threshold, talla 40, Negro'}));fireEvent.click(screen.getByRole('button',{name:'Deshacer cambios de productos'}))
  expect(screen.getByText('TH-NEG-40')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Guardar borrador'})).toBeDisabled()
})
it('un reintento no repite las modificaciones ya confirmadas',async()=>{
  const p=mostrar({fallaSegunda:true});fireEvent.click(await screen.findByRole('button',{name:'Modificar borrador'}))
  fireEvent.change(screen.getByLabelText('Cantidad de Threshold, talla 40, Negro'),{target:{value:'7'}})
  fireEvent.change(screen.getByLabelText('Cantidad de Threshold, talla 41, Honey'),{target:{value:'3'}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar borrador'}));expect(await screen.findByRole('alert')).toHaveTextContent('Algunos cambios')
  fireEvent.click(screen.getByRole('button',{name:'Guardar borrador'}));await screen.findByText('Borrador guardado correctamente.')
  expect(p.mock.calls.filter(([u,i])=>String(u).endsWith('/101')&&i?.method==='PATCH')).toHaveLength(1)
  expect(p.mock.calls.filter(([u,i])=>String(u).endsWith('/102')&&i?.method==='PATCH')).toHaveLength(2)
})
for(const estado of ['EMITIDA','CANCELADO'])it(`no muestra acciones de modificación para ${estado}`,async()=>{
  mostrar({estado});await screen.findByText('Datos de la solicitud');expect(screen.queryByRole('button',{name:'Modificar borrador'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Guardar borrador'})).not.toBeInTheDocument()
})
