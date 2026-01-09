import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";
import { GameState, Player, PuzzleDifficulty } from "@/types/game";

// Extend the puzzle type to allow debug for troubleshooting
type GamePuzzleWithDebug = {
  phrase: string;
  category: string;
  revealedLetters: Set<string>;
  difficulty: PuzzleDifficulty;
  debug?: any;
};

function generateGameId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 15);
}

async function generatePuzzle(difficulty: PuzzleDifficulty = "medium") {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
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

  try {
    const difficultyConfig: Record<
      PuzzleDifficulty,
      { wordCount: string; complexity: string; examples: string[] }
    > = {
      easy: {
        wordCount: "2 to 3 words",
        complexity: "Simple, common words. Easy to guess.",
        examples: [
          "DRAGON SLAYER",
          "MAGIC SWORD",
          "DARK FOREST",
          "LOST TREASURE",
        ],
      },
      medium: {
        wordCount: "3 to 4 words",
        complexity:
          "Moderately challenging. Mix of common and less common words.",
        examples: [
          "GUARDIAN OF THE GATE",
          "CURSE OF THE MUMMY",
          "KEEPER OF THE FLAME",
          "THRONE OF BONES",
        ],
      },
      hard: {
        wordCount: "4 to 5 words",
        complexity:
          "Challenging phrases with less common words. More abstract concepts.",
        examples: [
          "SHADOW OF THE FORGOTTEN REALM",
          "WHISPERS IN THE ANCIENT VOID",
          "CHRONICLE OF ETERNAL DARKNESS",
          "GUARDIAN OF CELESTIAL SECRETS",
        ],
      },
      "very-hard": {
        wordCount: "5 to 6 words",
        complexity:
          "Very challenging. Complex phrases with uncommon words and abstract ideas.",
        examples: [
          "KEEPER OF THE FORBIDDEN ARCANE KNOWLEDGE",
          "PROPHECY OF THE WANDERING SHADOW LORDS",
          "REMNANTS OF THE CELESTIAL GUARDIAN ORDER",
          "CHRONICLE OF THE FALLEN CRYSTAL EMPIRE",
        ],
      },
    };

    const config = difficultyConfig[difficulty];
    const examplesText = config.examples
      .map((ex, i) => `${i + 1}. "${ex}"`)
      .join("\n");

    const systemPrompt = `Create a puzzle phrase for an adventure game like Wheel of Fortune.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}

**IMPORTANT: Respond with ONLY the JSON. Do not think out loud or explain your reasoning.**

REQUIREMENTS:
- ${config.wordCount} total
- ${config.complexity}
- CAPITAL LETTERS ONLY (no lowercase)
- NO punctuation, numbers, or special characters
- NO PROPER NOUNS (no specific names of people, places, or unique entities)
- Adventure/fantasy themed
- Exciting and evocative
- Use only common/generic nouns and descriptive words

PHRASE TYPES (rotate through these):
1. Action Imperatives: "CROSS THE BURNING BRIDGE"
2. Dangerous Locations: "DEPTHS OF THE ABYSS"
3. Mythic Creatures: "GUARDIAN OF THE GATE"
4. Legendary Objects: "CROWN OF THE FORGOTTEN KING"
5. Heroic Titles: "SLAYER OF SHADOW BEASTS"
6. Dramatic Warnings: "BEWARE THE CRIMSON MOON"
7. Ancient Mysteries: "RIDDLE OF THE STONES"
8. Epic Events: "BATTLE FOR THE REALM"
9. Supernatural Phenomena: "GHOSTS OF THE MANOR"
10. Quest Objectives: "RESCUE THE LOST PRINCE"

EXAMPLES FOR THIS DIFFICULTY:
${examplesText}

AVOID THESE:
- Proper nouns (Zeus, Atlantis, Thor, Rome, etc.)
- Specific character names or locations
- "SEEK THE ANCIENT..."
- "FIND THE LOST..."
- "ESCAPE FROM THE..."
- "DEFEAT THE EVIL..."
- Generic "THE TREASURE" phrases

Respond with ONLY this JSON (no extra text):
{ "phrase": "YOUR PHRASE", "category": "Category Name" }

Make it UNIQUE and EXCITING at ${difficulty} difficulty!`;

    let geminiDebug: Record<string, any> = {};
    let text = "";
    let data: any = null;
    let errorText = "";
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 500,
              topP: 0.9,
            },
          }),
        }
      );
      if (!response.ok) {
        errorText = await response.text();
        geminiDebug.error = `Gemini API failed with status ${response.status}`;
        geminiDebug.errorText = errorText;
        throw new Error(geminiDebug.error);
      }
      data = await response.json();
      geminiDebug.response = data;
      if (
        !data.candidates ||
        !data.candidates[0] ||
        !data.candidates[0].content ||
        !data.candidates[0].content.parts
      ) {
        geminiDebug.error = "Gemini API returned unexpected response structure";
        throw new Error(geminiDebug.error);
      }
      text = data.candidates[0].content.parts[0].text.trim();
      geminiDebug.text = text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const puzzle = JSON.parse(jsonMatch[0]);
        return {
          phrase: puzzle.phrase.toUpperCase(),
          category: puzzle.category,
          difficulty,
          debug: geminiDebug,
        };
      }
      geminiDebug.error = "No valid JSON puzzle found in Gemini response.";
    } catch (err) {
      geminiDebug.exception =
        typeof err === "object" && err && "message" in err
          ? (err as any).message
          : String(err);
    }

    // Use a random fallback puzzle for the requested difficulty
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
  } catch (error) {
    console.error("Error generating puzzle in create route:", error);
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

**IMPORTANT: Respond directly with ONLY the scenario text. Do not think out loud or explain your reasoning.**

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
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
            maxOutputTokens: 5000,
            topP: 0.95,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Gemini API failed");
    }

    const data = await response.json();

    if (
      !data.candidates ||
      !data.candidates[0] ||
      !data.candidates[0].content
    ) {
      console.error("❌ Unexpected scenario response structure:", data);
      throw new Error("Gemini API returned unexpected response structure");
    }

    const candidate = data.candidates[0];
    if (candidate.finishReason === "MAX_TOKENS") {
      console.error("❌ Scenario response was truncated (MAX_TOKENS).");
      throw new Error("Response truncated");
    }

    if (!candidate.content.parts || !candidate.content.parts[0]) {
      console.error("❌ Missing parts in scenario content:", candidate.content);
      throw new Error("Missing response parts");
    }

    const scenario = candidate.content.parts[0].text.trim();
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
    if (
      !playerName ||
      typeof playerName !== "string" ||
      playerName.length > 20
    ) {
      return NextResponse.json(
        { error: "Player name must be 1-20 characters." },
        { status: 400 }
      );
    }

    const gameId = generateGameId();
    const playerId = generatePlayerId();

    // Fetch puzzle from /api/generate-puzzle
    let puzzle;
    let remoteErrorDebug: any = null;
    // Determine the correct base URL for internal API calls
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    // If running on Vercel, use VERCEL_URL or request headers
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (request.headers.get("host")) {
      // Use the host header from the incoming request (works for both prod and dev)
      const proto = request.headers.get("x-forwarded-proto") || "http";
      baseUrl = `${proto}://${request.headers.get("host")}`;
    }
    try {
      const puzzleRes = await fetch(`${baseUrl}/api/generate-puzzle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });
      let puzzleData;
      try {
        puzzleData = await puzzleRes.json();
      } catch (jsonErr) {
        remoteErrorDebug = {
          source: "remote-json-parse-error",
          status: puzzleRes.status,
          statusText: puzzleRes.statusText,
          error: jsonErr instanceof Error ? jsonErr.message : String(jsonErr),
        };
        throw new Error("Failed to parse JSON from /api/generate-puzzle");
      }
      puzzle = {
        phrase: puzzleData.phrase,
        category: puzzleData.category,
        difficulty: puzzleData.difficulty,
        debug: puzzleData.debug ?? {
          source: "remote",
          note: "No debug field from remote.",
        },
        test: puzzleData.test,
      };
    } catch (err) {
      // fallback to local
      puzzle = await generatePuzzle(difficulty as PuzzleDifficulty);
      // Attach full error details to debug
      let errorDetails: any = {
        source: "local-fallback",
        note: "Generated locally due to remote error.",
      };
      if (remoteErrorDebug) {
        errorDetails.remoteError = remoteErrorDebug;
      } else if (err) {
        errorDetails.remoteError = {
          error: err instanceof Error ? err.message : String(err),
        };
      }
      if (!("debug" in puzzle)) {
        (puzzle as any).debug = errorDetails;
      } else {
        (puzzle as any).debug = { ...(puzzle as any).debug, ...errorDetails };
      }
    }

    const scenario = await generateScenario();

    const player: Player = {
      id: playerId,
      name: playerName,
      isAlive: true,
      lives: 3,
      score: 0,
      isBot: false,
    };

    // Ensure debug is always present
    if (!("debug" in puzzle)) {
      (puzzle as any).debug = {
        source: "unknown",
        note: "No debug info present on puzzle object.",
      };
    }
    const gameState: Omit<GameState, "puzzle"> & {
      puzzle: GamePuzzleWithDebug;
    } = {
      id: gameId,
      players: [player],
      currentPlayerIndex: 0,
      phase: "lobby",
      puzzle: {
        phrase: puzzle.phrase,
        category: puzzle.category,
        revealedLetters: new Set(),
        difficulty: puzzle.difficulty || (difficulty as PuzzleDifficulty),
        debug: (puzzle as any).debug,
      },
      selectedLetters: [],
      currentScenario: scenario,
      scenarioHistory: [scenario as string],
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
