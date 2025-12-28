import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, playerId, action } = body;

    console.log("Action request:", {
      gameId,
      playerId,
      actionLength: action?.length,
    });

    if (!gameId || !playerId || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const gameState = getGame(gameId);

    if (!gameState) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (!currentPlayer) {
      return NextResponse.json({ error: "No current player" }, { status: 400 });
    }

    if (currentPlayer.id !== playerId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    // Call AI to determine outcome
    const result = await evaluateAction(action, gameState.currentScenario);

    let outcome = result.outcome;

    if (result.success) {
      // Player succeeded - move to letter selection phase
      currentPlayer.score += 10;
      gameState.phase = "letter-selection";
      outcome += " You survived this challenge!";
    } else {
      // Player failed - lose a life
      currentPlayer.lives -= 1;

      if (currentPlayer.lives <= 0) {
        currentPlayer.isAlive = false;
        outcome += " You lost a life and have been eliminated!";
      } else {
        outcome += ` You lost a life! ${currentPlayer.lives} ${
          currentPlayer.lives === 1 ? "life" : "lives"
        } remaining.`;
      }

      // Don't auto-advance - wait for continue button
      gameState.phase = "waiting-continue";
    }

    setGame(gameId, gameState);

    return NextResponse.json({
      gameState: serializeGameState(gameState),
      outcome,
    });
  } catch (error: any) {
    console.error("Error processing action:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process action" },
      { status: 500 }
    );
  }
}

async function evaluateAction(
  action: string,
  scenario: string
): Promise<{ success: boolean; outcome: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Fallback logic
    return evaluateActionFallback(action);
  }

  try {
    const systemPrompt = `You are judging a player's action in an adventure game. The player must survive challenges.

Rules:
- Evaluate if their action is smart, cautious, and likely to succeed
- Be fair but challenging - clever actions should succeed, reckless ones should fail
- Consider creativity and caution
- Respond with a JSON object: { "success": true/false, "outcome": "description of what happens" }
- Keep outcome concise (2-3 sentences)
- Make it dramatic and engaging`;

    const userPrompt = `Scenario: ${scenario}
Player's action: ${action}

Judge if they succeed or fail. Be fair but challenging.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: systemPrompt + "\n\n" + userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
          },
        }),
      }
    );

    if (!response.ok) {
      return evaluateActionFallback(action);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text.trim();

    // Try to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result;
    }

    return evaluateActionFallback(action);
  } catch (error) {
    console.error("AI evaluation error:", error);
    return evaluateActionFallback(action);
  }
}

function evaluateActionFallback(action: string): {
  success: boolean;
  outcome: string;
} {
  const actionLower = action.toLowerCase();

  // Look for cautious/smart keywords
  const cautiousWords = [
    "careful",
    "examine",
    "look",
    "check",
    "test",
    "slowly",
    "cautious",
    "inspect",
    "study",
  ];
  const recklessWords = [
    "run",
    "rush",
    "jump",
    "charge",
    "quickly",
    "sprint",
    "dash",
    "hurry",
  ];

  const hasCautious = cautiousWords.some((word) => actionLower.includes(word));
  const hasReckless = recklessWords.some((word) => actionLower.includes(word));

  if (hasCautious && !hasReckless) {
    return {
      success: true,
      outcome:
        "Your careful approach pays off. You spot the danger ahead and navigate around it safely.",
    };
  } else if (hasReckless) {
    return {
      success: false,
      outcome:
        "Your reckless action triggers a trap! The floor gives way beneath you.",
    };
  }

  // Random chance for neutral actions
  const success = Math.random() > 0.5;

  if (success) {
    return {
      success: true,
      outcome:
        "You manage to overcome the challenge through quick thinking and determination.",
    };
  } else {
    return {
      success: false,
      outcome:
        "Despite your efforts, the challenge proves too difficult and you fall victim to its dangers.",
    };
  }
}

function moveToNextPlayer(gameState: any) {
  const alivePlayers = gameState.players.filter((p: any) => p.isAlive);

  if (alivePlayers.length === 0) {
    // All players eliminated - game over, highest score wins
    gameState.phase = "game-over";
    const winner = [...gameState.players].sort((a, b) => b.score - a.score)[0];
    gameState.winner = winner.id;
    return;
  }

  if (alivePlayers.length === 1) {
    // One player left - they win
    gameState.phase = "game-over";
    gameState.winner = alivePlayers[0].id;
    return;
  }

  // Move to next alive player
  let nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

  while (!gameState.players[nextIndex].isAlive) {
    nextIndex = (nextIndex + 1) % gameState.players.length;
  }

  gameState.currentPlayerIndex = nextIndex;
  gameState.phase = "playing";
  gameState.roundNumber++;
  gameState.currentScenario = generateScenario(gameState.roundNumber);
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
function generateScenario(roundNumber: any): any {
    throw new Error("Function not implemented.");
}

