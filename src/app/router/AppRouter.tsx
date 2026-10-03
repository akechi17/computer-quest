import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { TitleScreen } from '@/components/menus/TitleScreen'
import { GameRoute } from '@/app/routes/GameRoute'
import { useSessionStore } from '@/stores/sessionStore'

/**
 * Routing (spec §6). Two routes only, and deliberately so: the game is a
 * single canvas that owns its own internal state, not a set of pages. The
 * router's job here is to make "leave the game and come back" a real
 * navigation, so the canvas unmounts cleanly instead of being hidden.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={<TitleScreen />}
      />
      <Route
        path="/game"
        element={
          <RequireSession>
            <GameRoute />
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/**
 * Guards the game route: a deep link straight to `/game` with no session
 * should not drop the player into a canvas with nothing behind it.
 */
function RequireSession({ children }: { children: ReactNode }) {
  const started = useSessionStore((s) => s.started)
  if (!started) return <Navigate to="/" replace />
  return <>{children}</>
}
