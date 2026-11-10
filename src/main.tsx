import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import App from './App'
import { applyStoredTheme } from './data/settingsRepository'

// Aplica el tema antes del primer render para evitar un destello claro.
applyStoredTheme()

// En desarrollo no registramos el service worker: interferiría con Vite y HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // La app sigue funcionando online aunque el navegador no permita el SW.
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
