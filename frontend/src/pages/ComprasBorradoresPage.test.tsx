import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {afterEach,expect,it,vi} from 'vitest'
import ComprasBorradoresPage from './ComprasBorradoresPage'

const orden={id_orden_compra:19,estado:'BORRADOR',id_proveedor:null,id_usuario_creador:1,creador:'Paolo',fecha_creacion:'2026-11-19T18:00:00Z',observacion:null}
const respuesta=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
function mostrar(cancelacion:()=>Promise<Response>=async()=>respuesta({mensaje:'Borrador #19 cancelado correctamente.',orden:{id_orden_compra:19,estado:'CANCELADO'}})){
  const peticion=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
    if(String(url)==='/api/ordenes-compra/emitidas')return respuesta([])
    if(String(url)==='/api/ordenes-compra?estado=BORRADOR')return respuesta({borradores:[orden,{...orden,id_orden_compra:18}]})
    if(String(url)==='/api/ordenes-compra/19/cancelacion'&&init?.method==='POST')return cancelacion()
    throw new Error('Petición inesperada: '+url)
  })
  vi.stubGlobal('fetch',peticion)
  render(<MemoryRouter><ComprasBorradoresPage/></MemoryRouter>)
  return peticion
}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
it('pide confirmación con el número y no llama a la API si el usuario desiste',async()=>{
  const confirmar=vi.spyOn(window,'confirm').mockReturnValue(false)
  const peticion=mostrar()
  fireEvent.click(await screen.findByRole('button',{name:'Cancelar borrador 19'}))
  expect(confirmar).toHaveBeenCalledWith(expect.stringContaining('#19'))
  expect(peticion.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  expect(screen.getByRole('link',{name:'Abrir borrador 19'})).toBeInTheDocument()
})
it('cancela mediante POST, retira solo la fila confirmada y muestra el mensaje',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true)
  const peticion=mostrar()
  fireEvent.click(await screen.findByRole('button',{name:'Cancelar borrador 19'}))
  expect(await screen.findByRole('status')).toHaveTextContent('Borrador #19 cancelado correctamente.')
  expect(peticion).toHaveBeenCalledWith('/api/ordenes-compra/19/cancelacion',{method:'POST',credentials:'include'})
  expect(screen.queryByRole('link',{name:'Abrir borrador 19'})).not.toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Abrir borrador 18'})).toBeInTheDocument()
  expect(screen.getByText('1 de 1 solicitudes')).toBeInTheDocument()
})
it('deshabilita la cancelación mientras se procesa y evita peticiones repetidas',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true)
  let completar!:(respuesta:Response)=>void
  const peticion=mostrar(()=>new Promise(resolve=>{completar=resolve}))
  const boton=await screen.findByRole('button',{name:'Cancelar borrador 19'})
  fireEvent.click(boton);fireEvent.click(boton)
  expect(boton).toBeDisabled()
  expect(screen.getByRole('button',{name:'Cancelar borrador 18'})).toBeDisabled()
  expect(peticion.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1)
  completar(respuesta({mensaje:'Cancelado.',orden:{id_orden_compra:19,estado:'CANCELADO'}}))
  await screen.findByRole('status')
})
for(const status of [409,500])it(`conserva la fila y permite actualizar la bandeja ante un error ${status}`,async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true)
  mostrar(async()=>respuesta({mensaje:status===409?'La orden ya fue emitida.':'No se pudo cancelar.'},status))
  fireEvent.click(await screen.findByRole('button',{name:'Cancelar borrador 19'}))
  expect(await screen.findByRole('alert')).toHaveTextContent(status===409?'La orden ya fue emitida.':'No se pudo cancelar.')
  expect(screen.getByRole('link',{name:'Abrir borrador 19'})).toBeInTheDocument()
  await waitFor(()=>expect(screen.getByRole('button',{name:'Cancelar borrador 19'})).toBeEnabled())
  expect(screen.getByRole('button',{name:'Actualizar bandeja'})).toBeInTheDocument()
})
