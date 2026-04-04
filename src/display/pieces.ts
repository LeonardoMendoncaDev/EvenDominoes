// ─── Domino Piece Renderer ──────────────────────────────────
// Draws domino pieces on an HTML canvas with authentic pip patterns.
// Optimised for 4-bit greyscale G2 display.

// ─── Size constants ─────────────────────────────────────────

export const PIECE_W = 36 // Full piece width (both halves)
export const PIECE_H = 20 // Full piece height
export const HALF_W = 16 // Each half-piece width
export const PIP_R = 2 // Pip (dot) radius
export const BORDER_R = 2 // Corner radius
export const DIVIDER_GAP = 2 // Gap for the centre divider

// ─── Pip Position Maps ──────────────────────────────────────
// Positions are relative to a half-cell of HALF_W × PIECE_H.
// We define 7 possible positions in a 3×3 grid:
//   TL  TC  TR
//   ML  MC  MR
//   BL  BC  BR

interface Pos {
  x: number
  y: number
}

function pipPositions(halfW: number, h: number): Record<string, Pos> {
  const px = halfW / 4
  const py = h / 4
  return {
    TL: { x: px, y: py },
    TR: { x: halfW - px, y: py },
    ML: { x: px, y: h / 2 },
    MC: { x: halfW / 2, y: h / 2 },
    MR: { x: halfW - px, y: h / 2 },
    BL: { x: px, y: h - py },
    BR: { x: halfW - px, y: h - py },
  }
}

// Which positions to draw for each value (0-6)
const PIP_LAYOUTS: Record<number, string[]> = {
  0: [],
  1: ['MC'],
  2: ['TR', 'BL'],
  3: ['TR', 'MC', 'BL'],
  4: ['TL', 'TR', 'BL', 'BR'],
  5: ['TL', 'TR', 'MC', 'BL', 'BR'],
  6: ['TL', 'TR', 'ML', 'MR', 'BL', 'BR'],
}

// ─── Drawing ────────────────────────────────────────────────

/**
 * Draw a complete domino piece at (x, y) on the canvas.
 *
 * @param ctx      Canvas 2D context
 * @param x        Top-left X
 * @param y        Top-left Y
 * @param left     Left half value (0-6)
 * @param right    Right half value (0-6)
 * @param highlighted  Whether this piece is selected/highlighted
 * @param scale    Optional scale multiplier (default 1)
 */
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  left: number,
  right: number,
  highlighted: boolean = false,
  scale: number = 1,
): void {
  const w = PIECE_W * scale
  const h = PIECE_H * scale
  const hw = HALF_W * scale
  const pr = PIP_R * scale
  const br = BORDER_R * scale

  // ── Background rectangle with rounded corners ──
  ctx.fillStyle = highlighted ? '#3a3a3a' : '#1a1a1a'
  ctx.strokeStyle = highlighted ? '#fff' : '#888'
  ctx.lineWidth = highlighted ? 2 : 1

  roundRect(ctx, x, y, w, h, br)
  ctx.fill()
  ctx.stroke()

  // ── Centre divider line ──
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + hw + DIVIDER_GAP * scale / 2, y + 2)
  ctx.lineTo(x + hw + DIVIDER_GAP * scale / 2, y + h - 2)
  ctx.stroke()

  // ── Draw pips for left half ──
  const positions = pipPositions(hw, h)
  const leftPips = PIP_LAYOUTS[left] || []
  const rightPips = PIP_LAYOUTS[right] || []

  ctx.fillStyle = highlighted ? '#fff' : '#ddd'

  for (const key of leftPips) {
    const pos = positions[key]
    drawPip(ctx, x + pos.x, y + pos.y, pr)
  }

  // ── Draw pips for right half (offset by halfW + divider) ──
  const rightOffsetX = x + hw + DIVIDER_GAP * scale

  for (const key of rightPips) {
    const pos = positions[key]
    drawPip(ctx, rightOffsetX + pos.x, y + pos.y, pr)
  }
}

/**
 * Draw a single pip (dot).
 */
function drawPip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Draw a rounded rectangle path.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/**
 * Get the total rendered width of a piece (including divider gap).
 */
export function pieceWidth(scale: number = 1): number {
  return (PIECE_W + DIVIDER_GAP) * scale
}

/**
 * Get the total rendered height of a piece.
 */
export function pieceHeight(scale: number = 1): number {
  return PIECE_H * scale
}
