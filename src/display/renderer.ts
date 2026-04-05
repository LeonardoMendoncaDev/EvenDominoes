import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import {
  TextContainerProperty,
  ImageContainerProperty,
  CreateStartUpPageContainer,
  ImageRawDataUpdate,
} from '@evenrealities/even_hub_sdk'

import type { GameState } from '../engine/types'
import {
  RENDER_W,
  RENDER_H,
  TILE_W,
  TILE_H,
  IMAGE_TILE_TOP,
  IMAGE_TILE_BOTTOM_LEFT,
  IMAGE_TILE_BOTTOM_RIGHT,
  EVENT_TEXT_CONTAINER,
  clearCanvas,
  drawText,
  drawHLine,
  sliceToTiles,
} from './canvas-utils'
import { drawPiece, pieceWidth, pieceHeight } from './pieces'

// ─── Layout zones on 400×200 canvas ────────────────────────
// The visible area is:
//   Top tile:    x=100..300, y=0..100  (center 200×100 of top row)
//   Bottom-left: x=0..200,   y=100..200
//   Bottom-right: x=200..400, y=100..200
//
// So: top-center (200×100) + full-width bottom (400×100)
const TOP_CENTER_X = 200  // center of top tile = center of canvas
const BOTTOM_Y = 100
const MID_X = 200 // canvas horizontal center

// ─── Renderer ───────────────────────────────────────────────

export class Renderer {
  private bridge: EvenAppBridge
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private prevHashes: number[] = []

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge

    this.canvas = document.createElement('canvas')
    this.canvas.width = RENDER_W   // 400
    this.canvas.height = RENDER_H  // 200
    this.ctx = this.canvas.getContext('2d')!
  }

  // ─── Startup page: 3 image (200×100) + 1 text ────────────

  async createStartupPage(): Promise<void> {
    const textContainer = new TextContainerProperty({
      xPosition: EVENT_TEXT_CONTAINER.x,
      yPosition: EVENT_TEXT_CONTAINER.y,
      width: EVENT_TEXT_CONTAINER.width,
      height: EVENT_TEXT_CONTAINER.height,
      borderWidth: 0,
      borderColor: 0,
      paddingLength: 0,
      containerID: EVENT_TEXT_CONTAINER.id,
      containerName: EVENT_TEXT_CONTAINER.name,
      content: ' ',
      isEventCapture: 1,
    })

    const imageContainers = [
      IMAGE_TILE_TOP,
      IMAGE_TILE_BOTTOM_LEFT,
      IMAGE_TILE_BOTTOM_RIGHT,
    ].map(tile => new ImageContainerProperty({
      xPosition: tile.x,
      yPosition: tile.y,
      width: tile.width,
      height: tile.height,
      containerID: tile.id,
      containerName: tile.name,
    }))

    console.log(`[Renderer] createStartupPage: 3 images (${TILE_W}×${TILE_H}) + 1 text`)

    const page = new CreateStartUpPageContainer({
      containerTotalNum: 4,
      textObject: [textContainer],
      imageObject: imageContainers,
    })

    try {
      const result = await this.bridge.createStartUpPageContainer(page)
      console.log('[Renderer] Startup page result:', result)
    } catch (err) {
      console.error('[Renderer] Startup page FAILED:', err)
    }
  }

  // ─── Menu Screen ─────────────────────────────────────────
  // Title in top-center tile, options in bottom half

  async renderMenu(cursor: number = 0): Promise<void> {
    this.prevHashes = []
    clearCanvas(this.ctx)
    const ctx = this.ctx

    // Title in top-center tile (visible: x=100..300, y=0..100)
    drawText(ctx, 'DOMINOES', TOP_CENTER_X, 20, 28, '#fff', 'center')

    // Menu items in bottom half (visible: x=0..400, y=100..200)
    const items = ['New Game', 'How to Play']
    items.forEach((item, i) => {
      const y = BOTTOM_Y + 10 + i * 36
      const isSelected = i === cursor
      const color = isSelected ? '#fff' : '#777'
      const prefix = isSelected ? '> ' : '  '
      drawText(ctx, `${prefix}${item}`, MID_X, y, 20, color, 'center')
    })

    drawText(ctx, 'v0.9.0', MID_X, BOTTOM_Y + 82, 12, '#555', 'center')

    await this.sendTiles()
  }

  // ─── Game Screen ──────────────────────────────────────────

  async renderGame(state: GameState): Promise<void> {
    clearCanvas(this.ctx)
    this.drawHeader(state)
    this.drawBoard(state)
    this.drawPrompt(state)
    this.drawHand(state)
    await this.sendTiles()
  }

  // ─── Choose End Screen ────────────────────────────────────

  async renderChooseEnd(state: GameState): Promise<void> {
    clearCanvas(this.ctx)
    this.drawHeader(state)
    this.drawBoard(state)

    const ctx = this.ctx

    drawText(ctx, 'Place on which end?', MID_X, BOTTOM_Y + 10, 16, '#fff', 'center')
    drawText(ctx, 'Click=LEFT', MID_X - 80, BOTTOM_Y + 32, 14, '#aaa', 'center')
    drawText(ctx, 'DblClick=RIGHT', MID_X + 80, BOTTOM_Y + 32, 14, '#aaa', 'center')

    if (state.selectedPiece) {
      const pw = pieceWidth(2)
      const px = (RENDER_W - pw) / 2
      drawPiece(ctx, px, BOTTOM_Y + 52, state.selectedPiece.left, state.selectedPiece.right, true, 2)
    }

    await this.sendTiles()
  }

  // ─── Game Over Screen ─────────────────────────────────────

  async renderGameOver(state: GameState): Promise<void> {
    clearCanvas(this.ctx)
    const ctx = this.ctx

    // Top tile area
    drawText(ctx, 'GAME OVER', TOP_CENTER_X, 10, 22, '#fff', 'center')

    const winnerText =
      state.winner === 'human'
        ? 'YOU WIN!'
        : state.winner === 'cpu'
          ? 'CPU WINS'
          : 'DRAW'
    const winColor =
      state.winner === 'human' ? '#fff' : state.winner === 'cpu' ? '#888' : '#aaa'

    drawText(ctx, winnerText, TOP_CENTER_X, 45, 24, winColor, 'center')
    drawText(ctx, `${state.humanScore} — ${state.cpuScore}`, TOP_CENTER_X, 76, 16, '#ccc', 'center')

    // Bottom area
    drawHLine(ctx, 20, BOTTOM_Y + 4, RENDER_W - 40, '#555')
    drawText(ctx, state.message, MID_X, BOTTOM_Y + 16, 14, '#999', 'center')
    drawText(ctx, 'Click to play again', MID_X, BOTTOM_Y + 60, 16, '#aaa', 'center')

    await this.sendTiles()
  }

  // ─── Rules Screen ─────────────────────────────────────────

  async renderRules(): Promise<void> {
    this.prevHashes = []
    clearCanvas(this.ctx)
    const ctx = this.ctx

    // Top tile
    drawText(ctx, 'HOW TO PLAY', TOP_CENTER_X, 15, 18, '#fff', 'center')
    drawHLine(ctx, 120, 40, 160, '#555')

    // Rules in top tile (small text)
    drawText(ctx, 'Up/Down = Select piece', TOP_CENTER_X, 50, 12, '#aaa', 'center')
    drawText(ctx, 'Click = Play piece', TOP_CENTER_X, 68, 12, '#aaa', 'center')
    drawText(ctx, 'DblClick = Draw', TOP_CENTER_X, 86, 12, '#aaa', 'center')

    // Bottom area
    drawHLine(ctx, 20, BOTTOM_Y + 4, RENDER_W - 40, '#555')
    drawText(ctx, 'Match ends of the chain.', MID_X, BOTTOM_Y + 14, 14, '#aaa', 'center')
    drawText(ctx, 'First to empty hand wins!', MID_X, BOTTOM_Y + 36, 14, '#aaa', 'center')
    drawText(ctx, 'Click to go back', MID_X, BOTTOM_Y + 70, 14, '#777', 'center')

    await this.sendTiles()
  }

  // ─── Internal: Drawing Helpers ────────────────────────────

  private drawHeader(state: GameState): void {
    const ctx = this.ctx
    // Header in top-center tile (visible: x=100..300, y=0..100)
    drawText(ctx, 'DOMINOES', TOP_CENTER_X, 4, 14, '#0f0', 'center')
    drawText(ctx, `You:${state.humanScore}  CPU:${state.cpuScore}`, TOP_CENTER_X, 24, 12, '#aaa', 'center')
    drawText(ctx, `Bone:${state.boneyard.length}  CPU hand:${state.cpu.hand.length}`, TOP_CENTER_X, 40, 10, '#666', 'center')
    drawHLine(ctx, 100, 54, 200, '#333')
  }

  private drawBoard(state: GameState): void {
    const ctx = this.ctx
    const chain = state.board.chain

    if (chain.length === 0) {
      drawText(ctx, 'No pieces played', TOP_CENTER_X, 66, 14, '#555', 'center')
      return
    }

    // Show board in top-center tile
    const BOARD_Y_START = 60
    const PIECE_SCALE = 1.2
    const pw = pieceWidth(PIECE_SCALE)
    const ph = pieceHeight(PIECE_SCALE)
    const gap = 3

    // How many fit in the 200px-wide top tile
    const maxPiecesVisible = Math.floor(180 / (pw + gap))

    if (chain.length <= maxPiecesVisible) {
      const totalW = chain.length * pw + (chain.length - 1) * gap
      const startX = TOP_CENTER_X - totalW / 2
      chain.forEach((piece, i) => {
        const x = startX + i * (pw + gap)
        drawPiece(ctx, x, BOARD_Y_START, piece.left, piece.right, false, PIECE_SCALE)
      })
    } else {
      // Show ends only
      const leftEnd = chain[0]
      const rightEnd = chain[chain.length - 1]
      const hidden = chain.length - 2
      drawPiece(ctx, TOP_CENTER_X - 80, BOARD_Y_START, leftEnd.left, leftEnd.right, false, PIECE_SCALE)
      drawText(ctx, `${hidden}`, TOP_CENTER_X, BOARD_Y_START + ph / 2 - 4, 10, '#555', 'center')
      drawPiece(ctx, TOP_CENTER_X + 50, BOARD_Y_START, rightEnd.left, rightEnd.right, false, PIECE_SCALE)
    }
  }

  private drawPrompt(state: GameState): void {
    const ctx = this.ctx
    // Prompt at top of bottom area
    drawHLine(ctx, 0, BOTTOM_Y, RENDER_W, '#333')

    let msg = state.message
    if (state.phase === 'playing' && state.currentPlayer === 'human') {
      msg = state.message || 'Click=play  DblClick=draw'
    }
    drawText(ctx, msg, MID_X, BOTTOM_Y + 4, 12, '#aaa', 'center')
  }

  private drawHand(state: GameState): void {
    const ctx = this.ctx
    const hand = state.human.hand
    const HAND_SCALE = 1.2
    const handY = BOTTOM_Y + 22
    const pw = pieceWidth(HAND_SCALE)
    const ph = pieceHeight(HAND_SCALE)
    const gap = 6
    const piecesPerRow = Math.floor((RENDER_W - 20) / (pw + gap))

    for (let i = 0; i < hand.length; i++) {
      const row = Math.floor(i / piecesPerRow)
      const col = i % piecesPerRow

      // Center pieces in the row
      const piecesInRow = Math.min(piecesPerRow, hand.length - row * piecesPerRow)
      const rowW = piecesInRow * pw + (piecesInRow - 1) * gap
      const rowStartX = (RENDER_W - rowW) / 2

      const x = rowStartX + col * (pw + gap)
      const y = handY + row * (ph + gap + 2)

      const isSelected = i === state.cursor && state.currentPlayer === 'human'
      drawPiece(ctx, x, y, hand[i].left, hand[i].right, isSelected, HAND_SCALE)

      if (isSelected) {
        drawText(ctx, '▲', x + pw / 2, y + ph + 1, 8, '#fff', 'center')
      }
    }
  }

  // ─── Internal: Tile Sending ───────────────────────────────

  private async sendTiles(): Promise<void> {
    const tiles = await sliceToTiles(this.canvas)
    const currentHashes = tiles.map((t) => t.hash)

    let sentCount = 0
    for (let i = 0; i < tiles.length; i++) {
      if (this.prevHashes[i] !== currentHashes[i]) {
        const tile = tiles[i]
        try {
          const update = new ImageRawDataUpdate({
            containerID: tile.id,
            containerName: tile.name,
            imageData: tile.pngBytes,
          })
          await this.bridge.updateImageRawData(update)
          sentCount++
        } catch (err) {
          console.warn(`[Renderer] Tile ${tile.name} send failed:`, err)
        }
      }
    }

    if (sentCount > 0) {
      console.log(`[Renderer] Sent ${sentCount}/${tiles.length} tiles`)
    }
    this.prevHashes = currentHashes
  }
}
