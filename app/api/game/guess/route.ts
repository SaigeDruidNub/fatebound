import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";

export async function POST(request: NextRequest) {
  try {
    const { gameId, playerId, guess } = await request.json();

    const gameState = await getGame(gameId);

    if (!gameState) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (currentPlayer.id !== playerId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    const correctAnswer = gameState.puzzle.phrase.toUpperCase();
    const playerGuess = guess.toUpperCase().trim();

    if (playerGuess === correctAnswer) {
      // Player wins!
      currentPlayer.score += 100;
      gameState.phase = "game-over";
      gameState.winner = currentPlayer.id;
      await setGame(gameId, gameState);

      return NextResponse.json({
        gameState: serializeGameState(gameState),
        message: `🎉 Correct! ${currentPlayer.name} solved the puzzle!`,
      });
    } else {
      // Wrong guess - player is eliminated
      currentPlayer.isAlive = false;
      const message = `❌ Wrong! The phrase was not "${guess}". You've been eliminated!`;

      // Move to next player
      const alivePlayers = gameState.players.filter((p: any) => p.isAlive);

      if (alivePlayers.length === 0) {
        gameState.phase = "game-over";
        const winner = [...gameState.players].sort(
          (a, b) => b.score - a.score
        )[0];
        gameState.winner = winner.id;
      } else if (alivePlayers.length === 1) {
        gameState.phase = "game-over";
        gameState.winner = alivePlayers[0].id;
      } else {
        let nextIndex =
          (gameState.currentPlayerIndex + 1) % gameState.players.length;
        while (!gameState.players[nextIndex].isAlive) {
          nextIndex = (nextIndex + 1) % gameState.players.length;
        }
        gameState.currentPlayerIndex = nextIndex;
        gameState.phase = "playing";
      }

      await setGame(gameId, gameState);

      return NextResponse.json({
        gameState: serializeGameState(gameState),
        message,
      });
    }
  } catch (error) {
    console.error("Error processing guess:", error);
    return NextResponse.json(
      { error: "Failed to process guess" },
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
