/**
 * Drives the whole of quest #1 in a real browser, from greeting Professor Byte
 * to handing the finished computer back to him.
 *
 * This exists because every failure this project has hit — a missing ground
 * collider, a mini-game nothing launched, a final conversation that never
 * completed its quest — was invisible to `tsc` and to `vite build`. The build
 * proves the code compiles; it says nothing about whether a child can finish
 * the quest. This walks the actual objective chain and fails at the step that
 * breaks.
 *
 * The player is teleported between interactions rather than walked, because
 * pathfinding is not what is under test here and a stumble would report a
 * quest bug that is really a navigation bug. Each hop is followed by a wait
 * for the interaction detector to publish the expected target, so the test
 * still fails honestly if an object is unreachable or not visible.
 *
 * Usage: start `npm run preview`, then `node scripts/test-quest-chain.mjs`
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_UNDER_TEST = process.argv[2] ?? 'http://localhost:4173/'
const CHROME =
  process.env.CHROME_PATH ??
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9224

/* World positions, mirroring src/data/world.ts. */
const PLACES = {
  professorByte: { x: 3.4, z: -1.6, expect: 'professor-byte' },
  monitor: { x: -2.1, z: -7.5, expect: 'village-computer-monitor' },
  keyboard: { x: -1.3, z: -6.2, expect: 'village-computer-keyboard' },
  tower: { x: 0.6, z: -7.9, expect: 'village-computer-tower' },
  ram: { x: 9.5, z: 5.5, expect: 'missing-ram' },
}

/** The objective order the quest declares, and the place that satisfies it. */
const CHAIN = [
  { objective: 'talk-to-byte', place: PLACES.professorByte, how: 'talk' },
  { objective: 'inspect-monitor', place: PLACES.monitor, how: 'interact' },
  { objective: 'inspect-keyboard', place: PLACES.keyboard, how: 'interact' },
  { objective: 'inspect-tower', place: PLACES.tower, how: 'interact' },
  { objective: 'find-ram', place: PLACES.ram, how: 'interact' },
  { objective: 'install-ram', place: PLACES.tower, how: 'minigame' },
  { objective: 'return-to-byte', place: PLACES.professorByte, how: 'talk' },
]

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
    /* A unique profile per run: a fixed directory stays locked after an
       interrupted run, and the next launch then dies with "Multiple targets
       are not supported in headless mode" instead of a useful error. */
    `--user-data-dir=${process.env.TEMP}/cq-quest-${Date.now()}`,
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

/** Dispatch a real key press the way a keyboard would. */
function pressKey(socket, code, key, keyCode) {
  return send(socket, 'Input.dispatchKeyEvent', {
    type: 'keyDown',
    code,
    key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  }).then(() =>
    send(socket, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      code,
      key,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
    }),
  )
}

const pressInteract = (socket) => pressKey(socket, 'KeyE', 'e', 69)

/** How far below the target the player is placed, so they land facing it. */
const APPROACH_DISTANCE = 1.5

/**
 * Move the player to a spot and turn them to face the object.
 *
 * The facing matters: the interaction detector prefers whatever the player
 * looks at, and the monitor and keyboard stand only 1.5 units apart — landing
 * between them without aiming makes the choice a coin flip, which would look
 * like a quest bug rather than a test bug.
 *
 * The heading uses the same convention as the detector: forward is
 * `(-sin(h), -cos(h))`, so facing a target means `atan2(-dx, -dz)`.
 */
async function approach(socket, target) {
  /* Stand back along the line from the object to the origin, then look at it. */
  const dx = 0 - target.x
  const dz = 0 - target.z
  const length = Math.hypot(dx, dz) || 1
  const px = target.x + (dx / length) * APPROACH_DISTANCE
  const pz = target.z + (dz / length) * APPROACH_DISTANCE
  const heading = Math.atan2(-(target.x - px), -(target.z - pz))

  await evaluate(
    socket,
    `window.__cqTeleport(${px}, ${pz}, ${heading})`,
  )

  /* Wait for the drop to finish, so the detector is not sampling a falling
     player and reporting a target we are about to leave behind. */
  await waitFor(
    socket,
    `landing near (${target.x}, ${target.z})`,
    (s) => s.grounded && Math.hypot(s.x - target.x, s.z - target.z) < 3.5,
    5000,
  )
}

async function probe(socket) {
  return evaluate(socket, PROBE)
}

/** Wait until `predicate(state)` holds, or give up and return the last state. */
async function waitFor(socket, label, predicate, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await probe(socket)
    if (last && predicate(last)) return last
    await sleep(100)
  }
  problems.push(`timed out waiting for ${label} (last state: ${summarise(last)})`)
  return last
}

function summarise(state) {
  if (!state) return 'no probe'
  return `objective=${state.objective} nearest=${state.nearest} overlay=${state.overlay} dialogue=${state.dialogue}`
}

/**
 * Close whatever overlay is open. Lesson overlays reveal their facts on a
 * timer and disable the button until they finish, so click repeatedly rather
 * than once.
 */
async function dismissOverlays(socket) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = await probe(socket)
    if (!state) return
    if (state.overlay === 'none' && state.dialogue === null) return

    const clicked = await evaluate(
      socket,
      `(() => {
        const buttons = [...document.querySelectorAll('button')]
        const pick = (re) => buttons.find((b) => re.test(b.textContent ?? '') && !b.disabled)
        const button = pick(/got it|continue|done|skip/i) ?? pick(/^close|✕/i)
        if (!button) return false
        button.click()
        return true
      })()`,
    )
    // Typing animations need a beat between clicks; Space also advances.
    if (!clicked) await pressKey(socket, 'Space', ' ', 32)
    await sleep(350)
  }
  problems.push('an overlay would not close')
}

/** Talk to Professor Byte and let the whole conversation play out. */
async function runConversation(socket) {
  await waitFor(socket, 'dialogue to open', (s) => s.dialogue !== null, 5000)

  /* Walk the tree: pick the first choice while choices are showing, otherwise
     advance. Bounded so a tree cycle cannot hang the suite. */
  for (let step = 0; step < 24; step += 1) {
    const state = await probe(socket)
    if (!state || state.dialogue === null) return true

    const chose = await evaluate(
      socket,
      `(() => {
        const buttons = [...document.querySelectorAll('button')]
        const choice = buttons.find((b) =>
          /is it broken|what is a computer|which part|keep looking/i.test(b.textContent ?? ''))
        if (choice && !choice.disabled) { choice.click(); return true }
        const advance =
          [...document.querySelectorAll('button')].find((b) =>
            /continue|done|skip/i.test(b.textContent ?? '') && !b.disabled)
        if (advance) { advance.click(); return true }
        return false
      })()`,
    )
    if (!chose) await pressKey(socket, 'Space', ' ', 32)
    await sleep(450)
  }

  problems.push('conversation never ended')
  return false
}

/** Play the RAM sorting mini-game to completion. */
async function playRamSorting(socket) {
  await waitFor(socket, 'mini-game overlay', (s) => s.overlay === 'minigame', 6000)

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const state = await probe(socket)
    if (!state || state.overlay !== 'minigame') return true

    /* The game is a choose-response loop: click whichever action button looks
       right, and keep clicking. We are testing that finishing it advances the
       quest, not that the puzzle is solvable by a scripted player — the real
       win condition is an in-game "done" state. */
    const acted = await evaluate(
      socket,
      `(() => {
        const buttons = [...document.querySelectorAll('button')]
          .filter((b) => !b.disabled && b.offsetParent !== null)
        const action = buttons.find((b) =>
          /keep|close|store|discard|finish|done|next/i.test(b.textContent ?? ''))
        if (!action) return false
        action.click()
        return true
      })()`,
    )
    if (!acted) {
      /* Fall back to the game's own hint control if it has one. */
      await sleep(300)
    }
    await sleep(260)
  }

  problems.push('mini-game never reached a finished state')
  return false
}

/* -------------------------------------------------------------------------- */

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

  await sleep(6000)

  const start = await probe(socket)
  if (!start) {
    problems.push('no test probe on the canvas — expected canvas.__cq()')
    throw new Error('probe missing')
  }

  if (start.questStatus !== 'active' && start.questStatus !== 'locked') {
    problems.push(`quest started in an unexpected state: ${start.questStatus}`)
  }

  /* The teleport hook is provided by the same probe mechanism; if it is
     missing the test cannot drive the chain and must say so rather than
     silently passing. */
  const hasTeleport = await evaluate(
    socket,
    `typeof window.__cqTeleport === 'function'`,
  )
  if (hasTeleport !== true) {
    problems.push(
      'no window.__cqTeleport — the quest-chain test cannot position the player',
    )
    throw new Error('teleport hook missing')
  }

  for (const [index, stop] of CHAIN.entries()) {
    const label = `step ${index + 1}/${CHAIN.length}: ${stop.objective}`

    await approach(socket, stop.place)

    /* Wait for the detector to actually offer the expected target: this is
       what proves the object is visible and in range, not merely present. */
    const arrived = await waitFor(
      socket,
      `${label} — detector offering ${stop.place.expect}`,
      (s) => s.nearest === stop.place.expect,
      5000,
    )
    if (!arrived || arrived.nearest !== stop.place.expect) continue

    if (stop.how === 'talk') {
      await pressInteract(socket)
      await runConversation(socket)
      await sleep(400)
    } else if (stop.how === 'interact') {
      await pressInteract(socket)
      /* A pickup or inspectable opens its lesson overlay; clear it so the
         next step starts from a clean state. */
      await sleep(700)
      await dismissOverlays(socket)
    } else if (stop.how === 'minigame') {
      await pressInteract(socket)
      await playRamSorting(socket)
      await dismissOverlays(socket)
    }

    /* Confirm the objective actually advanced past the one we just did. */
    const after = await waitFor(
      socket,
      `${label} — objective to move on`,
      (s) => s.objective !== stop.objective,
      6000,
    )

    if (after && after.objective === stop.objective) {
      problems.push(
        `${label} did not advance: still on '${stop.objective}' (${summarise(after)})`,
      )
    } else {
      log(`${label} -> ${after ? after.objective ?? '(none)' : '?'}`)
    }
  }

  const end = await probe(socket)
  log(`final: status=${end.questStatus} items=[${end.items.join(', ')}]`)

  if (end.questStatus !== 'complete') {
    problems.push(
      `quest did not complete — status is '${end.questStatus}', last objective '${end.objective}'`,
    )
  }

  if (end.items.includes('ram-module')) {
    problems.push('the RAM module was not consumed when it was installed')
  }

  if (!end.items.includes('lab-pass')) {
    problems.push('quest reward item "lab-pass" was never granted')
  }

  socket.close()
} catch (error) {
  problems.push(`harness error: ${error.message}`)
} finally {
  chrome.kill()
}

console.log('')
if (problems.length > 0) {
  console.error('Quest chain test FAILED:')
  for (const problem of problems) console.error(`  x ${problem}`)
  process.exit(1)
}

console.log('Quest chain test passed - the first quest runs start to finish.\n')
