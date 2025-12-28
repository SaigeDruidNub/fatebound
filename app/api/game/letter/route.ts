import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";

async function generateScenario(recentScenarios: string[] = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
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

    const available = fallbackScenarios.filter(
      (s) => !recentScenarios.includes(s)
    );
    const choices = available.length > 0 ? available : fallbackScenarios;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  try {
    const recentScenariosText =
      recentScenarios.length > 0
        ? `\n\nDO NOT REPEAT these recent scenarios:\n${recentScenarios
            .map((s: string, i: number) => `${i + 1}. ${s}`)
            .join("\n")}\n\nCreate something COMPLETELY DIFFERENT.`
        : "";

    const systemPrompt = `Create a dramatic adventure challenge for a game (2-3 sentences max).

REQUIREMENTS:
✓ Present a clear danger or obstacle
✓ Give players a meaningful choice
✓ End with "What do you do?"
✓ Be specific and vivid (not generic)
✓ Create tension and urgency
✓ Use fresh, unexpected scenarios

AVOID:
✗ Falling/collapsing floors or bridges
✗ Bottomless pits or falling hazards  
✗ Overused fantasy clichés
✗ Vague descriptions
✗ Generic "dark room" or "mysterious sound" setups

DANGER TYPES (rotate through these):
• Enemy/creature encounter (bandits, wolves, trolls, cultists)
• Environmental threat (fire, poison gas, thorns, quicksand, flood)
• Moral dilemma (save stranger vs escape, share food, trust NPC)
• Resource crisis (weapon breaks, lost supplies, time running out)
• Mystery/puzzle (cursed item, locked door with riddle, shifting maze)
• Social encounter (checkpoint guards, rival adventurers, desperate merchant)
• Magical threat (living shadows, spell backlash, haunted objects)
• Weather/nature (sudden storm, avalanche threat, predator territory)

SPECIFIC SCENARIO IDEAS:
- Wounded animal blocking path (mother bear with cubs)
- Suspicious food/drink offered by stranger
- Fork in path with different sounds/smells from each
- Something valuable but obviously trapped
- NPC begging for help with suspicious timing
- Equipment failure at worst moment
- Moral choice with time pressure
- Creature that might be reasoned with${recentScenariosText}

Write ONE new scenario that is UNIQUE and DIFFERENT from anything above:`;

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
              parts: [{ text: systemPrompt }],
            },
          ],
          generationConfig: {
            temperature: 1.4,
            maxOutputTokens: 150,
            topP: 0.95,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Gemini API failed");
    }

    const data = await response.json();
    const scenario = data.candidates[0].content.parts[0].text.trim();
    return scenario;
  } catch (error) {
    console.error("Error generating scenario:", error);
    const emergencyScenarios = [
      "A wounded wolf limps toward you, blood trailing behind it. Its eyes show pain, not aggression. What do you do?",
      "The bridge ahead sways dangerously. You see fresh footprints crossing it, but also broken planks. What do you do?",
      "A traveler offers to share their campfire and food. Their smile is warm, but their eyes keep darting to your coin purse. What do you do?",
    ];
    return emergencyScenarios[
      Math.floor(Math.random() * emergencyScenarios.length)
    ];
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
