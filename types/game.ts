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

export interface GameState {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  puzzle: {
    phrase: string;
    category: string;
    revealedLetters: Set<string>;
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
