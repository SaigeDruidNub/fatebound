import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";
import { GameState, Player } from "@/types/game";

function generateGameId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 15);
}

async function generatePuzzle() {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/api/generate-puzzle`,
      { method: "POST" }
    );
    return await response.json();
  } catch (error) {
    return { phrase: "SEEK THE ANCIENT ARTIFACT", category: "Epic Quest" };
  }
}

async function generateScenario() {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/api/generate-scenario`,
      { method: "POST" }
    );
    const data = await response.json();
    return data.scenario;
  } catch (error) {
    return "You find yourself at the entrance of a dark dungeon. The air is thick with mystery and danger. A flickering torch lights the stone corridor ahead. What do you do?";
  }
}

export async function POST(request: NextRequest) {
  try {
    const { playerName } = await request.json();

    const gameId = generateGameId();
    const playerId = generatePlayerId();
    const puzzle = await generatePuzzle();
    const scenario = await generateScenario();

    const player: Player = {
      id: playerId,
      name: playerName,
      isAlive: true,
      lives: 3,
      score: 0,
      isBot: false,
    };

    const gameState: GameState = {
      id: gameId,
      players: [player],
      currentPlayerIndex: 0,
      phase: "lobby",
      puzzle: {
        phrase: puzzle.phrase,
        category: puzzle.category,
        revealedLetters: new Set(),
      },
      currentScenario: scenario,
      roundNumber: 1,
      winner: null,
      createdAt: Date.now(),
    };

    setGame(gameId, gameState);

    return NextResponse.json({
      gameId,
      playerId,
      gameState: serializeGameState(gameState),
    });
  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 }
    );
  }
}

function serializeGameState(gameState: GameState) {
  return {
    ...gameState,
    puzzle: {
      ...gameState.puzzle,
      revealedLetters: Array.from(gameState.puzzle.revealedLetters),
    },
  };
}
