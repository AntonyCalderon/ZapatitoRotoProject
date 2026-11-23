import { QueryClient,QueryClientProvider } from '@tanstack/react-query'
import { cleanup,render,screen,waitFor,within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach,expect,it,vi } from 'vitest'
import App from '../App'
import { useAuthStore } from '../store/authStore'

const lineas=[{id_detalle_compra:101,id_sku:5,codigo_sku:'COL-MAR-39',modelo:'Colorado',color:'Marrón',talla:'39.0',cantidad:6},
 {id_detalle_compra:102,id_sku:2,codigo_sku:'THR-MAR-40',modelo:'Threshold',color:'Marrón',talla:'40.0',cantidad:7}]
const emitidas=[
 {id_orden_compra:28,codigo:'OC-2026-002',estado:'EMITIDA',proveedor:'Proveedor QA',situacion_logistica:'EN_TRANSITO',lote_verificado:false,id_recepcion:null,usuario_almacen:null,fecha_recepcion:null,usuario_confirma:null,fecha_confirmacion:null},
 {id_orden_compra:3,codigo:'OC-2026-001',estado:'EMITIDA',proveedor:'Proveedor QA',situacion_logistica:'RECIBIDA',lote_verificado:true,id_recepcion:1,usuario_almacen:'Yefri',fecha_recepcion:'2026-11-22T15:00:00Z',usuario_confirma:null,fecha_confirmacion:null},
]
function abrir(ruta='/almacen',rol='Almacen',fallo=false) {
 window.history.replaceState(null,'',ruta)
 let recibida=false,falla=fallo
 const ordenes=structuredClone(emitidas)
 const fetchMock=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url==='/api/auth/me')return Response.json({usuario:{id_usuario:7,nombre:'Yefri',correo:'qa@example.invalid',roles:[rol],debe_cambiar_password:false}})
  if(url==='/api/almacen/pendientes')return Response.json(recibida?[]:[{id_orden_compra:28,codigo:'OC-2026-002',proveedor:'Proveedor QA',pares:13,situacion_logistica:'EN_TRANSITO'}])
  if(url==='/api/almacen/pendientes/28')return Response.json({id_orden_compra:28,codigo:'OC-2026-002',proveedor:'Proveedor QA',situacion_logistica:'EN_TRANSITO',lineas})
  if(url==='/api/almacen/recepciones/28/confirmacion'){
   if(falla){falla=false;return Response.json({mensaje:'No se pudo procesar la recepción.'},{status:500})}
   recibida=true;return Response.json({mensaje:'Lote verificado y recibido por Almacén.',repetida:false,recepcion:{id_recepcion:2,codigo:'OC-2026-002',pares:13,usuario_almacen:'Yefri',fecha_recepcion:'2026-11-22T15:30:00Z',lote_verificado:true}},{status:201})
  }
  if(url==='/api/ordenes-compra?estado=BORRADOR')return Response.json({borradores:[]})
  if(url==='/api/ordenes-compra/emitidas')return Response.json(structuredClone(ordenes))
  if(url==='/api/ordenes-compra/3/confirmacion'){
   ordenes[1].usuario_confirma='Comprador QA';ordenes[1].fecha_confirmacion='2026-11-22T16:00:00Z'
   return Response.json({mensaje:'Confirmación comercial registrada.',orden:ordenes[1]})
  }
  throw new Error('Ruta no esperada: '+url)
 })
 vi.stubGlobal('fetch',fetchMock)
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><App/></QueryClientProvider>)
 return fetchMock
}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();useAuthStore.setState({user:null})})

it('abre la recepción con un botón separado y exige verificar cada SKU',async()=>{
 const usuario=userEvent.setup(),fetchMock=abrir();vi.spyOn(window,'confirm').mockReturnValue(true)
 expect(await screen.findByRole('rowheader',{name:'OC-2026-002'})).toBeInTheDocument()
 expect(screen.queryByRole('link',{name:'OC-2026-002'})).not.toBeInTheDocument()
 await usuario.click(screen.getByRole('link',{name:'Abrir recepción OC-2026-002'}))
 const boton=await screen.findByRole('button',{name:'Confirmar recepción completa'})
 expect(boton).toBeDisabled()
 await usuario.click(screen.getByRole('checkbox',{name:'Verificar SKU COL-MAR-39'}));expect(boton).toBeDisabled()
 await usuario.click(screen.getByRole('checkbox',{name:'Verificar SKU THR-MAR-40'}));expect(boton).toBeEnabled()
 await usuario.click(boton)
 expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('OC-2026-002: 13 pares'))
 const mensaje=await screen.findByRole('status');expect(mensaje).toHaveTextContent('Lote verificado y recibido por Almacén');expect(mensaje).toHaveTextContent('Yefri')
 const llamadas=fetchMock.mock.calls.filter(([,init])=>init?.method==='POST');expect(llamadas).toHaveLength(1)
 const [,init]=llamadas[0];expect(init?.credentials).toBe('include');expect((init?.headers as Record<string,string>)['Idempotency-Key']).toMatch(/^[\da-f-]{36}$/i)
 expect(JSON.parse(String(init?.body)).lineas).toEqual(lineas.map(l=>({id_detalle_compra:l.id_detalle_compra,cantidad_recibida:l.cantidad,verificado:true})))
 await usuario.click(screen.getByRole('link',{name:'Volver a pendientes'}))
 expect(await screen.findByText('No hay órdenes pendientes de recepción.')).toBeInTheDocument()
})

it('permite desistir y reintentar un error sin cambiar la clave ni duplicar la operación',async()=>{
 const usuario=userEvent.setup(),fetchMock=abrir('/almacen/pendientes/28','Almacen',true),confirmar=vi.spyOn(window,'confirm').mockReturnValue(false)
 await screen.findByRole('checkbox',{name:'Verificar SKU COL-MAR-39'})
 for(const l of lineas)await usuario.click(screen.getByRole('checkbox',{name:'Verificar SKU '+l.codigo_sku}))
 await usuario.click(screen.getByRole('button',{name:'Confirmar recepción completa'}))
 expect(fetchMock.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false)
 confirmar.mockReturnValue(true);await usuario.click(screen.getByRole('button',{name:'Confirmar recepción completa'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo procesar la recepción.')
 await usuario.click(screen.getByRole('button',{name:'Confirmar recepción completa'}));await screen.findByRole('status')
 const posts=fetchMock.mock.calls.filter(([,init])=>init?.method==='POST')
 expect(posts).toHaveLength(2);expect(posts[0][1]?.headers).toEqual(posts[1][1]?.headers)
})

it('Compras muestra el indicador y solo habilita confirmación comercial para el lote recibido',async()=>{
 const usuario=userEvent.setup(),fetchMock=abrir('/compras/emitidas','Compras');vi.spyOn(window,'confirm').mockReturnValue(true)
 const tabla=await screen.findByRole('table',{name:'Órdenes emitidas y recepción'})
 const pendiente=within(tabla).getByRole('row',{name:/OC-2026-002/}),recibida=within(tabla).getByRole('row',{name:/OC-2026-001/})
 expect(within(pendiente).getByText('En tránsito')).toBeInTheDocument()
 expect(within(pendiente).getByRole('button',{name:'Confirmar comercialmente OC-2026-002'})).toBeDisabled()
 expect(within(recibida).getByText(/Lote verificado y recibido por Almacén/)).toBeInTheDocument()
 expect(within(recibida).getByText(/Yefri/)).toBeInTheDocument()
 await usuario.click(within(recibida).getByRole('button',{name:'Confirmar comercialmente OC-2026-001'}))
 await waitFor(()=>expect(within(tabla).getByText('Confirmada')).toBeInTheDocument())
 expect(fetchMock.mock.calls.filter(([,init])=>init?.method==='POST').map(([url])=>url)).toEqual(['/api/ordenes-compra/3/confirmacion'])
 expect(within(tabla).getByText(/Comprador QA/)).toBeInTheDocument()
})
