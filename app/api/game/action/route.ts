import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, playerId, action } = body;

    if (!gameId || !playerId || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const gameState = await getGame(gameId);

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

      // Check if all players are eliminated
      const alivePlayers = gameState.players.filter((p: any) => p.isAlive);

      if (alivePlayers.length === 0) {
        // All players eliminated - game over, highest score wins
        gameState.phase = "game-over";
        const winner = [...gameState.players].sort(
          (a: any, b: any) => b.score - a.score
        )[0];
        gameState.winner = winner.id;
        outcome += " All players have been eliminated!";
      } else if (alivePlayers.length === 1) {
        // One player left - they win
        gameState.phase = "game-over";
        gameState.winner = alivePlayers[0].id;
        outcome += ` ${alivePlayers[0].name} is the last one standing!`;
      } else {
        // Don't auto-advance - wait for continue button
        gameState.phase = "waiting-continue";
      }
    }

    await setGame(gameId, gameState);

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
  if (!apiKey) return evaluateActionFallback(action);

  const model = "gemini-3-flash-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const systemInstruction = `
You are a fair dungeon master judging a player action.

Return ONLY a JSON object matching the provided schema.
No markdown. No preface. No extra keys.
Outcome must be 2 sentences and specific to the scenario + action.
Smart/cautious/creative = success. Reckless/ignoring danger = failure.
`.trim();

  const responseSchema = {
    type: "OBJECT",
    properties: {
      success: { type: "BOOLEAN" },
      outcome: { type: "STRING" },
    },
    required: ["success", "outcome"],
  } as const;

  function validate(obj: any): obj is { success: boolean; outcome: string } {
    return (
      obj &&
      typeof obj.success === "boolean" &&
      typeof obj.outcome === "string" &&
      obj.outcome.trim().length > 0
    );
  }

  async function callGemini(promptText: string, retry: boolean) {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey || "",
      } as HeadersInit,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: retry ? 0.2 : 0.4,
          maxOutputTokens: 220,
          responseMimeType: "application/json",
          // KEY: schema-constrained output
          responseSchema,
        },
      }),
    });

    if (!resp.ok) return { ok: false as const, text: "", raw: null };

    const raw = await resp.json();
    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Log useful debugging signals (why truncation happens)
    // (Finish reason is often "MAX_TOKENS" / "SAFETY" / "STOP" etc.)
    const finishReason = raw?.candidates?.[0]?.finishReason;
    if (finishReason)
      console.warn("[evaluateAction] finishReason:", finishReason);

    return { ok: true as const, text: String(text).trim(), raw };
  }

  const basePrompt = `SCENARIO: ${scenario}\nACTION: "${action}"`;

  // Attempt 1
  try {
    const r1 = await callGemini(basePrompt, false);
    if (r1.ok) {
      // With responseMimeType+schema, many responses are directly parseable JSON
      try {
        const obj = JSON.parse(r1.text);
        if (validate(obj))
          return { success: obj.success, outcome: obj.outcome.trim() };
      } catch {
        // Fall through to attempt 2
        console.warn("⚠️ Attempt 1 not parseable:", r1.text);
      }
    }

    // Attempt 2: repair prompt (handles “{” or “Here is …”)
    const repairPrompt =
      basePrompt +
      `\n\nYour previous output was invalid. Return ONLY the JSON object matching the schema.`;

    const r2 = await callGemini(repairPrompt, true);
    if (r2.ok) {
      try {
        const obj = JSON.parse(r2.text);
        if (validate(obj))
          return { success: obj.success, outcome: obj.outcome.trim() };
      } catch {
        console.warn("⚠️ Attempt 2 not parseable:", r2.text);
      }
    }

    return evaluateActionFallback(action);
  } catch (err) {
    console.error("❌ AI evaluation error:", err);
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
