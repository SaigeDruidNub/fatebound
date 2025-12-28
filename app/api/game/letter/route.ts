import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";

async function generateScenario(recentScenarios: string[] = []) {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/api/generate-scenario`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recentScenarios }),
      }
    );
    const data = await response.json();
    return data.scenario;
  } catch (error) {
    return "You find yourself facing a new challenge. The path ahead is uncertain. What do you do?";
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gameId, playerId, letter } = await request.json();
    console.log("Letter submission:", { gameId, playerId, letter });

    const gameState = await getGame(gameId);

    if (!gameState) {
      console.error("Game not found for letter submission:", gameId);
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Ensure revealedLetters is a Set
    if (Array.isArray(gameState.puzzle.revealedLetters)) {
      gameState.puzzle.revealedLetters = new Set(
        gameState.puzzle.revealedLetters
      );
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (currentPlayer.id !== playerId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    const upperLetter = letter.toUpperCase();

    // Check if letter is in the puzzle
    const isInPuzzle = gameState.puzzle.phrase
      .toUpperCase()
      .includes(upperLetter);

    let message = "";

    if (isInPuzzle) {
      gameState.puzzle.revealedLetters.add(upperLetter);
      const count = (
        gameState.puzzle.phrase.match(new RegExp(upperLetter, "g")) || []
      ).length;
      currentPlayer.score += count * 5;
      message = `Great! There ${
        count === 1 ? "is" : "are"
      } ${count} ${upperLetter}'${count === 1 ? "" : "s"} in the puzzle!`;
    } else {
      message = `Sorry, there are no ${upperLetter}'s in the puzzle.`;
    }

    // Move to next player
    await moveToNextPlayer(gameState);

    await setGame(gameId, gameState);

    return NextResponse.json({
      gameState: serializeGameState(gameState),
      message,
    });
  } catch (error) {
    console.error("Error processing letter:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return NextResponse.json(
      { error: "Failed to process letter" },
      { status: 500 }
    );
  }
}

async function moveToNextPlayer(gameState: any) {
  const alivePlayers = gameState.players.filter((p: any) => p.isAlive);

  if (alivePlayers.length === 0) {
    gameState.phase = "game-over";
    const winner = [...gameState.players].sort((a, b) => b.score - a.score)[0];
    gameState.winner = winner.id;
    return;
  }

  if (alivePlayers.length === 1) {
    gameState.phase = "game-over";
    gameState.winner = alivePlayers[0].id;
    return;
  }

  let nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

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

  gameState.currentScenario = await generateScenario(gameState.scenarioHistory);
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
