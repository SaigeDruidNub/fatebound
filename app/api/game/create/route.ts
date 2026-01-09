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
      // If the remote call fails, return an error response immediately
      return NextResponse.json(
        {
          error: "Failed to generate puzzle from remote API.",
          remoteError:
            remoteErrorDebug ||
            (err instanceof Error ? err.message : String(err)),
        },
        { status: 500 }
      );
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
