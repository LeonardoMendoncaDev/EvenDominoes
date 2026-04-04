// ─── G2 Display Constants ───────────────────────────────────

export const CANVAS_W = 576
export const CANVAS_H = 288

export const TILE_COLS = 2
export const TILE_ROWS = 2

// Full-screen rendering — SDK allows up to 288×144 per image container
export const RENDER_W = 576
export const RENDER_H = 288
export const RENDER_TILE_W = RENDER_W / 2 // 288
export const RENDER_TILE_H = RENDER_H / 2 // 144

// ─── PNG Tile Data ──────────────────────────────────────────

export interface TileData {
  index: number
  x: number
  y: number
  width: number
  height: number
  pngBytes: number[]
  hash: number
}

// ─── Tile Slicing (PNG encoded) ─────────────────────────────

/**
 * Slice a canvas into tiles and encode each as PNG bytes.
 * This is the format expected by the G2 SDK/simulator.
 */
export async function sliceToTiles(canvas: HTMLCanvasElement): Promise<TileData[]> {
  const tiles: TileData[] = []

  for (let row = 0; row < TILE_ROWS; row++) {
    for (let col = 0; col < TILE_COLS; col++) {
      const x = col * RENDER_TILE_W
      const y = row * RENDER_TILE_H

      // Create a small canvas for this tile
      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = RENDER_TILE_W
      tileCanvas.height = RENDER_TILE_H
      const tileCtx = tileCanvas.getContext('2d')!

      // Copy the tile region from the main canvas
      tileCtx.drawImage(canvas, x, y, RENDER_TILE_W, RENDER_TILE_H, 0, 0, RENDER_TILE_W, RENDER_TILE_H)

      // Encode as PNG
      const pngBytes = await canvasToPngBytes(tileCanvas)
      const hash = fnv32(pngBytes)

      tiles.push({
        index: row * TILE_COLS + col,
        x,
        y,
        width: RENDER_TILE_W,
        height: RENDER_TILE_H,
        pngBytes,
        hash,
      })
    }
  }

  return tiles
}

// ─── Canvas → PNG Bytes ─────────────────────────────────────

/**
 * Convert canvas content to PNG byte array via toBlob.
 */
function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<number[]> {
  return new Promise((resolve) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          resolve([])
          return
        }
        const buffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        const out: number[] = new Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) {
          out[i] = bytes[i]
        }
        resolve(out)
      },
      'image/png',
    )
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

/**
 * Draw text on canvas with consistent styling for G2.
 */
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

/**
 * Draw a horizontal line.
 */
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

/**
 * Clear the canvas to black (off pixels on G2).
 */
export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, RENDER_W, RENDER_H)
}
