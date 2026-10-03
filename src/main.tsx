import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

/**
 * StrictMode is kept in development deliberately: the double-invoked effects
 * are what caught the duplicate quest-event subscriptions during development,
 * and the game must stay correct under them.
 */
const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element #root is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
