import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ProvedorDemo } from './app/DemoContexto'
import './estilos.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProvedorDemo>
      <App />
    </ProvedorDemo>
  </StrictMode>,
)
