import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";
import { Player } from "@/types/game";

const BOT_NAMES = [
  "Sir Caution",
  "Lady Reckless",
  "The Thinker",
  "Captain Bold",
  "Wise Sage",
  "Daring Knight",
  "Clever Fox",
  "Brave Bear",
];

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function POST(request: NextRequest) {
  try {
    const { gameId } = await request.json();
    console.log("Add bot request for game:", gameId);

    const gameState = await getGame(gameId);

    if (!gameState) {
      console.error("Game not found when adding bot:", gameId);
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (gameState.phase !== "lobby") {
      return NextResponse.json(
        { error: "Game already started" },
        { status: 400 }
      );
    }

    // Pick a random bot name not already used
    const usedNames = gameState.players.map((p: Player) => p.name);
    const availableNames = BOT_NAMES.filter(
      (name) => !usedNames.includes(name)
    );

    if (availableNames.length === 0) {
      return NextResponse.json(
        { error: "No more bot names available" },
        { status: 400 }
      );
    }

    const botName =
      availableNames[Math.floor(Math.random() * availableNames.length)];

    const playerId = generatePlayerId();
    const bot: Player = {
      id: playerId,
      name: botName,
      isAlive: true,
      lives: 3,
      score: 0,
      isBot: true,
    };

    gameState.players.push(bot);
    await setGame(gameId, gameState);

    return NextResponse.json({
      gameState: serializeGameState(gameState),
    });
  } catch (error) {
    console.error("Error adding bot:", error);
    return NextResponse.json({ error: "Failed to add bot" }, { status: 500 });
  }
}

function serializeGameState(gameState: any) {
  return {
    ...gameState,
    puzzle: {
      ...gameState.puzzle,
      revealedLetters: Array.from(gameState.puzzle.revealedLetters),
    },
  };
}
