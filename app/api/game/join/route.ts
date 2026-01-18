import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";
import { Player } from "@/types/game";

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function POST(request: NextRequest) {
  try {
    const { gameId, playerName, canSeeOthers } = await request.json();
    if (
      !playerName ||
      typeof playerName !== "string" ||
      playerName.length > 20
    ) {
      return NextResponse.json(
        { error: "Player name must be 1-20 characters." },
        { status: 400 },
      );
    }

    const gameState = await getGame(gameId);

    if (!gameState) {
      console.error(`❌ Game ${gameId} not found`);
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (gameState.phase !== "lobby") {
      console.error(
        `❌ Game ${gameId} already started (phase: ${gameState.phase})`,
      );
      return NextResponse.json(
        { error: "Game already started" },
        { status: 400 },
      );
    }

    const playerId = generatePlayerId();
    const player: Player = {
      id: playerId,
      name: playerName,
      isAlive: true,
      lives: 3,
      score: 0,
      isBot: false,
      canSeeOthers: canSeeOthers === false ? false : true,
    };

    gameState.players.push(player);
    await setGame(gameId, gameState);

    return NextResponse.json({
      playerId,
      gameState: serializeGameState(gameState),
    });
  } catch (error) {
    console.error("Error joining game:", error);
    return NextResponse.json({ error: "Failed to join game" }, { status: 500 });
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
