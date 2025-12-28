export type Player = {
  id: string;
  name: string;
  isAlive: boolean;
  lives: number;
  score: number;
  isBot: boolean;
};

export type GamePhase =
  | "lobby"
  | "playing"
  | "letter-selection"
  | "waiting-continue"
  | "game-over";

export type PuzzleDifficulty = "easy" | "medium" | "hard" | "very-hard";

export interface GameState {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  puzzle: {
    phrase: string;
    category: string;
    revealedLetters: Set<string>;
    difficulty: PuzzleDifficulty;
  };
  currentScenario: string;
  scenarioHistory: string[];
  roundNumber: number;
  winner: string | null;
  createdAt: number;
}

export type ActionResult = {
  success: boolean;
  outcome: string;
  nextScenario?: string;
};

export type LeaderboardEntry = {
  playerName: string;
  score: number;
  difficulty: PuzzleDifficulty;
  date: number;
  gameId: string;
};
