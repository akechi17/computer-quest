/**
 * Verifies the player actually stands on the ground and can walk.
 *
 * This exists because the physics failure it catches is invisible to every
 * other check: with no collider under the player the scene still renders
 * perfectly, the smoke test still passes, and the only symptom is a character
 * that quietly sinks through the floor — "drowned on empty space".
 *
 * It drives real Chrome, waits for the world to settle, then reads the
 * player's Y position and attempts to walk forward, asserting that the
 * character neither falls nor stays pinned.
 *
 * Usage: start `npm run preview`, then `node scripts/test-movement.mjs`
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_UNDER_TEST = process.argv[2] ?? 'http://localhost:4173/'
const CHROME =
  process.env.CHROME_PATH ??
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9223

/** The player's capsule centre when standing, from PLAYER constants. */
const STANDING_Y = 0.6 + 0.35 + 0.05 // ≈ 1.0
/** Below this the character has fallen through the world. */
const FALLEN_Y = -1.5
/** The village is bounded at ±45; beyond that the player escaped. */
const OUT_OF_BOUNDS = 60

const IGNORE = [
  /swiftshader/i,
  /GroupMarkerNotSet/i,
  /software WebGL/i,
  /favicon/i,
  /DevTools/i,
  /THREE\.Clock/,
  /deprecated parameters/,
]

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}/cq-move-${Date.now()}`,
    '--window-size=1280,800',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const problems = []

async function waitForChrome() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await response.json()
      const page = targets.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // not up yet
    }
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging target in time')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.addEventListener('open', () => resolve(socket))
    socket.addEventListener('error', reject)
  })
}

let nextId = 1
function send(socket, method, params = {}) {
  const id = nextId++
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.id === id) {
        socket.removeEventListener('message', onMessage)
        resolve(message.result)
      }
    }
    socket.addEventListener('message', onMessage)
  })
}

async function evaluate(socket, expression) {
  const result = await send(socket, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result?.exceptionDetails) {
    throw new Error(
      `page threw: ${result.exceptionDetails.exception?.description ?? 'unknown'}`,
    )
  }
  return result?.result?.value
}

function forwardKey(socket, type, code, key, keyCode) {
  return send(socket, 'Input.dispatchKeyEvent', {
    type,
    code,
    key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  })
}

try {
  const socket = await connect(await waitForChrome())

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') {
      const text =
        message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text ??
        'unknown'
      if (!IGNORE.some((pattern) => pattern.test(text))) problems.push(text)
    }
  })

  await send(socket, 'Runtime.enable')
  await send(socket, 'Page.enable')
  await send(socket, 'Page.navigate', { url: URL_UNDER_TEST })
  await sleep(3500)

  await evaluate(
    socket,
    `[...document.querySelectorAll('button')]
       .find((b) => /new game/i.test(b.textContent ?? ''))?.click()`,
  )

  /* Let physics settle: spawn, fall to the floor, come to rest. */
  await sleep(6000)

  /* The scene writes its state onto the canvas element for testability. */
  const probe = `(() => {
    const c = document.querySelector('canvas')
    if (!c) return null
    const r = c.__cq ?? null
    return r ? r() : null
  })()`

  let state = await evaluate(socket, probe)
  if (!state) {
    problems.push(
      'no test probe on the canvas — expected canvas.__cq() from GameCanvas',
    )
  } else {
    console.log(`  spawn position: x=${state.x.toFixed(2)} y=${state.y.toFixed(2)} z=${state.z.toFixed(2)}`)

    if (state.y < FALLEN_Y) {
      problems.push(
        `player fell through the world: y=${state.y.toFixed(2)} (expected ~${STANDING_Y})`,
      )
    }

    /* Now walk forward and confirm the position actually changes. */
    const before = state
    await forwardKey(socket, 'keyDown', 'KeyW', 'w', 87)
    await sleep(1800)
    await forwardKey(socket, 'keyUp', 'KeyW', 'w', 87)
    await sleep(300)

    const after = await evaluate(socket, probe)
    const moved = Math.hypot(after.x - before.x, after.z - before.z)
    console.log(`  moved forward: ${moved.toFixed(2)} units`)
    console.log(`  settled y: ${after.y.toFixed(2)}`)

    if (moved < 1.0) {
      problems.push(
        `holding W moved the player only ${moved.toFixed(2)} units — expected >1`,
      )
    }
    if (after.y < FALLEN_Y) {
      problems.push(`player fell while walking: y=${after.y.toFixed(2)}`)
    }
    if (Math.abs(after.x) > OUT_OF_BOUNDS || Math.abs(after.z) > OUT_OF_BOUNDS) {
      problems.push(
        `player left the village bounds: (${after.x.toFixed(1)}, ${after.z.toFixed(1)})`,
      )
    }
  }

  socket.close()
} catch (error) {
  problems.push(`harness error: ${error.message}`)
} finally {
  chrome.kill()
}

console.log('')
if (problems.length > 0) {
  console.error('Movement test FAILED:')
  for (const problem of problems) console.error(`  x ${problem}`)
  process.exit(1)
}

console.log('Movement test passed - the player stands and walks.\n')
