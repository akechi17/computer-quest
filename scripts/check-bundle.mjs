/**
 * Verifies the production bundle is split so the UI shell can paint before the
 * 3D engine downloads.
 *
 * This exists because a chunking rule that silently does nothing still
 * produces a successful build: Vite 8 (rolldown) did not honour the
 * `manualChunks` function in `vite.config.ts`, and the resulting bundle only
 * looked split because of automatic code splitting. The build number alone
 * cannot tell you that, so this check reads the emitted chunks directly.
 *
 * Run after `npm run build`:  node scripts/check-bundle.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ASSETS = 'dist/assets'

/**
 * Library fingerprints. Each entry lists strings that appear in that library's
 * minified output and (importantly) NOT in the others.
 *
 * Three traps this list exists to avoid:
 *   - `createRoot` is not an r3f marker: React DOM exports a function of the
 *     same name, so it appears in any app's entry chunk via `main.tsx`.
 *   - `Instances` is not a drei marker: `@react-three/fiber` exports a symbol
 *     of the same name, so it matches the fiber chunk too.
 *   - `WebGLRenderer` is not a pure `three` marker for chunk *grouping*:
 *     three lands in whichever chunk rapier is in, because rapier depends on
 *     `three-stdlib` and imports `three` directly. That pairing is correct.
 *     What matters is that neither ends up in the entry chunk.
 *
 * The package paths survive minification because they appear in warnings and
 * dev-only guards, which makes them the most reliable markers available.
 */
const MARKERS = {
  three: ['WebGLRenderer', 'BufferGeometry'],
  fiber: ['react-three-fiber'],
  rapier: ['CapsuleCollider', 'suspend-react'],
}

/**
 * Per-chunk budgets in kB. The entry chunk (`shell`) is the one that must stay
 * small; the 3D chunks are allowed to be large because they download lazily
 * and are cached independently of the app code.
 */
const BUDGET_KB = {
  shell: 400,
  three: 1800,
  fiber: 800,
  rapier: 3200,
  'fiber+rapier': 4200,
  'three+rapier': 4200,
  'three+fiber+rapier': 4600,
}

let failed = false
const fail = (message) => {
  failed = true
  console.error(`  x ${message}`)
}

let files
try {
  files = readdirSync(ASSETS).filter((name) => name.endsWith('.js'))
} catch {
  console.error(`No ${ASSETS} directory - run \`npm run build\` first.`)
  process.exit(1)
}

const chunks = files.map((name) => {
  const path = join(ASSETS, name)
  const source = readFileSync(path, 'utf8')
  const libraries = Object.entries(MARKERS)
    .filter(([, needles]) => needles.some((needle) => source.includes(needle)))
    .map(([library]) => library)

  return { name, source, libraries, kb: statSync(path).size / 1024 }
})

const totalKb = chunks.reduce((sum, chunk) => sum + chunk.kb, 0)
console.log(`\nBundle check - ${chunks.length} chunks, ${Math.round(totalKb)} kB total\n`)

for (const chunk of chunks) {
  const label = chunk.libraries.length > 0 ? chunk.libraries.join('+') : 'shell'
  console.log(
    `  ${chunk.name.padEnd(38)} ${String(Math.round(chunk.kb)).padStart(6)} kB   ${label}`,
  )
}
console.log('')

const entry = chunks.find((chunk) => chunk.name.startsWith('index-'))

/* 1. The entry chunk must not carry the 3D engine: that would block first
      paint on the title screen, which is the whole point of the split. */
if (!entry) {
  fail('no entry chunk found (expected a file named index-*.js)')
} else {
  for (const [library, needles] of Object.entries(MARKERS)) {
    if (needles.some((needle) => entry.source.includes(needle))) {
      fail(`${library} is in the entry chunk - it would block first paint`)
    }
  }
}

/* 2. Each heavy library should have its own chunk, so a change to one does not
      invalidate the cache of the others.
      three and fiber are exempt: rapier imports both, so whichever chunk
      rapier lands in necessarily carries them too. That is a property of the
      dependency graph, not a chunking mistake. */
const EXEMPT = new Set(['three+fiber+rapier', 'fiber+rapier', 'three+rapier'])
for (const chunk of chunks) {
  const key = chunk.libraries.join('+')
  if (chunk.libraries.length > 1 && !EXEMPT.has(key)) {
    fail(`${chunk.name} mixes ${chunk.libraries.join(' and ')} in one chunk`)
  }
}

for (const library of Object.keys(MARKERS)) {
  const owning = chunks.filter((chunk) => chunk.libraries.includes(library))
  if (owning.length === 0) {
    fail(`${library} was not found in any chunk - the marker may be stale`)
  }
}

/* 3. Size budgets, so a regression surfaces here rather than in the field. */
for (const chunk of chunks) {
  const key = chunk.libraries.length > 0 ? chunk.libraries.join('+') : 'shell'
  const budget = BUDGET_KB[key] ?? BUDGET_KB.shell
  if (chunk.kb > budget) {
    fail(
      `${chunk.name} is ${Math.round(chunk.kb)} kB, over the ${budget} kB ` +
        `${key} budget`,
    )
  }
}

if (failed) {
  console.error('\nBundle check FAILED\n')
  process.exit(1)
}

console.log('Bundle check passed - the shell loads without the 3D engine.\n')
