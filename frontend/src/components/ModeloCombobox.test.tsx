import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import ModeloCombobox from './ModeloCombobox'
afterEach(cleanup)
it('abre el menú propio, permite seleccionar y lo cierra con Escape sin cerrar el diálogo',()=>{
  const cambiar=vi.fn(),escape=vi.fn()
  render(<div onKeyDown={escape}><ModeloCombobox etiqueta="Modelo" valor="" opciones={['Colorado','Threshold']} cambiar={cambiar} /></div>)
  const campo=screen.getByRole('combobox')
  fireEvent.focus(campo)
  expect(screen.getByRole('listbox')).toBeInTheDocument()
  expect(campo).not.toHaveAttribute('list')
  fireEvent.click(screen.getByRole('option',{name:'Colorado'}))
  expect(cambiar).toHaveBeenCalledWith('Colorado')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  fireEvent.focus(campo);fireEvent.keyDown(campo,{key:'Escape'})
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(escape).not.toHaveBeenCalled()
})
it('filtra por texto y permite elegir con teclado',()=>{
  const cambiar=vi.fn()
  render(<ModeloCombobox etiqueta="Modelo" valor="th" opciones={['Colorado','Threshold']} cambiar={cambiar} />)
  const campo=screen.getByRole('combobox')
  fireEvent.change(campo,{target:{value:'thr'}})
  expect(screen.getAllByRole('option')).toHaveLength(1)
  fireEvent.keyDown(campo,{key:'Enter'})
  expect(cambiar).toHaveBeenLastCalledWith('Threshold')
})
