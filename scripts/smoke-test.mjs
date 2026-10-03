/**
 * Headless smoke test (spec §30, §38).
 *
 * The production build can succeed while the scene still throws at runtime —
 * a physics engine that fails to initialise, a bad three.js prop type, an
 * infinite render loop. This drives a real Chrome over the DevTools protocol,
 * clicks through the title screen into the village, and fails on any console
 * error or uncaught exception.
 *
 * Usage: start `npm run preview`, then `node scripts/smoke-test.mjs [url]`
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_UNDER_TEST = process.argv[2] ?? 'http://localhost:4173/'
const CHROME =
  process.env.CHROME_PATH ??
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9222

/** Console messages that are expected noise in a headless GPU-less run. */
const IGNORE = [
  /swiftshader/i,
  /GroupMarkerNotSet/i,
  /Automatic fallback to software WebGL/i,
  /Failed to load resource: net::ERR_FAILED/i,
  /favicon/i,
  /WebGL: CONTEXT_LOST/i,
  /GPU stall/i,
  /DevTools/i,
]

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + process.env.TEMP + '/cq-smoke-' + Date.now(),
    '--window-size=1280,800',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const problems = []
const logs = []

async function cdpTargets() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
  return response.json()
}

async function waitForChrome() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await cdpTargets()
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

/** Evaluates an expression in the page and returns its value. */
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

try {
  const wsUrl = await waitForChrome()
  const socket = await connect(wsUrl)

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)

    if (message.method === 'Runtime.consoleAPICalled') {
      const text = (message.params.args ?? [])
        .map((arg) => arg.value ?? arg.description ?? '')
        .join(' ')
      if (message.params.type === 'error') {
        if (!IGNORE.some((pattern) => pattern.test(text))) problems.push(text)
      }
      logs.push(`[${message.params.type}] ${text}`)
    }

    if (message.method === 'Runtime.exceptionThrown') {
      const text =
        message.params.exceptionDetails?.exception?.description ??
        message.params.exceptionDetails?.text ??
        'unknown exception'
      if (!IGNORE.some((pattern) => pattern.test(text))) problems.push(text)
    }
  })

  await send(socket, 'Runtime.enable')
  await send(socket, 'Page.enable')

  console.log(`Loading ${URL_UNDER_TEST} ...`)
  await send(socket, 'Page.navigate', { url: URL_UNDER_TEST })
  await sleep(4000)

  const title = await evaluate(socket, 'document.title')
  console.log(`  title: ${title}`)

  const hasCanvas = await evaluate(
    socket,
    '!!document.querySelector("canvas")',
  )
  console.log(`  canvas before start: ${hasCanvas}`)

  const buttonCount = await evaluate(
    socket,
    'document.querySelectorAll("button").length',
  )
  console.log(`  buttons on title screen: ${buttonCount}`)
  if (buttonCount === 0) problems.push('title screen rendered no buttons')

  /* Click "New Game" — the first primary button on the title screen. */
  const clicked = await evaluate(
    socket,
    `(() => {
       const button = [...document.querySelectorAll('button')]
         .find((b) => /new game/i.test(b.textContent ?? ''))
       if (!button) return 'not-found'
       button.click()
       return 'clicked'
     })()`,
  )
  console.log(`  new game: ${clicked}`)
  if (clicked !== 'clicked') problems.push('could not find the New Game button')

  /* Give physics, shaders and the world time to come up. */
  await sleep(9000)

  const state = await evaluate(
    socket,
    `(() => ({
       path: location.pathname,
       canvas: !!document.querySelector('canvas'),
       canvasSize: (() => {
         const c = document.querySelector('canvas')
         return c ? c.width + 'x' + c.height : 'none'
       })(),
       rootChildren: document.getElementById('root')?.children.length ?? 0,
       bodyText: (document.body.innerText || '').slice(0, 200),
     }))()`,
  )
  console.log(`  route: ${state.path}`)
  console.log(`  canvas after start: ${state.canvas} (${state.canvasSize})`)
  console.log(`  root children: ${state.rootChildren}`)

  if (state.path !== '/game') {
    problems.push(`expected to be on /game, but the route is ${state.path}`)
  }
  if (!state.canvas) {
    problems.push('no canvas mounted after starting the game')
  } else if (state.canvasSize === '0x0') {
    problems.push('the canvas mounted but has zero size')
  }

  /* WebGL must actually have produced a context, not just a <canvas> tag. */
  const glLive = await evaluate(
    socket,
    `(() => {
       const c = document.querySelector('canvas')
       if (!c) return 'no-canvas'
       const gl = c.getContext('webgl2') || c.getContext('webgl')
       if (!gl) return 'no-context'
       return gl.getParameter(gl.VERSION)
     })()`,
  )
  console.log(`  webgl: ${glLive}`)
  if (glLive === 'no-context' || glLive === 'no-canvas') {
    problems.push(`WebGL did not initialise (${glLive})`)
  }

  socket.close()
} catch (error) {
  problems.push(`harness error: ${error.message}`)
} finally {
  chrome.kill()
}

console.log('')
if (logs.length > 0) {
  console.log(`Console output (${logs.length} lines, first 12):`)
  for (const line of logs.slice(0, 12)) console.log(`  ${line}`)
  console.log('')
}

if (problems.length > 0) {
  console.error('Smoke test FAILED:')
  for (const problem of problems) console.error(`  x ${problem}`)
  process.exit(1)
}

console.log('Smoke test passed - title screen starts and the 3D scene mounts.\n')
