import type { DominoPiece, BoardEnd, BoardState } from './types'

/**
 * Create an empty board.
 */
export function createBoard(): BoardState {
  return {
    chain: [],
    leftEnd: -1,
    rightEnd: -1,
  }
}

/**
 * Check if a piece can be played on a given end of the board.
 */
export function canPlayOnEnd(
  piece: DominoPiece,
  board: BoardState,
  end: BoardEnd,
): boolean {
  if (board.chain.length === 0) return true

  const target = end === 'left' ? board.leftEnd : board.rightEnd
  return piece.left === target || piece.right === target
}

/**
 * Check if a piece can be played on either end.
 */
export function canPlay(piece: DominoPiece, board: BoardState): boolean {
  return canPlayOnEnd(piece, board, 'left') || canPlayOnEnd(piece, board, 'right')
}

/**
 * Check which ends a piece can be played on.
 */
export function playableEnds(
  piece: DominoPiece,
  board: BoardState,
): BoardEnd[] {
  const ends: BoardEnd[] = []
  if (canPlayOnEnd(piece, board, 'left')) ends.push('left')
  if (canPlayOnEnd(piece, board, 'right')) ends.push('right')
  return ends
}

/**
 * Play a piece on the board. Returns the oriented piece that was placed.
 * The piece is oriented so the matching value faces the board end.
 */
export function playPiece(
  piece: DominoPiece,
  board: BoardState,
  end: BoardEnd,
): DominoPiece {
  if (board.chain.length === 0) {
    // First piece — place as-is
    board.chain.push(piece)
    board.leftEnd = piece.left
    board.rightEnd = piece.right
    return piece
  }

  const target = end === 'left' ? board.leftEnd : board.rightEnd

  // Orient the piece so the matching side faces the board
  let oriented: DominoPiece
  if (end === 'left') {
    if (piece.right === target) {
      oriented = { ...piece }
    } else {
      oriented = { id: piece.id, left: piece.right, right: piece.left }
    }
    board.chain.unshift(oriented)
    board.leftEnd = oriented.left
  } else {
    if (piece.left === target) {
      oriented = { ...piece }
    } else {
      oriented = { id: piece.id, left: piece.right, right: piece.left }
    }
    board.chain.push(oriented)
    board.rightEnd = oriented.right
  }

  return oriented
}

/**
 * Check if a player has any playable piece.
 */
export function hasPlayableMove(
  hand: DominoPiece[],
  board: BoardState,
): boolean {
  return hand.some((piece) => canPlay(piece, board))
}
