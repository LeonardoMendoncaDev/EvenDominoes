// ─── Domino Piece ───────────────────────────────────────────

export interface DominoPiece {
  id: number
  left: number
  right: number
}

// ─── Board ──────────────────────────────────────────────────

export interface BoardState {
  chain: DominoPiece[]
  leftEnd: number
  rightEnd: number
}

// ─── Player ─────────────────────────────────────────────────

export type PlayerType = 'human' | 'cpu'

export interface PlayerState {
  type: PlayerType
  hand: DominoPiece[]
}

// ─── Game Phase ─────────────────────────────────────────────

export type GamePhase =
  | 'menu'
  | 'playing'
  | 'choose-end'
  | 'cpu-thinking'
  | 'gameover'

// ─── Move ───────────────────────────────────────────────────

export type BoardEnd = 'left' | 'right'

export interface Move {
  piece: DominoPiece
  end: BoardEnd
}

// ─── Full Game State ────────────────────────────────────────

export interface GameState {
  phase: GamePhase
  human: PlayerState
  cpu: PlayerState
  board: BoardState
  boneyard: DominoPiece[]
  currentPlayer: PlayerType
  cursor: number
  selectedPiece: DominoPiece | null
  winner: PlayerType | 'draw' | null
  message: string
  humanScore: number
  cpuScore: number
}
