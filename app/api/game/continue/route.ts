import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";
import { generateScenario } from "@/lib/scenario";

export async function POST(request: NextRequest) {
  try {
    const { gameId } = await request.json();

    const gameState = await getGame(gameId);

    if (!gameState) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Move to next player
    const alivePlayers = gameState.players.filter((p: any) => p.isAlive);

    if (alivePlayers.length === 0) {
      // All players eliminated - game over, highest score wins
      gameState.phase = "game-over";
      const winner = [...gameState.players].sort(
        (a: any, b: any) => b.score - a.score
      )[0];
      gameState.winner = winner.id;
    } else if (alivePlayers.length === 1) {
      // One player left - they win
      gameState.phase = "game-over";
      gameState.winner = alivePlayers[0].id;
    } else {
      // Move to next alive player
      let nextIndex =
        (gameState.currentPlayerIndex + 1) % gameState.players.length;

      while (!gameState.players[nextIndex].isAlive) {
        nextIndex = (nextIndex + 1) % gameState.players.length;
      }

      gameState.currentPlayerIndex = nextIndex;
      gameState.phase = "playing";
      gameState.roundNumber++;

      // Track recent scenarios (keep last 5)
      if (!gameState.scenarioHistory) {
        gameState.scenarioHistory = [];
      }

      gameState.scenarioHistory.push(gameState.currentScenario);
      if (gameState.scenarioHistory.length > 5) {
        gameState.scenarioHistory.shift();
      }

      // Generate new scenario
      const newScenario = await generateScenario(gameState.scenarioHistory);
      gameState.currentScenario = newScenario;
    }

    await setGame(gameId, gameState);

    return NextResponse.json({
      gameState: serializeGameState(gameState),
    });
  } catch (error) {
    console.error("Error continuing game:", error);
    return NextResponse.json(
      { error: "Failed to continue game" },
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
