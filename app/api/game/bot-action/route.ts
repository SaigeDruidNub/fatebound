import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGame, setGame } from "@/lib/gameStore";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

function cleanAction(text: string) {
  // Keep it readable + safe for your game log
  // Allow common punctuation; remove anything weird
  return text
    .replace(/[^\w\s'.,!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidAction(text: string) {
  const len = text.length;
  if (len < 20 || len > 140) return false; // keep it tight
  // avoid meta/system leakage
  const banned = ["as an ai", "i cannot", "system prompt", "json", "model"];
  const lower = text.toLowerCase();
  if (banned.some((b) => lower.includes(b))) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { gameId } = await req.json();

    if (!gameId) {
      console.error("Bot action: Missing gameId");
      return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
    }

    const gameState = await getGame(gameId);
    if (!gameState) {
      console.error("Bot action: Game not found", gameId);
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isBot) {
      console.error(
        "Bot action: Current player is not a bot",
        currentPlayer?.name
      );
      return NextResponse.json(
        { error: "Current player is not a bot" },
        { status: 400 }
      );
    }

    const botName = currentPlayer.name;
    const lives = currentPlayer.lives;
    const scenario = gameState.currentScenario;
    const personality =
      lives > 2
        ? "brave and bold"
        : lives === 2
        ? "cautious but determined"
        : "desperate and reckless";

    let cleaned = "";

    // Try to generate bot action with AI
    if (process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-pro",
          generationConfig: {
            temperature: 1.0,
            topP: 0.9,
            maxOutputTokens: 60,
          },
        });

        const system = `
You write ONE first-person action a bot takes in an adventure game.
Rules:
- Output ONE sentence.
- 8 to 22 words.
- No quotes, no lists, no emojis.
- Be specific and varied; avoid generic "I proceed carefully" phrasing.
- Must be plausible given the scenario and personality.
- No meta commentary.
`.trim();

        const user = `
Bot: ${botName}
Lives: ${lives}
Personality: ${personality}
Scenario: ${scenario}

Write the bot's action:
`.trim();

        const result = await model.generateContent([system, user]);
        const raw = result.response.text() || "";
        cleaned = cleanAction(raw);

        if (!isValidAction(cleaned)) {
          throw new Error("Invalid AI action generated");
        }
      } catch (aiError) {
        console.error("Failed to generate bot action with AI:", aiError);
        // Fall through to use fallback
      }
    }

    // Fallback bot actions if AI fails
    if (!cleaned) {
      const fallbackActions = [
        "I carefully examine my surroundings for any hidden dangers before proceeding cautiously forward.",
        "I draw my weapon and prepare to defend myself while looking for an escape route.",
        "I attempt to negotiate peacefully while keeping my guard up and watching for threats.",
        "I search for an alternative path that might be safer than the obvious route ahead.",
        "I use my supplies to create a distraction and slip away from the immediate danger.",
        "I observe the situation from a safe distance to better understand what I'm dealing with.",
        "I trust my instincts and make a quick decisive move to get past this obstacle.",
        "I call out to see if there's anyone or anything that might respond before acting.",
      ];
      cleaned =
        fallbackActions[Math.floor(Math.random() * fallbackActions.length)];
    }

    // Now evaluate the bot's action
    const actionResult = await evaluateAction(cleaned, scenario);

    let outcome = actionResult.outcome;

    if (actionResult.success) {
      // Bot succeeded - move to letter selection phase
      currentPlayer.score += 10;
      gameState.phase = "letter-selection";
      outcome += " Success!";
    } else {
      // Bot failed - lose a life
      currentPlayer.lives -= 1;

      if (currentPlayer.lives <= 0) {
        currentPlayer.isAlive = false;
        outcome += " Eliminated!";
      } else {
        outcome += ` Lost a life! ${currentPlayer.lives} remaining.`;
      }

      gameState.phase = "waiting-continue";
    }

    await setGame(gameId, gameState);

    return NextResponse.json({
      gameState: serializeGameState(gameState),
      outcome,
      botAction: cleaned,
    });
  } catch (e: any) {
    console.error("Gemini bot-action error:", e);
    console.error("Error stack:", e?.stack);
    console.error("Error message:", e?.message);
    return NextResponse.json(
      { error: e?.message || "AI generation failed" },
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
    return {
      success: Math.random() > 0.4,
      outcome: "You take action in the face of danger.",
    };
  }

  try {
    const systemPrompt = `You are a fair dungeon master judging player actions in an adventure game.

EVALUATION CRITERIA:
- Smart, cautious actions that assess risk = SUCCESS
- Creative solutions that address the problem = SUCCESS  
- Reckless actions without thought = FAILURE
- Actions that ignore obvious dangers = FAILURE
- Moderate risk with preparation = 60% chance SUCCESS

RESPONSE FORMAT:
{ "success": true/false, "outcome": "2-3 sentence dramatic description" }

Be FAIR: Don't punish reasonable actions. Reward clever thinking.
Be ENGAGING: Make outcomes exciting and specific to their action.
Be CONSISTENT: Similar actions should get similar results.`;

    const userPrompt = `SCENARIO: ${scenario}

PLAYER ACTION: "${action}"

Does this action succeed? Consider: Is it thoughtful? Does it address the danger? Is it reckless?

Respond ONLY with valid JSON.`;

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
      return {
        success: Math.random() > 0.4,
        outcome: "The outcome is uncertain.",
      };
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text.trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result;
    }

    return {
      success: Math.random() > 0.4,
      outcome: "The situation unfolds unexpectedly.",
    };
  } catch (error) {
    console.error("Error evaluating action:", error);
    return {
      success: Math.random() > 0.4,
      outcome: "The situation is unpredictable.",
    };
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
