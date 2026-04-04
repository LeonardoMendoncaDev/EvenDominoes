import { waitForEvenAppBridge, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import type { GameState, GamePhase, PlayerType } from './engine/types'
import { createGame, startRound, selectPiece, humanPlaceOnEnd, humanDraw, cpuTurn } from './engine/game'
import { Renderer } from './display/renderer'

// ─── Debug output ───────────────────────────────────────────

const debugEl = document.getElementById('debug')
function debug(msg: string): void {
  console.log(`[Domino] ${msg}`)
  if (debugEl) debugEl.textContent = msg
}

// ─── Main Entrypoint ────────────────────────────────────────

async function main(): Promise<void> {
  debug('Waiting for EvenAppBridge...')

  const bridge = await waitForEvenAppBridge()
  debug('Bridge connected!')

  const renderer = new Renderer(bridge)
  const state: GameState = createGame()

  // Menu item index for list-based menu
  let menuCursor = 0

  // ── Render current state ──
  async function render(): Promise<void> {
    const phase: GamePhase = state.phase
    switch (phase) {
      case 'menu':
        await renderer.renderMenu()
        break
      case 'playing':
      case 'cpu-thinking':
        await renderer.renderGame(state)
        break
      case 'choose-end':
        await renderer.renderChooseEnd(state)
        break
      case 'gameover':
        await renderer.renderGameOver(state)
        break
    }
  }

  // ── CPU turn with delay ──
  async function doCpuTurn(): Promise<void> {
    state.phase = 'cpu-thinking'
    state.message = 'CPU thinking...'
    await render()

    // Small delay so the player can see "CPU thinking..."
    await sleep(800)

    cpuTurn(state)

    if (state.phase !== 'gameover' as GamePhase) {
      state.phase = 'playing'
      if (state.currentPlayer === 'human') {
        state.message = 'Your turn!'
      }
    }

    await render()

    // If CPU plays and it's still CPU's turn
    if (state.currentPlayer === 'cpu' && state.phase === ('playing' as GamePhase)) {
      await doCpuTurn()
    }
  }

  // ── Start game ──
  async function startNewGame(): Promise<void> {
    startRound(state)
    state.phase = 'playing'
    await render()

    // If CPU starts
    if (state.currentPlayer === 'cpu') {
      await doCpuTurn()
    }
  }

  // ── Event detection helpers (confirmed from archpilot-g2-plugin) ──
  function isClick(event: any): boolean {
    // Click: sysEvent with eventType=undefined but eventSource present
    if (event.sysEvent && event.sysEvent.eventType === undefined && event.sysEvent.eventSource !== undefined) return true
    // Fallback: textEvent or listEvent with CLICK_EVENT
    if (event.textEvent?.eventType === OsEventTypeList.CLICK_EVENT) return true
    if (event.listEvent?.eventType === OsEventTypeList.CLICK_EVENT) return true
    // ListContainer may send clicks with eventType=undefined
    if (event.listEvent && event.listEvent.eventType === undefined) return true
    return false
  }

  function isDoubleClick(event: any): boolean {
    // DblClick: sysEvent.eventType = 3
    if (event.sysEvent?.eventType === 3) return true
    if (event.textEvent?.eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) return true
    if (event.listEvent?.eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) return true
    return false
  }

  function isScrollUp(event: any): boolean {
    return event.textEvent?.eventType === OsEventTypeList.SCROLL_TOP_EVENT ||
           event.listEvent?.eventType === OsEventTypeList.SCROLL_TOP_EVENT
  }

  function isScrollDown(event: any): boolean {
    return event.textEvent?.eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
           event.listEvent?.eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT
  }

  let isRulesScreen = false

  // ── Event handling ──
  bridge.onEvenHubEvent(async (event) => {
    try {
      // ── Menu ──
      if (state.phase === 'menu' && !isRulesScreen) {
        if (isScrollUp(event)) {
          menuCursor = Math.max(0, menuCursor - 1)
        } else if (isScrollDown(event)) {
          menuCursor = Math.min(1, menuCursor + 1)
        } else if (isClick(event)) {
          const selectedIdx = event.listEvent?.currentSelectItemIndex ?? menuCursor
          if (selectedIdx === 0) {
            await startNewGame()
          } else if (selectedIdx === 1) {
            isRulesScreen = true
            await renderer.renderRules()
          }
        }
        return
      }

      // ── Rules screen — any click/double goes back ──
      if (isRulesScreen) {
        if (isClick(event) || isDoubleClick(event)) {
          isRulesScreen = false
          state.phase = 'menu'
          await render()
        }
        return
      }

      // ── Game Over ──
      if (state.phase === 'gameover') {
        if (isClick(event)) {
          await startNewGame()
        } else if (isDoubleClick(event)) {
          state.phase = 'menu'
          menuCursor = 0
          await render()
        }
        return
      }

      // ── Choose End ──
      if (state.phase === 'choose-end') {
        if (isClick(event)) {
          humanPlaceOnEnd(state, 'left')
          await render()
          if (state.currentPlayer === 'cpu' && state.phase === ('playing' as GamePhase)) {
            await doCpuTurn()
          }
        } else if (isDoubleClick(event)) {
          humanPlaceOnEnd(state, 'right')
          await render()
          if (state.currentPlayer === 'cpu' && state.phase === ('playing' as GamePhase)) {
            await doCpuTurn()
          }
        }
        return
      }

      // ── Playing (human turn) ──
      if (state.phase === 'playing' && state.currentPlayer === 'human') {
        if (isScrollUp(event)) {
          state.cursor = Math.max(0, state.cursor - 1)
          await render()
        } else if (isScrollDown(event)) {
          state.cursor = Math.min(state.human.hand.length - 1, state.cursor + 1)
          await render()
        } else if (isClick(event)) {
          selectPiece(state)
          await render()
          if (
            (state.currentPlayer as PlayerType) === 'cpu' &&
            state.phase === ('playing' as GamePhase)
          ) {
            await doCpuTurn()
          }
        } else if (isDoubleClick(event)) {
          humanDraw(state)
          await render()
          if (
            (state.currentPlayer as PlayerType) === 'cpu' &&
            state.phase === ('playing' as GamePhase)
          ) {
            await doCpuTurn()
          }
        }
        return
      }

      // ── Lifecycle events ──
      const sysEvent = event.sysEvent
      if (sysEvent) {
        if (sysEvent.eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
          debug('Foreground enter — refreshing display')
          await render()
        }
      }
    } catch (err) {
      debug(`Error: ${err}`)
      console.error('[Domino] Event handler error:', err)
    }
  })

  // ── Initial render ──
  state.phase = 'menu'
  await render()
  debug('Game ready!')
}

// ─── Helpers ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Launch ─────────────────────────────────────────────────

main().catch((err) => {
  debug(`Fatal: ${err}`)
  console.error('[Domino] Fatal error:', err)
})
