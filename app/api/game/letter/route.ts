import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";
import { generateScenario } from "@/lib/scenario";

export async function POST(request: NextRequest) {
  try {
    const { gameId, playerId, letter } = await request.json();

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

    // Ensure selectedLetters is an array
    if (!Array.isArray(gameState.selectedLetters)) {
      gameState.selectedLetters = [];
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (currentPlayer.id !== playerId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    const upperLetter = letter.toUpperCase();

    // Prevent duplicate guesses
    if (gameState.selectedLetters.includes(upperLetter)) {
      return NextResponse.json(
        {
          error: `The letter ${upperLetter} has already been guessed.`,
          gameState: serializeGameState(gameState),
        },
        { status: 400 }
      );
    }

    // Add to selectedLetters
    gameState.selectedLetters.push(upperLetter);

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

      // Check if all letters in the puzzle have been revealed
      const puzzleLetters = new Set(
        gameState.puzzle.phrase
          .toUpperCase()
          .split("")
          .filter((char: string) => /[A-Z]/.test(char))
      );

      const allLettersRevealed = Array.from(puzzleLetters).every((letter) =>
        gameState.puzzle.revealedLetters.has(letter)
      );

      if (allLettersRevealed) {
        // All letters revealed - player wins!
        currentPlayer.score += 100;
        gameState.phase = "game-over";
        gameState.winner = currentPlayer.id;
        message += ` 🎉 All letters revealed! ${currentPlayer.name} wins!`;

        await setGame(gameId, gameState);
        return NextResponse.json({
          gameState: serializeGameState(gameState),
          message,
        });
      }
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

  const newScenario = await generateScenario(gameState.scenarioHistory);
  gameState.currentScenario = newScenario;
}

function serializeGameState(gameState: any) {
  return {
    ...gameState,
    selectedLetters: Array.from(gameState.selectedLetters || []),
    puzzle: {
      ...gameState.puzzle,
      revealedLetters: Array.from(gameState.puzzle.revealedLetters),
    },
  };
}
