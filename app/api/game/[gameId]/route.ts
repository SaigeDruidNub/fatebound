import { NextRequest, NextResponse } from "next/server";
import { getGame } from "@/lib/gameStore";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const gameState = await getGame(gameId);

    if (!gameState) {
      console.error("Game not found:", gameId);
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Try to get playerId from query string
    const url = new URL(request.url);
    const playerId = url.searchParams.get("playerId");

    let filteredGameState = { ...gameState };
    if (playerId) {
      const player = gameState.players.find((p: any) => p.id === playerId);
      if (
        player &&
        player.canSeeOthers === false &&
        Array.isArray(gameState.actionLog)
      ) {
        // Only show this player's actions
        filteredGameState.actionLog = gameState.actionLog.filter(
          (a: any) => a.playerId === playerId,
        );
      }
    }

    return NextResponse.json(serializeGameState(filteredGameState));
  } catch (error) {
    console.error("Error fetching game:", error);
    return NextResponse.json(
      { error: "Failed to fetch game" },
      { status: 500 },
    );
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
