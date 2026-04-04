import type { DominoPiece } from './types'

/**
 * Generate all 28 pieces of a double-six domino set.
 */
export function generateDeck(): DominoPiece[] {
  const pieces: DominoPiece[] = []
  let id = 0
  for (let left = 0; left <= 6; left++) {
    for (let right = left; right <= 6; right++) {
      pieces.push({ id, left, right })
      id++
    }
  }
  return pieces
}

/**
 * Fisher-Yates shuffle — mutates in place and returns the array.
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Deal pieces from a shuffled deck.
 * Returns { handA, handB, boneyard }.
 */
export function deal(deck: DominoPiece[]): {
  handA: DominoPiece[]
  handB: DominoPiece[]
  boneyard: DominoPiece[]
} {
  const shuffled = shuffle([...deck])
  return {
    handA: shuffled.slice(0, 7),
    handB: shuffled.slice(7, 14),
    boneyard: shuffled.slice(14),
  }
}
