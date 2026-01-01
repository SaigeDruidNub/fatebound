import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";

async function generateScenario(recentScenarios: string[] = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  const fallbackScenarios = [
    "A merchant's wagon wheel snaps ahead of you. Bandits emerge from the trees, circling the stranded traveler. What do you do?",
    "Glowing mushrooms illuminate a fork in the cave. Left tunnel drips with acid, right tunnel crawls with giant centipedes. What do you do?",
    "An old woman offers you a steaming bowl of stew. Your stomach growls, but the bones in her firepit look suspiciously human-sized. What do you do?",
    "Your torch reveals a room filled with golden statues. Each one depicts someone in mid-scream. The door slams shut behind you. What do you do?",
    "A child cries from a nearby well. As you approach, you notice claw marks on the stone rim and the crying echoes strangely. What do you do?",
    "Fog rolls in thick and cold. Through it, you hear your companion's voice calling for help from three different directions. What do you do?",
    "A locked chest sits in the center of the chamber. Through the keyhole, you see it's full of gems, but also ticking ominously. What do you do?",
    "Armed soldiers question villagers ahead. One villager catches your eye and mouths 'run' before a soldier notices. What do you do?",
  ];

  const pickFallback = () => {
    const available = fallbackScenarios.filter(
      (s) => !recentScenarios.includes(s)
    );
    const choices = available.length > 0 ? available : fallbackScenarios;
    return choices[Math.floor(Math.random() * choices.length)];
  };

  if (!apiKey) return pickFallback();

  // --- helpers to salvage partial outputs ---
  const clean = (t: string) =>
    (t || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const ensureEnding = (t: string) => {
    const trimmed = clean(t);

    // If it already contains the ending, cut right after it
    const idx = trimmed.indexOf("What do you do?");
    if (idx !== -1) return trimmed.slice(0, idx + "What do you do?".length);

    // Otherwise, try to extract up to 2 sentences
    const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);

    if (sentences.length < 2) {
      // Too short, fallback
      return "";
    }

    // Join the first two sentences, remove trailing punctuation, append ending
    const base = sentences.slice(0, 2).join(" ");
    const noTrailingPunct = base.replace(/[.!?]+\s*$/, "");
    return `${noTrailingPunct}. What do you do?`;
  };

  const systemInstruction = `
You write adventure scenarios for a fantasy RPG word-puzzle game.

OUTPUT RULES:
- Output ONLY the scenario text (no preface, no markdown).
- EXACTLY 2 sentences.
- Total length: 30–55 words.
- Sentence 1: present a concrete danger or dilemma.
- Sentence 2: present a meaningful choice and END with "What do you do?"
- Avoid collapsing bridges/falling floors/pits.
- Do not reuse recent scenarios.
`.trim();

  const recentBlock =
    recentScenarios.length > 0
      ? `Recent scenarios to avoid:\n${recentScenarios
          .slice(-5)
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n")}`
      : "";

  const userPrompt = `
Create one new, unique scenario.
${recentBlock}
`.trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 700,
            // Hard stop exactly at your required ending:
            stopSequences: ["What do you do?"],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ Gemini API error for scenario:",
        response.status,
        errorText
      );
      return pickFallback();
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];

    const parts = candidate?.content?.parts ?? [];
    const rawText = parts
      .map((p: any) => p?.text ?? "")
      .join("")
      .trim();

    // If stopSequences stops *before* including the stop string, add it back
    const scenario = ensureEnding(
      rawText ? rawText + " What do you do?" : rawText
    );

    // IMPORTANT: don't throw on MAX_TOKENS; salvage what we got
    if (!scenario || scenario.length < 30) {
      console.warn("⚠️ Scenario too short after salvage, using fallback.");
      return pickFallback();
    }

    return scenario;
  } catch (err) {
    console.error("❌ Error generating scenario:", err);
    return pickFallback();
  }
}

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
    puzzle: {
      ...gameState.puzzle,
      revealedLetters: Array.from(gameState.puzzle.revealedLetters),
    },
  };
}
