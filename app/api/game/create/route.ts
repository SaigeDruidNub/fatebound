import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";
import { GameState, Player, PuzzleDifficulty } from "@/types/game";

function generateGameId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 15);
}

async function generatePuzzle(difficulty: PuzzleDifficulty = "medium") {
  try {
    // Use the generate-puzzle API internally
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/api/generate-puzzle`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ difficulty }),
      }
    );

    if (response.ok) {
      return await response.json();
    }
    throw new Error("Failed to generate puzzle");
  } catch (error) {
    console.error("Error generating puzzle:", error);
    // Fallback puzzles organized by difficulty
    const fallbackPuzzles: Record<
      PuzzleDifficulty,
      Array<{ phrase: string; category: string; difficulty: PuzzleDifficulty }>
    > = {
      easy: [
        {
          phrase: "MAGIC SWORD",
          category: "Legendary Weapon",
          difficulty: "easy",
        },
        {
          phrase: "DRAGON SLAYER",
          category: "Heroic Title",
          difficulty: "easy",
        },
        { phrase: "DARK FOREST", category: "Spooky Place", difficulty: "easy" },
      ],
      medium: [
        {
          phrase: "THE TREASURE IS CURSED",
          category: "Adventure Warning",
          difficulty: "medium",
        },
        {
          phrase: "GUARDIAN OF THE RUINS",
          category: "Mythic Title",
          difficulty: "medium",
        },
        {
          phrase: "SWORD IN THE STONE",
          category: "Legendary Artifact",
          difficulty: "medium",
        },
      ],
      hard: [
        {
          phrase: "SHADOW OF THE FORGOTTEN KING",
          category: "Dark Legacy",
          difficulty: "hard",
        },
        {
          phrase: "KEEPER OF THE SACRED FLAME",
          category: "Holy Guardian",
          difficulty: "hard",
        },
        {
          phrase: "PROPHECY OF THE CRIMSON MOON",
          category: "Dark Omen",
          difficulty: "hard",
        },
      ],
      "very-hard": [
        {
          phrase: "CHRONICLE OF THE FALLEN EMPIRE STATE",
          category: "Ancient History",
          difficulty: "very-hard",
        },
        {
          phrase: "KEEPER OF THE FORBIDDEN ARCANE KNOWLEDGE",
          category: "Mystic Secret",
          difficulty: "very-hard",
        },
        {
          phrase: "LEGEND OF THE ETERNAL TWILIGHT REALM",
          category: "Mythic Dimension",
          difficulty: "very-hard",
        },
      ],
    };
    const puzzles = fallbackPuzzles[difficulty];
    return puzzles[Math.floor(Math.random() * puzzles.length)];
  }
}

async function generateScenario(recentScenarios: string[] = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Fallback scenarios with much more variety
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
    // Better fallback with variety
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
    const body = await request.json();
    const { playerName, difficulty = "medium" } = body;

    const gameId = generateGameId();
    const playerId = generatePlayerId();
    const puzzle = await generatePuzzle(difficulty as PuzzleDifficulty);
    const scenario = await generateScenario();

    const player: Player = {
      id: playerId,
      name: playerName,
      isAlive: true,
      lives: 3,
      score: 0,
      isBot: false,
    };

    const gameState: GameState = {
      id: gameId,
      players: [player],
      currentPlayerIndex: 0,
      phase: "lobby",
      puzzle: {
        phrase: puzzle.phrase,
        category: puzzle.category,
        revealedLetters: new Set(),
        difficulty: puzzle.difficulty || (difficulty as PuzzleDifficulty),
      },
      currentScenario: scenario,
      scenarioHistory: [scenario],
      roundNumber: 1,
      winner: null,
      createdAt: Date.now(),
    };

    await setGame(gameId, gameState);

    return NextResponse.json({
      gameId,
      playerId,
      gameState: serializeGameState(gameState),
    });
  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 }
    );
  }
}

function serializeGameState(gameState: GameState) {
  return {
    ...gameState,
    puzzle: {
      ...gameState.puzzle,
      revealedLetters: Array.from(gameState.puzzle.revealedLetters),
    },
  };
}
