import type { DominoPiece, BoardState, Move } from './types'
import { canPlay, playableEnds } from './board'

/**
 * CPU AI — picks the best move from hand.
 *
 * Strategy priority:
 *   1. Play doubles first (get rid of them)
 *   2. Among playable pieces, pick the one with the highest pip sum
 *   3. If can play on both ends, prefer the end that keeps more options
 *
 * Returns null if no move is possible (must draw or pass).
 */
export function cpuChooseMove(
  hand: DominoPiece[],
  board: BoardState,
): Move | null {
  // Find all playable pieces
  const playable = hand
    .filter((p) => canPlay(p, board))
    .map((piece) => {
      const ends = playableEnds(piece, board)
      const isDouble = piece.left === piece.right
      const sum = piece.left + piece.right
      return { piece, ends, isDouble, sum }
    })

  if (playable.length === 0) return null

  // Sort: doubles first, then highest sum
  playable.sort((a, b) => {
    if (a.isDouble !== b.isDouble) return a.isDouble ? -1 : 1
    return b.sum - a.sum
  })

  const best = playable[0]

  // Pick end — prefer the end that uses the higher value of the piece
  // This heuristic tends to leave more versatile values on the board
  let end = best.ends[0]
  if (best.ends.length === 2) {
    // If the piece can go on both ends, prefer the end where the
    // board-facing value is higher (saves lower values for later)
    const leftTarget = board.leftEnd
    const rightTarget = board.rightEnd
    // Play on the end with the higher target — this uses a high match
    end = leftTarget >= rightTarget ? 'left' : 'right'
  }

  return { piece: best.piece, end }
}
