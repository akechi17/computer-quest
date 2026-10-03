/**
 * Verifies the Hardware Lab is a room the player can actually walk into.
 *
 * The lab pass is the reward for the whole first quest, and for most of this
 * project's life it unlocked a *solid box*: `StudyColliders` had a single
 * 14x6x9 block where the lab stands, and the gate that "opened" it only
 * changed colour. Nothing in `tsc`, `vite build` or the bundle check can tell
 * a doorway from a wall — they all pass identically on an unenterable room.
 * So this test walks the player through the door with real key presses.
 *
 * It also guards the failure mode this project has already hit once: a room
 * built with explicit geometry is exactly where a missing floor collider hides
 * (`colliders={false}` with no explicit box underfoot). Standing inside the
 * lab is asserted, not assumed.
 *
 * Usage: start `npm run preview`, then `node scripts/test-hardware-lab.mjs`
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_UNDER_TEST = process.argv[2] ?? 'http://localhost:4173/'
const CHROME =
  process.env.CHROME_PATH ??
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9225

/* ---------------------------------------------------------------- */
/* Lab geometry, mirroring src/game/world/HardwareLab.tsx            */
/* ---------------------------------------------------------------- */

/** Front (south) outer face of the building. */
const FRONT_FACE_Z = -27.5
/** Back (north) inner face. */
const BACK_FACE_Z = -36.5
/** How far inside the door counts as "in the room". */
const INSIDE_Z = -30.5
/** Below this the player has fallen through the world. */
const FALLEN_Y = -1.5
/** The player's capsule radius, from PLAYER.CAPSULE_RADIUS. The body stops
    one of these away from any wall face. */
const PLAYER_RADIUS = 0.35

/** Where the player is placed to begin the walk in. */
const OUTSIDE_START = { x: 0, z: FRONT_FACE_Z + 3 }

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
    /* Unique profile per run: a fixed directory stays locked after an
       interrupted run and the next launch dies with "Multiple targets are not
       supported in headless mode" rather than a useful error. */
    `--user-data-dir=${process.env.TEMP}/cq-lab-${Date.now()}`,
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

function forwardKey(socket, type, code, key, keyCode) {
  return send(socket, 'Input.dispatchKeyEvent', {
    type,
    code,
    key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  })
}

const pressInteract = async (socket) => {
  await forwardKey(socket, 'keyDown', 'KeyE', 'e', 69)
  await forwardKey(socket, 'keyUp', 'KeyE', 'e', 69)
}

async function waitFor(socket, label, predicate, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await probe(socket)
    if (last && predicate(last)) return last
    await sleep(100)
  }
  problems.push(`timed out waiting for ${label} (last: ${summarise(last)})`)
  return last
}

function summarise(state) {
  if (!state) return 'no probe'
  return `pos=(${state.x.toFixed(1)}, ${state.y.toFixed(1)}, ${state.z.toFixed(1)}) grounded=${state.grounded} nearest=${state.nearest}`
}

/**
 * Drop the player at a spot, facing a direction, and wait for them to settle.
 *
 * The teleport parks the body at `DROP_HEIGHT` and lets it fall, so the only
 * honest landing test is that the position has *stopped changing*. An earlier
 * version accepted `grounded && |y| < 1.5`, which is true for most of the fall:
 * the helper returned mid-air, and every later assertion — wall stops, exhibit
 * proximity, the "standing inside" reading — was taken against a falling body.
 *
 * `heading` uses the same convention as the movement code: forward is
 * `(-sin(h), -cos(h))`, so walking north (toward -Z) means heading 0.
 */
async function place(socket, x, z, heading = 0) {
  await evaluate(socket, `window.__cqTeleport(${x}, ${z}, ${heading})`)

  const deadline = Date.now() + 6000
  let previous = null
  let settled = 0
  let last = null

  while (Date.now() < deadline) {
    last = await probe(socket)
    if (last) {
      const moved = previous
        ? Math.hypot(last.x - previous.x, last.y - previous.y, last.z - previous.z)
        : Infinity
      /* Two consecutive quiet samples, at 10Hz, is a settled body — a falling
         one always moves well over a centimetre between them. */
      settled = moved < 0.01 ? settled + 1 : 0
      if (settled >= 2 && last.grounded) return last
      previous = last
    }
    await sleep(100)
  }

  problems.push(`the player never settled at (${x}, ${z}) (last: ${summarise(last)})`)
  return last
}

/** Hold a movement key for a while and report how far the player travelled. */
async function walk(socket, code, key, keyCode, ms) {
  const before = await probe(socket)
  await forwardKey(socket, 'keyDown', code, key, keyCode)
  await sleep(ms)
  await forwardKey(socket, 'keyUp', code, key, keyCode)
  await sleep(250)
  const after = await probe(socket)
  return { before, after }
}

/**
 * Orbit the camera until 'W' walks north, toward the lab.
 *
 * Forward is `(-sin(yaw), -cos(yaw))`, so heading to -Z wants `yaw = 0`. The
 * mouse drag below moves the orbit by `dx * ROTATE_SENSITIVITY`; rather than
 * hard-code that constant here, the helper drags and re-reads the yaw until it
 * is close enough, and fails loudly if it never converges.
 */
async function aimAtDoor(socket) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = await probe(socket)
    if (Math.abs(state.yaw) < 0.02) return

    const dx = Math.round(state.yaw * 90)
    await send(socket, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 640,
      y: 400,
      button: 'left',
      clickCount: 1,
      buttons: 1,
    })
    await send(socket, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 640 + dx,
      y: 400,
      button: 'left',
      buttons: 1,
    })
    await send(socket, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 640 + dx,
      y: 400,
      button: 'left',
      clickCount: 1,
      buttons: 0,
    })
    await sleep(200)
  }
  problems.push('could not aim the camera at the lab doorway')
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

  const hasTeleport = await evaluate(
    socket,
    `typeof window.__cqTeleport === 'function'`,
  )
  if (hasTeleport !== true) {
    problems.push('no window.__cqTeleport — cannot position the player')
    throw new Error('teleport hook missing')
  }

  /* ------------------------------------------------------------------ */
  /* 1. Exhibits stay hidden until the lab pass is earned                */
  /* ------------------------------------------------------------------ */
  /* Before the quest is finished the exhibits are zone-gated. Teleporting
     bypasses the walls, so being inside the room proves nothing on its own —
     what matters is that nothing is offered to interact with. */
  await place(socket, 0, -30.5)
  const locked = await probe(socket)
  if (locked.nearest !== null && locked.nearest?.startsWith('exhibit-')) {
    problems.push(
      `an exhibit was visible before the lab was unlocked: nearest=${locked.nearest}`,
    )
  } else {
    log(`before unlock: nearest=${locked.nearest} (expected none)`)
    log('exhibits hidden until the lab pass is earned')
  }

  /* ------------------------------------------------------------------ */
  /* 2. The doorway is passable — walk in with real key presses          */
  /* ------------------------------------------------------------------ */
  /*
   * The walk has to aim at the door in *world* terms, and movement follows the
   * camera rather than the character's heading. `place` sets the heading and
   * the camera catches up to it, so by the time the walk starts the orbit yaw
   * is the thing that decides where 'W' goes. Steering by the live yaw is what
   * makes this measure the doorway instead of the camera's mood.
   */
  await place(socket, OUTSIDE_START.x, OUTSIDE_START.z, 0)
  await aimAtDoor(socket)

  const outside = await probe(socket)
  if (outside.z < FRONT_FACE_Z) {
    problems.push(
      `the drop started inside the wall: z=${outside.z.toFixed(2)}, expected > ${FRONT_FACE_Z}`,
    )
  }

  const { after: walked } = await walk(socket, 'KeyW', 'w', 87, 2200)
  log(
    `walked in: z ${outside.z.toFixed(2)} -> ${walked.z.toFixed(2)} ` +
      `(door face at ${FRONT_FACE_Z})`,
  )

  if (walked.z >= FRONT_FACE_Z) {
    problems.push(
      `the player could not walk through the doorway: stopped at z=${walked.z.toFixed(2)}, ` +
        `still outside the front face at ${FRONT_FACE_Z}. The gap is not passable.`,
    )
  } else if (walked.z > INSIDE_Z) {
    problems.push(
      `the player entered the doorway but not the room: z=${walked.z.toFixed(2)}, ` +
        `expected past ${INSIDE_Z}`,
    )
  } else {
    log('the doorway is genuinely passable')
  }

  /* ------------------------------------------------------------------ */
  /* 3. The room has a floor                                             */
  /* ------------------------------------------------------------------ */
  /* A ceilinged room built from explicit boxes is exactly where a missing
     floor collider hides: the geometry is drawn, the scene renders, and the
     player drops through it the moment they step in. */
  for (const z of [-29.5, -31.5, -34]) {
    const state = await place(socket, 0, z)
    if (!state) continue
    if (!state.grounded || state.y < FALLEN_Y) {
      problems.push(
        `fell through the lab floor at z=${z}: y=${state.y.toFixed(2)} grounded=${state.grounded}`,
      )
    }
  }
  /* Read from `place`'s settled state, not a fresh probe: the last teleport in
     the loop is what is being described, and a bare probe catches it mid-fall. */
  const inside = await place(socket, 0, -34)
  log(`standing inside: y=${inside.y.toFixed(2)} grounded=${inside.grounded}`)
  /* The capsule's centre rests a half-height plus a radius above the floor, so
     a settled player is at ≈0.95 — well clear of a body sunk into the slab. */
  if (inside.grounded && inside.y < 0.5) {
    problems.push(
      `the player is standing inside the floor slab: y=${inside.y.toFixed(2)}, ` +
        'expected the capsule centre near 0.95',
    )
  }

  /* ------------------------------------------------------------------ */
  /* 4. The shell is solid                                               */
  /* ------------------------------------------------------------------ */
  /*
   * Movement is camera-relative, and the camera orbits freely, so pressing a
   * key does not name a world direction — 'W' always goes *away from the
   * camera*, wherever that happens to point. These checks therefore read the
   * live yaw from the probe and assert against the wall that lies in the
   * direction actually travelled, rather than assuming 'W' means north. The
   * earlier version assumed it did and reported a wall failure that was really
   * a camera-orientation artefact.
   */

  /** Unit movement direction for a key, given the camera yaw. */
  const directionFor = (yaw, forward = true) => {
    /* Forward is (-sin, -cos); strafing right is (cos, -sin). */
    return forward
      ? { x: -Math.sin(yaw), z: -Math.cos(yaw) }
      : { x: Math.cos(yaw), z: -Math.sin(yaw) }
  }

  /** Where a walk is expected to be stopped by the shell, if at all. */
  const LIMITS = {
    minX: -7 + PLAYER_RADIUS,
    maxX: 7 - PLAYER_RADIUS,
    minZ: BACK_FACE_Z + PLAYER_RADIUS,
    maxZ: FRONT_FACE_Z - PLAYER_RADIUS,
  }

  const checkInside = (label, state, from) => {
    /* The player must have moved, or the test proves nothing. */
    const travelled = Math.hypot(state.x - from.x, state.z - from.z)
    if (travelled < 1) {
      problems.push(
        `${label}: the player did not move at all (${travelled.toFixed(2)} units) — ` +
          'the walk was blocked immediately rather than by a wall',
      )
      return
    }

    /* Allow a small tolerance for the skin and the physics step. */
    const slack = 0.25
    const escaped =
      state.x < LIMITS.minX - slack ||
      state.x > LIMITS.maxX + slack ||
      state.z < LIMITS.minZ - slack ||
      state.z > LIMITS.maxZ + slack

    if (escaped) {
      problems.push(
        `${label}: walked through the lab shell — ended at ` +
          `(${state.x.toFixed(2)}, ${state.z.toFixed(2)}), ` +
          `inside limit x[${LIMITS.minX.toFixed(2)}, ${LIMITS.maxX.toFixed(2)}] ` +
          `z[${LIMITS.minZ.toFixed(2)}, ${LIMITS.maxZ.toFixed(2)}]`,
      )
    } else {
      log(
        `${label}: stopped inside the shell at ` +
          `(${state.x.toFixed(2)}, ${state.z.toFixed(2)}), travelled ${travelled.toFixed(2)}`,
      )
    }
  }

  /* Walk forward until a wall stops the player or the timeout expires. The
     character starts mid-room pointing at the back wall. */
  const beforeForward = await place(socket, 0, -33, 0)
  const forwardYaw = beforeForward.yaw
  const forwardDir = directionFor(forwardYaw)
  const { after: pushed } = await walk(socket, 'KeyW', 'w', 87, 3000)
  log(
    `  forward walked toward (${forwardDir.x.toFixed(2)}, ${forwardDir.z.toFixed(2)})`,
  )
  checkInside('forward into the shell', pushed, beforeForward)

  /* And strafe, which exercises the other axis. */
  const beforeStrafe = await place(socket, 0, -32, 0)
  const { after: sideways } = await walk(socket, 'KeyD', 'd', 68, 3000)
  checkInside('strafing into the shell', sideways, beforeStrafe)

  /* ------------------------------------------------------------------ */
  /* 5. Unlocking the zone reveals all ten exhibits                      */
  /* ------------------------------------------------------------------ */
  /* Set the unlock directly rather than replaying the quest: the quest chain
     is covered by test-quest-chain.mjs, and replaying it here would make this
     test fail for reasons that have nothing to do with the lab. */
  const unlocked = await evaluate(
    socket,
    `(() => {
      const w = window
      if (!w.__cqUnlockZone) return false
      w.__cqUnlockZone('hardware-lab')
      return true
    })()`,
  )
  if (unlocked !== true) {
    problems.push(
      'no window.__cqUnlockZone — cannot reach the unlocked-lab assertions',
    )
  } else {
    /* Positions mirror the grid in src/data/world.ts. */
    const EXHIBITS = [
      { id: 'exhibit-cpu', x: -5.2, z: -30.5 },
      { id: 'exhibit-ram', x: -2.6, z: -30.5 },
      { id: 'exhibit-gpu', x: 0, z: -30.5 },
      { id: 'exhibit-motherboard', x: 2.6, z: -30.5 },
      { id: 'exhibit-psu', x: 5.2, z: -30.5 },
      { id: 'exhibit-ssd', x: -5.2, z: -34 },
      { id: 'exhibit-hdd', x: -2.6, z: -34 },
      { id: 'exhibit-cooler', x: 0, z: -34 },
      { id: 'exhibit-keyboard', x: 2.6, z: -34 },
      { id: 'exhibit-monitor', x: 5.2, z: -34 },
    ]

    let found = 0
    for (const exhibit of EXHIBITS) {
      /* Stand one unit south of the pedestal and face it, so the detector is
         not asked to choose between neighbours 2.6 apart. */
      const standingZ = exhibit.z + 1.6
      await place(socket, exhibit.x, standingZ, 0)

      const state = await waitFor(
        socket,
        `detector to offer ${exhibit.id}`,
        (s) => s.nearest === exhibit.id,
        4000,
      )
      if (state && state.nearest === exhibit.id) {
        found += 1
      } else {
        problems.push(
          `${exhibit.id} was not offered at (${exhibit.x}, ${standingZ}) — ` +
            `nearest=${state ? state.nearest : '?'}`,
        )
      }
    }

    log(`${found}/${EXHIBITS.length} exhibits reachable after unlocking`)

    /* ------------------------------------------------------------------ */
    /* 6. Inspecting an exhibit teaches its lesson                         */
    /* ------------------------------------------------------------------ */
    const cpu = EXHIBITS[0]
    await place(socket, cpu.x, cpu.z + 1.6, 0)
    const offered = await waitFor(
      socket,
      'cpu exhibit offered again',
      (s) => s.nearest === 'exhibit-cpu',
      4000,
    )
    if (offered && offered.nearest === 'exhibit-cpu') {
      await pressInteract(socket)
      const opened = await waitFor(
        socket,
        'the CPU lesson to open',
        (s) => s.overlay === 'lesson',
        5000,
      )
      if (opened && opened.overlay === 'lesson') {
        log('inspecting an exhibit opens its lesson')
      } else {
        problems.push('inspecting the CPU exhibit did not open a lesson')
      }
    }

    /* Badges the lab exists to make reachable. */
    const afterLesson = await probe(socket)
    log(
      `after inspecting the CPU: lessons=[${afterLesson.lessons.join(', ')}] ` +
        `badges=[${afterLesson.badges.join(', ')}]`,
    )

    if (!afterLesson.lessons.includes('processing')) {
      problems.push(
        'the CPU exhibit did not record its "processing" lesson — ' +
          `lessons=[${afterLesson.lessons.join(', ')}]`,
      )
    }

    /* `processing`'s badge, which no object in the world could award before
       the lab existed. */
    if (!afterLesson.badges.includes('cpu-specialist')) {
      problems.push(
        'the cpu-specialist badge was not awarded — badges=[' +
          `${afterLesson.badges.join(', ')}]`,
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
  console.error('Hardware Lab test FAILED:')
  for (const problem of problems) console.error(`  x ${problem}`)
  process.exit(1)
}

console.log('Hardware Lab test passed - the reward for quest #1 is a room you can walk into.\n')
