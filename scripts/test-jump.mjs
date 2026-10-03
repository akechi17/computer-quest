/**
 * Verifies the jump behaves like a jump.
 *
 * A jump that re-arms the instant the ground ray still finds the floor under
 * the rising body stacks velocity every frame: the character leaves the world
 * instead of hopping. Nothing in `tsc` or the build can see this — it only
 * exists while a real key is held against a real physics step.
 *
 * Usage: start `npm run preview`, then `node scripts/test-jump.mjs`
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_UNDER_TEST = process.argv[2] ?? 'http://localhost:4173/'
const CHROME =
  process.env.CHROME_PATH ??
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9227

/** Standing height on flat ground, from PLAYER.CAPSULE_* . */
const STAND_Y = 0.95
/** A jump of JUMP_VELOCITY 6.2 against gravity -20 peaks near 0.96 above the
    start. Anything past this is not a jump. */
const MAX_RISE = 2.2
/** Repeated taps must not accumulate; a few jumps in a row must still land. */
const FLIGHT_LIMIT = 6

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}/cq-jump-${Date.now()}`,
    '--window-size=1280,800',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const problems = []
const log = (line) => console.log(`  ${line}`)

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

const PROBE = `(() => {
  const c = document.querySelector('canvas')
  const r = c && c.__cq
  return r ? r() : null
})()`

const probe = (socket) => evaluate(socket, PROBE)

function key(socket, type, code, k, keyCode) {
  return send(socket, 'Input.dispatchKeyEvent', {
    type,
    code,
    key: k,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  })
}

async function main() {
  const socket = await connect(await waitForChrome())
  await send(socket, 'Page.enable')
  await send(socket, 'Runtime.enable')
  await send(socket, 'Page.navigate', { url: URL_UNDER_TEST })
  await sleep(3500)

  /* The game opens on a title screen; the scene only mounts once play starts,
     so the probe cannot exist before this click. */
  await evaluate(
    socket,
    `[...document.querySelectorAll('button')]
       .find((b) => /new game/i.test(b.textContent ?? ''))?.click()`,
  )

  const deadline = Date.now() + 25000
  let ready = null
  while (Date.now() < deadline) {
    ready = await probe(socket)
    if (ready) break
    await sleep(200)
  }
  if (!ready) {
    problems.push('the game never became ready')
    return
  }
  await sleep(1500)

  /* --- 1. A held space must produce one hop, not a climb --------------- */
  const start = await probe(socket)
  log(`starting at y=${start.y.toFixed(2)} grounded=${start.grounded}`)

  await key(socket, 'keyDown', 'Space', ' ', 32)
  let peak = start.y
  for (let i = 0; i < 30; i += 1) {
    await sleep(80)
    const s = await probe(socket)
    if (s && s.y > peak) peak = s.y
  }
  await key(socket, 'keyUp', 'Space', ' ', 32)
  await sleep(1200)

  const held = await probe(socket)
  log(`holding space peaked at y=${peak.toFixed(2)}, ended at y=${held.y.toFixed(2)}`)

  if (peak > STAND_Y + MAX_RISE) {
    problems.push(
      `holding space flew the player to y=${peak.toFixed(2)} — ` +
        `a single jump should not pass y=${(STAND_Y + MAX_RISE).toFixed(2)}`,
    )
  }
  if (held.y > STAND_Y + 0.6) {
    problems.push(
      `the player never came back down after holding space (y=${held.y.toFixed(2)})`,
    )
  }

  /* --- 2. Repeated taps must not stack -------------------------------- */
  for (let i = 0; i < 5; i += 1) {
    await key(socket, 'keyDown', 'Space', ' ', 32)
    await sleep(60)
    await key(socket, 'keyUp', 'Space', ' ', 32)
    await sleep(140)
  }
  await sleep(1500)
  const tapped = await probe(socket)
  log(`after five rapid taps: y=${tapped.y.toFixed(2)} grounded=${tapped.grounded}`)

  if (tapped.y > STAND_Y + FLIGHT_LIMIT) {
    problems.push(
      `five rapid taps left the player at y=${tapped.y.toFixed(2)} — ` +
        'velocity is stacking instead of resetting',
    )
  }
  if (!tapped.grounded) {
    problems.push(
      `the player was still airborne 1.5 s after the last tap (y=${tapped.y.toFixed(2)})`,
    )
  }
}

try {
  await main()
} catch (error) {
  problems.push(`harness error: ${error.message}`)
} finally {
  chrome.kill()
}

if (problems.length > 0) {
  console.log('\nJump test FAILED:')
  for (const problem of problems) console.log(`  x ${problem}`)
  process.exit(1)
}
console.log('\nJump test passed - space hops and lands.')
