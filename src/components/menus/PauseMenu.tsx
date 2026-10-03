import { useEffect } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { useSettingsStore, type QualityPreset, type TextScale } from '@/stores/settingsStore'

/**
 * Pause menu and settings (spec §31, §32).
 *
 * Every accessibility control the spec lists is exposed here: subtitles, high
 * contrast, reduced motion, text size, and the audio volumes.
 */
export function PauseMenu({ onQuit }: { onQuit: () => void }) {
  const paused = useSessionStore((s) => s.paused)
  const setPaused = useSessionStore((s) => s.setPaused)
  const overlay = useSessionStore((s) => s.overlay)

  const settings = useSettingsStore()

  /* Escape toggles pause, but only when nothing else is on top. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return
      if (overlay !== 'none') return
      event.preventDefault()
      setPaused(!paused)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paused, setPaused, overlay])

  if (!paused || overlay !== 'none') return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-cq-night/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paused"
        className="cq-panel-solid cq-pop max-h-[90vh] w-full max-w-md overflow-y-auto"
      >
        <div className="border-b border-cq-edge/60 px-5 py-4">
          <h2 className="font-display text-xl font-black text-cq-ink">Paused</h2>
          <p className="text-[0.75rem] text-cq-muted">
            Progress saves automatically.
          </p>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* ---------------------------------------------------------- */}
          {/* Audio                                                       */}
          {/* ---------------------------------------------------------- */}
          <Section title="Audio">
            <Slider
              label="Music"
              value={settings.musicVolume}
              onChange={settings.setMusicVolume}
              disabled={settings.muted}
            />
            <Slider
              label="Sound effects"
              value={settings.sfxVolume}
              onChange={settings.setSfxVolume}
              disabled={settings.muted}
            />
            <Toggle
              label="Mute everything"
              checked={settings.muted}
              onChange={settings.toggleMuted}
            />
          </Section>

          {/* ---------------------------------------------------------- */}
          {/* Accessibility                                               */}
          {/* ---------------------------------------------------------- */}
          <Section title="Accessibility">
            <Toggle
              label="Subtitles and full text"
              hint="Show dialogue text in full, never audio-only"
              checked={settings.subtitles}
              onChange={settings.setSubtitles}
            />
            <Toggle
              label="High contrast"
              hint="Stronger borders and brighter text"
              checked={settings.highContrast}
              onChange={settings.setHighContrast}
            />
            <Toggle
              label="Reduce motion"
              hint="Turns off decorative animation"
              checked={settings.reducedMotion === 'reduced'}
              onChange={(value) =>
                settings.setReducedMotion(value ? 'reduced' : 'full')
              }
            />
            <Choice<TextScale>
              label="Text size"
              value={settings.textScale}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'large', label: 'Large' },
                { value: 'xlarge', label: 'Largest' },
              ]}
              onChange={settings.setTextScale}
            />
          </Section>

          {/* ---------------------------------------------------------- */}
          {/* Performance                                                 */}
          {/* ---------------------------------------------------------- */}
          <Section title="Performance">
            <Choice<QualityPreset>
              label="Graphics quality"
              hint="Lower this if the game stutters"
              value={settings.quality}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
              onChange={settings.setQuality}
            />
            <Toggle
              label="Show frame rate"
              checked={settings.showFps}
              onChange={settings.setShowFps}
            />
            <Toggle
              label="Invert camera up/down"
              checked={settings.invertCameraY}
              onChange={settings.setInvertCameraY}
            />
          </Section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-cq-edge/60 bg-cq-deep/40 px-5 py-3.5">
          <div className="flex flex-col items-start gap-0.5">
            <button
              type="button"
              onClick={settings.reset}
              className="text-[0.72rem] text-cq-muted underline decoration-dotted underline-offset-4 hover:text-cq-ink"
            >
              Reset settings
            </button>
            <button
              type="button"
              onClick={onQuit}
              className="text-[0.72rem] text-cq-muted underline decoration-dotted underline-offset-4 hover:text-cq-ink"
            >
              Save &amp; return to title
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPaused(false)}
            className="cq-button cq-button-primary text-[0.9rem]"
          >
            Resume
            <kbd className="ml-1 rounded border border-black/20 px-1.5 py-0.5 text-[0.62rem] font-bold">
              Esc
            </kbd>
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Small form primitives                                                       */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2.5 font-display text-[0.65rem] font-bold tracking-[0.18em] text-cq-muted uppercase">
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function Slider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-3 text-[0.82rem] text-cq-ink">
      <span className="w-28 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-cq-edge accent-cq-accent disabled:opacity-40"
        aria-label={label}
      />
      <span className="w-9 shrink-0 text-right text-[0.72rem] tabular-nums text-cq-muted">
        {Math.round(value * 100)}%
      </span>
    </label>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[0.82rem] text-cq-ink">
      <span className="min-w-0">
        {label}
        {hint ? (
          <span className="block text-[0.68rem] leading-snug text-cq-muted">
            {hint}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-cq-accent' : 'bg-cq-edge',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-4 rounded-full bg-cq-ink transition-transform',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
    </label>
  )
}

function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string
  hint?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[0.82rem] text-cq-ink">
      <span className="min-w-0">
        {label}
        {hint ? (
          <span className="block text-[0.68rem] leading-snug text-cq-muted">
            {hint}
          </span>
        ) : null}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex shrink-0 gap-1 rounded-full border border-cq-edge bg-cq-deep p-0.5"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={[
              'rounded-full px-2.5 py-1 text-[0.72rem] font-semibold transition-colors',
              value === option.value
                ? 'bg-cq-accent text-cq-night'
                : 'text-cq-muted hover:text-cq-ink',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
