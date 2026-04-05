// ─── G2 Display Constants ───────────────────────────────────

// G2 SDK hardware limits per image container
export const G2_IMAGE_MAX_W = 200
export const G2_IMAGE_MAX_H = 100

// Tile size: max allowed by G2
export const TILE_W = 200
export const TILE_H = 100

// Board canvas: 400×200 = exactly what 3 tiles cover (no scaling needed)
//   Top tile:         center of top half (200×100, x=100..300, y=0..100)
//   Bottom-left:      left of bottom half (200×100, x=0..200, y=100..200)
//   Bottom-right:     right of bottom half (200×100, x=200..400, y=100..200)
export const RENDER_W = 400
export const RENDER_H = 200

// Tile count: 3 images + 1 text = 4 containers (G2 max)
export const TILE_COUNT = 3

// Positions on the G2 display (576×288) where tiles appear.
// The 400×200 board is centered: offset = (576-400)/2 = 88, (288-200)/2 = 44
const SCREEN_W = 576
const SCREEN_H = 288
const BOARD_OFFSET_X = Math.floor((SCREEN_W - RENDER_W) / 2) // 88
const BOARD_OFFSET_Y = Math.floor((SCREEN_H - RENDER_H) / 2) // 44

// Image container definitions on G2 display
export const IMAGE_TILE_TOP = {
  id: 1,
  name: 'tile-top',
  // Top tile: centered at top = only center 200px visible
  x: BOARD_OFFSET_X + 100,           // 188
  y: BOARD_OFFSET_Y,                  // 44
  width: TILE_W,                       // 200
  height: TILE_H,                     // 100
}

export const IMAGE_TILE_BOTTOM_LEFT = {
  id: 2,
  name: 'tile-bl',
  x: BOARD_OFFSET_X,                  // 88
  y: BOARD_OFFSET_Y + TILE_H,         // 144
  width: TILE_W,                       // 200
  height: TILE_H,                     // 100
}

export const IMAGE_TILE_BOTTOM_RIGHT = {
  id: 3,
  name: 'tile-br',
  x: BOARD_OFFSET_X + TILE_W,         // 288
  y: BOARD_OFFSET_Y + TILE_H,         // 144
  width: TILE_W,                       // 200
  height: TILE_H,                     // 100
}

// Event capture text container
export const EVENT_TEXT_CONTAINER = {
  id: 4,
  name: 'events',
  x: 0,
  y: 0,
  width: BOARD_OFFSET_X > 20 ? BOARD_OFFSET_X : 88,
  height: SCREEN_H,
}

// ─── PNG Tile Data ──────────────────────────────────────────

export interface TileData {
  id: number
  name: string
  pngBytes: number[]
  hash: number
}

// ─── Tile Slicing (1:1 crops from 400×200 canvas) ───────────

/**
 * Slice a 400×200 canvas into 3 tiles at 200×100 each.
 * No scaling — pixel-perfect 1:1 mapping.
 *
 * Layout on canvas:
 *   Row 0 (0..100):   [left 200 invisible] [center 200 = top tile] [right invisible]
 *   Row 1 (100..200):  [left 200 = BL tile] [right 200 = BR tile]
 */
export async function sliceToTiles(canvas: HTMLCanvasElement): Promise<TileData[]> {
  const tiles: TileData[] = []

  // Top tile: center 200×100 of top half (x=100..300, y=0..100)
  tiles.push(await cropToTile(canvas, 100, 0, TILE_W, TILE_H, IMAGE_TILE_TOP.id, IMAGE_TILE_TOP.name))

  // Bottom-left tile (x=0..200, y=100..200)
  tiles.push(await cropToTile(canvas, 0, 100, TILE_W, TILE_H, IMAGE_TILE_BOTTOM_LEFT.id, IMAGE_TILE_BOTTOM_LEFT.name))

  // Bottom-right tile (x=200..400, y=100..200)
  tiles.push(await cropToTile(canvas, 200, 100, TILE_W, TILE_H, IMAGE_TILE_BOTTOM_RIGHT.id, IMAGE_TILE_BOTTOM_RIGHT.name))

  return tiles
}

async function cropToTile(
  source: HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
  id: number, name: string,
): Promise<TileData> {
  const tileCanvas = document.createElement('canvas')
  tileCanvas.width = sw
  tileCanvas.height = sh
  const ctx = tileCanvas.getContext('2d')!
  // 1:1 crop — no scaling
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)

  const pngBytes = await canvasToPngBytes(tileCanvas)
  const hash = fnv32(pngBytes)

  return { id, name, pngBytes, hash }
}

// ─── Canvas → PNG Bytes ─────────────────────────────────────

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<number[]> {
  return new Promise((resolve) => {
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]
      if (!base64) {
        console.error('[canvas-utils] toDataURL returned no data')
        resolve([])
        return
      }
      const binaryString = atob(base64)
      const bytes: number[] = new Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      resolve(bytes)
    } catch (err) {
      console.error('[canvas-utils] PNG encoding failed:', err)
      resolve([])
    }
  })
}

// ─── FNV-32 Hash ────────────────────────────────────────────

function fnv32(data: number[]): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i]
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// ─── Canvas Drawing Helpers ─────────────────────────────────

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number = 14,
  color: string = '#ccc',
  align: CanvasTextAlign = 'left',
): void {
  ctx.font = `bold ${size}px monospace`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillText(text, x, y)
}

export function drawHLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string = '#555',
  lineWidth: number = 1,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + width, y)
  ctx.stroke()
}

export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, RENDER_W, RENDER_H)
}
