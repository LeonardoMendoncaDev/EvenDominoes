// ─── G2 Audio Feedback ──────────────────────────────────────
// Short beeps via AudioContext. If the G2 routes WebView audio
// to its built-in speaker, the user hears them directly in the glasses.

let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  if (audioCtx) return audioCtx
  try {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
    return audioCtx
  } catch {
    return null
  }
}

/**
 * Play a short beep tone.
 * @param freq  Frequency in Hz (higher = more "sharp")
 * @param durationMs  Duration in milliseconds
 * @param volume  Volume 0..1
 */
export function beep(freq: number = 800, durationMs: number = 60, volume: number = 0.3): void {
  const ctx = getAudioCtx()
  if (!ctx) return

  // Resume if suspended (autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'square'
  osc.frequency.value = freq
  gain.gain.value = volume

  osc.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  osc.start(now)
  // Quick fade-out to avoid click/pop
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
  osc.stop(now + durationMs / 1000 + 0.01)
}

// ─── Preset Sounds ──────────────────────────────────────────

/** Piece selected / tap confirm */
export function beepTap(): void {
  beep(900, 40, 0.25)
}

/** Piece played successfully */
export function beepPlay(): void {
  beep(1200, 50, 0.3)
}

/** Draw from boneyard */
export function beepDraw(): void {
  beep(600, 50, 0.2)
}

/** Error / invalid move */
export function beepError(): void {
  beep(300, 120, 0.3)
}

/** Game over */
export function beepGameOver(): void {
  beep(500, 200, 0.3)
  setTimeout(() => beep(400, 200, 0.25), 250)
}

/** Win! */
export function beepWin(): void {
  beep(800, 80, 0.3)
  setTimeout(() => beep(1000, 80, 0.3), 120)
  setTimeout(() => beep(1200, 150, 0.35), 260)
}

/** Menu navigation */
export function beepNav(): void {
  beep(700, 25, 0.15)
}
