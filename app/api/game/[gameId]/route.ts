import { NextRequest, NextResponse } from "next/server";
import { getGame } from "@/lib/gameStore";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    console.log("Fetching game state for:", gameId);
    const gameState = await getGame(gameId);

    if (!gameState) {
      console.error("Game not found:", gameId);
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json(serializeGameState(gameState));
  } catch (error) {
    console.error("Error fetching game:", error);
    return NextResponse.json(
      { error: "Failed to fetch game" },
      { status: 500 }
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
