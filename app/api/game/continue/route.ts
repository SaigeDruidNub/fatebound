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
      gameState.currentScenario = await generateScenario(
        gameState.scenarioHistory
      );
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
