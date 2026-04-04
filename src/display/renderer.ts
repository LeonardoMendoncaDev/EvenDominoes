import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import {
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  ImageContainerProperty,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  ImageRawDataUpdate,
} from '@evenrealities/even_hub_sdk'

import type { GameState } from '../engine/types'
import {
  RENDER_W,
  RENDER_H,
  RENDER_TILE_W,
  RENDER_TILE_H,
  TILE_COLS,
  TILE_ROWS,
  clearCanvas,
  drawText,
  drawHLine,
  sliceToTiles,
} from './canvas-utils'
import { drawPiece, pieceWidth, pieceHeight } from './pieces'

// ─── Page Mode Tracking ─────────────────────────────────────
type PageMode = 'none' | 'menu' | 'game' | 'rules'

// ─── Renderer ───────────────────────────────────────────────

export class Renderer {
  private bridge: EvenAppBridge
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private prevHashes: number[] = []
  private currentMode: PageMode = 'none'
  private startupCreated = false // tracks if createStartUpPageContainer was called once

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge

    // Create off-screen canvas at render resolution
    this.canvas = document.createElement('canvas')
    this.canvas.width = RENDER_W
    this.canvas.height = RENDER_H
    this.ctx = this.canvas.getContext('2d')!
  }

  // ─── Menu Screen (native list) ────────────────────────────

  async renderMenu(): Promise<void> {
    if (this.currentMode === 'menu') return // already showing menu

    this.prevHashes = []

    const menuItems = ['New Game', 'How to Play']

    const listItem = new ListItemContainerProperty({
      itemCount: menuItems.length,
      itemWidth: 576,
      isItemSelectBorderEn: 1,
      itemName: menuItems,
    })

    const list = new ListContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      containerID: 1,
      containerName: 'menu',
      isEventCapture: 1,
      itemContainer: listItem,
    })

    try {
      if (!this.startupCreated) {
        console.log('[Renderer] Creating startup page...')
        const page = new CreateStartUpPageContainer({
          containerTotalNum: 1,
          listObject: [list],
        })
        const result = await this.bridge.createStartUpPageContainer(page)
        console.log('[Renderer] Startup page created:', JSON.stringify(result))
        this.startupCreated = true
      } else {
        console.log('[Renderer] Rebuilding page for menu...')
        const page = new RebuildPageContainer({
          containerTotalNum: 1,
          listObject: [list],
        })
        await this.bridge.rebuildPageContainer(page)
        console.log('[Renderer] Menu rebuilt')
      }
    } catch (err) {
      console.error('[Renderer] Menu render error:', err)
    }

    this.currentMode = 'menu'
  }

  // ─── Game Screen (canvas-based tiles) ─────────────────────

  async renderGame(state: GameState): Promise<void> {
    // Draw everything to off-screen canvas
    clearCanvas(this.ctx)
    this.drawHeader(state)
    this.drawBoard(state)
    this.drawPrompt(state)
    this.drawHand(state)

    // Send tiles to glasses
    await this.sendTiles()
  }

  // ─── Choose End Screen ────────────────────────────────────

  async renderChooseEnd(state: GameState): Promise<void> {
    clearCanvas(this.ctx)
    this.drawHeader(state)
    this.drawBoard(state)

    const ctx = this.ctx
    const midY = 150

    drawText(ctx, 'Place on which end?', RENDER_W / 2, midY, 20, '#fff', 'center')
    drawText(ctx, 'Click = LEFT', RENDER_W / 2 - 120, midY + 36, 16, '#aaa', 'center')
    drawText(ctx, 'DblClick = RIGHT', RENDER_W / 2 + 120, midY + 36, 16, '#aaa', 'center')

    if (state.selectedPiece) {
      const pw = pieceWidth(2)
      const px = (RENDER_W - pw) / 2
      drawPiece(ctx, px, midY + 68, state.selectedPiece.left, state.selectedPiece.right, true, 2)
    }

    await this.sendTiles()
  }

  // ─── Game Over Screen ─────────────────────────────────────

  async renderGameOver(state: GameState): Promise<void> {
    clearCanvas(this.ctx)
    const ctx = this.ctx

    drawText(ctx, 'GAME OVER', RENDER_W / 2, 30, 28, '#fff', 'center')
    drawHLine(ctx, 60, 66, RENDER_W - 120, '#555')

    const winnerText =
      state.winner === 'human'
        ? 'YOU WIN!'
        : state.winner === 'cpu'
          ? 'CPU WINS'
          : 'DRAW'

    const winColor =
      state.winner === 'human' ? '#fff' : state.winner === 'cpu' ? '#888' : '#aaa'

    drawText(ctx, winnerText, RENDER_W / 2, 85, 30, winColor, 'center')

    drawText(
      ctx,
      `You: ${state.humanScore}  CPU: ${state.cpuScore}`,
      RENDER_W / 2,
      140,
      20,
      '#ccc',
      'center',
    )

    drawText(ctx, state.message, RENDER_W / 2, 180, 16, '#999', 'center')

    drawHLine(ctx, 60, 220, RENDER_W - 120, '#555')
    drawText(ctx, 'Click to play again', RENDER_W / 2, 240, 16, '#aaa', 'center')

    await this.sendTiles()
  }

  // ─── Rules Screen ─────────────────────────────────────────

  async renderRules(): Promise<void> {
    this.prevHashes = []

    const text = new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 8,
      containerID: 1,
      containerName: 'rules',
      isEventCapture: 1,
      content: [
        'HOW TO PLAY DOMINO',
        '━━━━━━━━━━━━━━━━━━',
        '',
        'Match pieces by number.',
        'Scroll ▲▼ to move cursor.',
        'Click to select & place.',
        'Double-click to draw from',
        'the boneyard.',
        '',
        'If both ends match, choose:',
        '  Click = Left end',
        '  DblClick = Right end',
        '',
        'First to empty hand wins!',
        '',
        '━━━━━━━━━━━━━━━━━━',
        'Click to go back.',
      ].join('\n'),
    })

    const page = new RebuildPageContainer({
      containerTotalNum: 1,
      textObject: [text],
    })

    await this.bridge.rebuildPageContainer(page)
    this.currentMode = 'rules'
  }

  // ─── Internal: Draw Sections ──────────────────────────────

  private drawHeader(state: GameState): void {
    const ctx = this.ctx

    drawText(ctx, 'DOMINO', 12, 6, 18, '#888')

    // CPU piece count indicator
    const cpuCount = state.cpu.hand.length
    const cpuLabel = `CPU: ${cpuCount}`
    drawText(ctx, cpuLabel, RENDER_W - 12, 6, 16, '#888', 'right')

    // Score
    drawText(ctx, `${state.humanScore}`, 12, 28, 14, '#666')
    drawText(ctx, `${state.cpuScore}`, RENDER_W - 12, 28, 14, '#666', 'right')

    // Boneyard count
    if (state.boneyard.length > 0) {
      drawText(
        ctx,
        `Bone: ${state.boneyard.length}`,
        RENDER_W / 2,
        6,
        14,
        '#555',
        'center',
      )
    }

    drawHLine(ctx, 0, 46, RENDER_W, '#444')
  }

  private drawBoard(state: GameState): void {
    const ctx = this.ctx
    const board = state.board

    if (board.chain.length === 0) {
      drawText(ctx, 'Empty board', RENDER_W / 2, 100, 18, '#555', 'center')
      drawText(ctx, 'Play any piece to start', RENDER_W / 2, 126, 14, '#444', 'center')
      return
    }

    const BOARD_SCALE = 1.8
    const boardY = 90
    const pw = pieceWidth(BOARD_SCALE)
    const chainLen = board.chain.length
    const GAP = 2
    const MARGIN = 20

    // Calculate how many pieces fit on screen
    const availableW = RENDER_W - MARGIN * 2
    const maxPieces = Math.floor((availableW + GAP) / (pw + GAP))

    if (chainLen <= maxPieces) {
      // ── All pieces fit — draw them adjacent ──
      const totalW = chainLen * pw + (chainLen - 1) * GAP
      const startX = (RENDER_W - totalW) / 2

      for (let i = 0; i < chainLen; i++) {
        const piece = board.chain[i]
        const x = startX + i * (pw + GAP)
        drawPiece(ctx, x, boardY, piece.left, piece.right, false, BOARD_SCALE)
      }
    } else {
      // ── Summary mode: left end ··· count ··· right end ──
      const showEnds = 2 // pieces visible on each side
      const leftPieces = board.chain.slice(0, showEnds)
      const rightPieces = board.chain.slice(-showEnds)

      // Draw left end pieces
      for (let i = 0; i < leftPieces.length; i++) {
        const piece = leftPieces[i]
        const x = MARGIN + i * (pw + GAP)
        drawPiece(ctx, x, boardY, piece.left, piece.right, false, BOARD_SCALE)
      }

      // Connection line with hidden piece count
      const lineStartX = MARGIN + showEnds * (pw + GAP) + 4
      const lineEndX = RENDER_W - MARGIN - showEnds * (pw + GAP) - 4
      const lineY = boardY + pieceHeight(BOARD_SCALE) / 2

      ctx.strokeStyle = '#444'
      ctx.lineWidth = 1
      ctx.setLineDash([6, 6])
      ctx.beginPath()
      ctx.moveTo(lineStartX, lineY)
      ctx.lineTo(lineEndX, lineY)
      ctx.stroke()
      ctx.setLineDash([])

      const hiddenCount = chainLen - showEnds * 2
      if (hiddenCount > 0) {
        drawText(ctx, `${hiddenCount}`, RENDER_W / 2, lineY - 12, 14, '#555', 'center')
      }

      // Draw right end pieces
      for (let i = 0; i < rightPieces.length; i++) {
        const piece = rightPieces[i]
        const x = RENDER_W - MARGIN - (showEnds - i) * (pw + GAP) + GAP
        drawPiece(ctx, x, boardY, piece.left, piece.right, false, BOARD_SCALE)
      }
    }
  }

  private drawPrompt(state: GameState): void {
    const ctx = this.ctx
    const promptY = 215

    drawHLine(ctx, 0, promptY, RENDER_W, '#333')

    let msg = state.message
    if (state.phase === 'playing' && state.currentPlayer === 'human') {
      msg = state.message || 'Click=play  DblClick=draw'
    }

    drawText(ctx, msg, 12, promptY + 6, 14, '#aaa')
  }

  private drawHand(state: GameState): void {
    const ctx = this.ctx
    const hand = state.human.hand
    const HAND_SCALE = 1.3
    const handY = 242
    const pw = pieceWidth(HAND_SCALE)
    const ph = pieceHeight(HAND_SCALE)
    const gap = 8
    const piecesPerRow = Math.floor((RENDER_W - 36) / (pw + gap))

    drawHLine(ctx, 0, handY - 4, RENDER_W, '#333')

    for (let i = 0; i < hand.length; i++) {
      const row = Math.floor(i / piecesPerRow)
      const col = i % piecesPerRow
      const x = 24 + col * (pw + gap)
      const y = handY + row * (ph + gap + 4)

      const isSelected = i === state.cursor && state.currentPlayer === 'human'
      drawPiece(ctx, x, y, hand[i].left, hand[i].right, isSelected, HAND_SCALE)

      // Draw cursor indicator below piece
      if (isSelected) {
        drawText(ctx, '▲', x + pw / 2, y + ph + 2, 10, '#fff', 'center')
      }
    }
  }

  // ─── Internal: Tile Sending ───────────────────────────────

  private async sendTiles(): Promise<void> {
    // Rebuild page to image mode if we're not in game mode yet
    if (this.currentMode !== 'game') {
      await this.createImagePage()
    }

    const tiles = await sliceToTiles(this.canvas)
    const currentHashes = tiles.map((t) => t.hash)

    // Send only changed tiles (tile diffing)
    for (let i = 0; i < tiles.length; i++) {
      if (this.prevHashes[i] !== currentHashes[i]) {
        const tile = tiles[i]
        try {
          const update = new ImageRawDataUpdate({
            containerID: i + 1,
            containerName: `tile${i}`,
            imageData: tile.pngBytes,
          })
          await this.bridge.updateImageRawData(update)
        } catch (err) {
          console.warn(`Tile ${i} send failed:`, err)
        }
      }
    }

    this.prevHashes = currentHashes
  }

  private async createImagePage(): Promise<void> {
    // Create a text container for event capture (invisible, behind images)
    const eventCapture = new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 0,
      paddingLength: 0,
      containerID: 10,
      containerName: 'events',
      content: ' ',
      isEventCapture: 1,
    })

    // Create 4 image containers in a 2×2 grid
    const imageContainers: ImageContainerProperty[] = []
    for (let row = 0; row < TILE_ROWS; row++) {
      for (let col = 0; col < TILE_COLS; col++) {
        const idx = row * TILE_COLS + col
        const img = new ImageContainerProperty({
          xPosition: col * RENDER_TILE_W,
          yPosition: row * RENDER_TILE_H,
          width: RENDER_TILE_W,
          height: RENDER_TILE_H,
          containerID: idx + 1,
          containerName: `tile${idx}`,
        })
        imageContainers.push(img)
      }
    }

    const page = new RebuildPageContainer({
      containerTotalNum: 1 + imageContainers.length,
      textObject: [eventCapture],
      imageObject: imageContainers,
    })

    await this.bridge.rebuildPageContainer(page)
    this.currentMode = 'game'
    this.prevHashes = [] // force full tile update after rebuild
  }
}
