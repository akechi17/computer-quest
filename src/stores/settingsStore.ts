import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TextScale = 'normal' | 'large' | 'xlarge'
export type MotionPreference = 'full' | 'reduced'
export type QualityPreset = 'low' | 'medium' | 'high'

export interface SettingsState {
  /* Audio (spec §31) */
  musicVolume: number
  sfxVolume: number
  muted: boolean

  /* Accessibility (spec §32) */
  subtitles: boolean
  highContrast: boolean
  reducedMotion: MotionPreference
  textScale: TextScale

  /* Performance */
  quality: QualityPreset
  showFps: boolean

  /* Control hints */
  invertCameraY: boolean

  setMusicVolume: (value: number) => void
  setSfxVolume: (value: number) => void
  toggleMuted: () => void
  setSubtitles: (value: boolean) => void
  setHighContrast: (value: boolean) => void
  setReducedMotion: (value: MotionPreference) => void
  setTextScale: (value: TextScale) => void
  setQuality: (value: QualityPreset) => void
  setShowFps: (value: boolean) => void
  setInvertCameraY: (value: boolean) => void
  reset: () => void
}

const TEXT_SCALE_VALUES: Record<TextScale, string> = {
  normal: '1',
  large: '1.15',
  xlarge: '1.3',
}

/** Applies accessibility preferences to the document root so CSS can react. */
export function applySettingsToDom(state: {
  highContrast: boolean
  reducedMotion: MotionPreference
  textScale: TextScale
}): void {
  const root = document.documentElement
  root.dataset.contrast = state.highContrast ? 'high' : 'normal'
  root.dataset.motion = state.reducedMotion === 'reduced' ? 'reduced' : 'full'
  root.style.setProperty('--cq-text-scale', TEXT_SCALE_VALUES[state.textScale])
}

const DEFAULTS = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muted: false,
  subtitles: true,
  highContrast: false,
  reducedMotion: 'full' as MotionPreference,
  textScale: 'normal' as TextScale,
  quality: 'medium' as QualityPreset,
  showFps: false,
  invertCameraY: false,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setMusicVolume: (value) => set({ musicVolume: value }),
      setSfxVolume: (value) => set({ sfxVolume: value }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setSubtitles: (value) => set({ subtitles: value }),
      setHighContrast: (value) => set({ highContrast: value }),
      setReducedMotion: (value) => set({ reducedMotion: value }),
      setTextScale: (value) => set({ textScale: value }),
      setQuality: (value) => set({ quality: value }),
      setShowFps: (value) => set({ showFps: value }),
      setInvertCameraY: (value) => set({ invertCameraY: value }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'computer-quest:settings',
      version: 1,
      partialize: (state) => ({
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        muted: state.muted,
        subtitles: state.subtitles,
        highContrast: state.highContrast,
        reducedMotion: state.reducedMotion,
        textScale: state.textScale,
        quality: state.quality,
        showFps: state.showFps,
        invertCameraY: state.invertCameraY,
      }),
    },
  ),
)
