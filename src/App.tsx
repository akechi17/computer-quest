import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { AppRouter } from '@/app/router/AppRouter'

/**
 * Application shell (spec §6).
 *
 * `AppProviders` sits above the router so settings apply everywhere, including
 * to the title screen and the loading screen.
 */
export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  )
}

export default App
