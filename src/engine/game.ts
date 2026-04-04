import type {
  GameState,
  DominoPiece,
  PlayerType,
  BoardEnd,
  Move,
} from './types'
import { generateDeck, deal } from './deck'
import {
  createBoard,
  playPiece,
  canPlay,
  hasPlayableMove,
  playableEnds,
} from './board'
import { cpuChooseMove } from './cpu'

// ─── Game Factory ───────────────────────────────────────────

export function createGame(): GameState {
  const deck = generateDeck()
  const { handA, handB, boneyard } = deal(deck)

  const state: GameState = {
    phase: 'menu',
    human: { type: 'human', hand: handA },
    cpu: { type: 'cpu', hand: handB },
    board: createBoard(),
    boneyard,
    currentPlayer: 'human',
    cursor: 0,
    selectedPiece: null,
    winner: null,
    message: '',
    humanScore: 0,
    cpuScore: 0,
  }

  return state
}

/**
 * Start a new round — re-deal and determine who goes first.
 */
export function startRound(state: GameState): void {
  const deck = generateDeck()
  const { handA, handB, boneyard } = deal(deck)

  state.human.hand = handA
  state.cpu.hand = handB
  state.boneyard = boneyard
  state.board = createBoard()
  state.cursor = 0
  state.selectedPiece = null
  state.winner = null
  state.phase = 'playing'

  // Who starts? Player with highest double, or human if neither has one
  const humanHighest = highestDouble(handA)
  const cpuHighest = highestDouble(handB)

  if (humanHighest >= 0 && (cpuHighest < 0 || humanHighest >= cpuHighest)) {
    state.currentPlayer = 'human'
    state.message = 'Your turn!'
  } else if (cpuHighest >= 0) {
    state.currentPlayer = 'cpu'
    state.message = 'CPU starts...'
  } else {
    state.currentPlayer = 'human'
    state.message = 'Your turn!'
  }
}

// ─── Human Actions ──────────────────────────────────────────

/**
 * Human selects a piece from hand.
 * Returns the playable ends for that piece, or empty if not playable.
 */
export function selectPiece(state: GameState): BoardEnd[] {
  const piece = state.human.hand[state.cursor]
  if (!piece) {
    console.log('[Game] selectPiece: no piece at cursor', state.cursor)
    return []
  }

  console.log('[Game] selectPiece:', piece.id, `[${piece.left}|${piece.right}]`, 'boardLen:', state.board.chain.length)

  if (!canPlay(piece, state.board)) {
    if (state.boneyard.length > 0) {
      state.message = 'No match! DblClick to draw'
    } else {
      state.message = 'Cannot play this piece!'
    }
    console.log('[Game] Cannot play this piece')
    return []
  }

  // First piece — board is empty, just place it
  if (state.board.chain.length === 0) {
    state.selectedPiece = piece
    executeHumanMove(state, piece, 'left')
    return []
  }

  const ends = playableEnds(piece, state.board)
  state.selectedPiece = piece

  if (ends.length === 1) {
    // Only one option — play immediately
    executeHumanMove(state, piece, ends[0])
    return []
  }

  // Both ends available — enter choose-end phase
  state.phase = 'choose-end'
  state.message = 'Click = Left, Double = Right'
  return ends
}

/**
 * Human places selected piece on a specific end.
 */
export function humanPlaceOnEnd(state: GameState, end: BoardEnd): void {
  if (!state.selectedPiece) return
  executeHumanMove(state, state.selectedPiece, end)
}

/**
 * Human draws a piece from the boneyard.
 */
export function humanDraw(state: GameState): boolean {
  if (state.boneyard.length === 0) {
    if (!hasPlayableMove(state.human.hand, state.board)) {
      state.message = 'No moves. Passing...'
      state.currentPlayer = 'cpu'
      checkGameOver(state)
      return false
    }
    state.message = 'Boneyard empty!'
    return false
  }

  if (hasPlayableMove(state.human.hand, state.board)) {
    state.message = 'You have a playable piece!'
    return false
  }

  const drawn = state.boneyard.pop()!
  state.human.hand.push(drawn)
  state.message = `Drew [${drawn.left}|${drawn.right}]`

  // If the drawn piece can be played, let the player choose
  if (!hasPlayableMove(state.human.hand, state.board)) {
    // Still can't play — try drawing again or auto-draw until can play
    // For simplicity, draw one at a time
  }

  return true
}

// ─── CPU Actions ────────────────────────────────────────────

/**
 * Execute CPU turn. Returns the move made, or null if passed.
 */
export function cpuTurn(state: GameState): Move | null {
  // CPU draws until it can play or boneyard is empty
  while (
    !hasPlayableMove(state.cpu.hand, state.board) &&
    state.boneyard.length > 0
  ) {
    const drawn = state.boneyard.pop()!
    state.cpu.hand.push(drawn)
  }

  const move = cpuChooseMove(state.cpu.hand, state.board)

  if (!move) {
    state.message = 'CPU passes!'
    state.currentPlayer = 'human'
    checkGameOver(state)
    return null
  }

  // Execute the move
  playPiece(move.piece, state.board, move.end)
  state.cpu.hand = state.cpu.hand.filter((p) => p.id !== move.piece.id)

  state.message = `CPU played [${move.piece.left}|${move.piece.right}]`
  state.currentPlayer = 'human'

  if (state.cpu.hand.length === 0) {
    endRound(state, 'cpu')
    return move
  }

  checkGameOver(state)
  return move
}

// ─── Internal Helpers ───────────────────────────────────────

function executeHumanMove(
  state: GameState,
  piece: DominoPiece,
  end: BoardEnd,
): void {
  playPiece(piece, state.board, end)
  state.human.hand = state.human.hand.filter((p) => p.id !== piece.id)
  state.selectedPiece = null
  state.phase = 'playing'

  if (state.cursor >= state.human.hand.length) {
    state.cursor = Math.max(0, state.human.hand.length - 1)
  }

  if (state.human.hand.length === 0) {
    endRound(state, 'human')
    return
  }

  state.message = 'CPU thinking...'
  state.currentPlayer = 'cpu'
  checkGameOver(state)
}

function checkGameOver(state: GameState): void {
  // Game over if both players can't play and boneyard is empty
  if (
    state.boneyard.length === 0 &&
    !hasPlayableMove(state.human.hand, state.board) &&
    !hasPlayableMove(state.cpu.hand, state.board)
  ) {
    // Blocked — lowest pip count wins
    const humanSum = sumHand(state.human.hand)
    const cpuSum = sumHand(state.cpu.hand)

    if (humanSum < cpuSum) {
      endRound(state, 'human')
    } else if (cpuSum < humanSum) {
      endRound(state, 'cpu')
    } else {
      endRound(state, 'draw')
    }
  }
}

function endRound(state: GameState, winner: PlayerType | 'draw'): void {
  state.phase = 'gameover'
  state.winner = winner

  const humanSum = sumHand(state.human.hand)
  const cpuSum = sumHand(state.cpu.hand)

  if (winner === 'human') {
    state.humanScore += cpuSum
    state.message = `You win! +${cpuSum} pts`
  } else if (winner === 'cpu') {
    state.cpuScore += humanSum
    state.message = `CPU wins! +${humanSum} pts`
  } else {
    state.message = 'Draw!'
  }
}

function sumHand(hand: DominoPiece[]): number {
  return hand.reduce((sum, p) => sum + p.left + p.right, 0)
}

function highestDouble(hand: DominoPiece[]): number {
  let highest = -1
  for (const p of hand) {
    if (p.left === p.right && p.left > highest) {
      highest = p.left
    }
  }
  return highest
}
