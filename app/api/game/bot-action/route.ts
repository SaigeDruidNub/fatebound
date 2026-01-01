import { NextRequest, NextResponse } from "next/server";
import { getGame, setGame } from "@/lib/gameStore";

function getScenarioText(gameState: any): string {
  const s = gameState?.currentScenario;
  if (typeof s === "string") return s.trim();

  const text =
    s?.text ??
    s?.prompt ??
    s?.description ??
    gameState?.scenario ??
    gameState?.lastScenario ??
    "";

  return typeof text === "string" ? text.trim() : "";
}

function cleanAction(text: string) {
  return (text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\w\s'.,!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function isValidAction(text: string) {
  const len = text.length;
  if (len < 20 || len > 200) return false;

  const banned = ["as an ai", "i cannot", "system prompt", "json", "model"];
  const lower = text.toLowerCase();
  if (banned.some((b) => lower.includes(b))) return false;

  return true;
}

function isValidBotSentence(text: string) {
  if (!text) return false;
  if (!text.startsWith("I ")) return false;

  const wc = wordCount(text);
  if (wc < 12 || wc > 22) return false;

  return isValidAction(text);
}

function extractActionLine(raw: string): string {
  const text = (raw || "").trim();
  const idx = text.toUpperCase().indexOf("ACTION:");
  if (idx === -1) return "";

  const line = text.slice(idx).split("\n")[0].trim();
  const after = line.slice("ACTION:".length).trim();
  return cleanAction(after);
}

/**
 * More robust parsing for your consistent template:
 * "... You can <A>, ... or <B>, ... What do you do?"
 */
function parseScenarioOptions(
  scenario: string
): { optionA: string; optionB: string } | null {
  const s = (scenario || "").replace(/\s+/g, " ").trim();

  // Non-greedy capture up to the first comma after "You can ..."
  // then capture after "or" up to the next comma or "What do you do?"
  const m = s.match(/\bYou can\s+(.*?)(?:,|\s)\s+or\s+(.*?)(?:,|\s+What do you do\?)/i);

  if (!m) return null;

  const optionA = cleanAction(m[1] ?? "");
  const optionB = cleanAction(m[2] ?? "");

  if (!optionA || !optionB) return null;

  return { optionA, optionB };
}

/**
 * Grab a couple of quoted anchor terms like "Void-Dagger" or "Shadow-Scribe"
 * to keep generic expansions scenario-relevant even if parsing fails.
 */
function extractScenarioAnchors(scenario: string): string[] {
  const matches = Array.from((scenario || "").matchAll(/"([^"]+)"/g))
    .map((m) => m[1])
    .filter(Boolean);

  // prefer unique, first few
  const uniq: string[] = [];
  for (const x of matches) {
    if (!uniq.includes(x)) uniq.push(x);
    if (uniq.length >= 3) break;
  }
  return uniq;
}

/**
 * Choose which option to commit to, using the fragment and/or lives/personality.
 */
function chooseOption(
  fragment: string,
  options: { optionA: string; optionB: string },
  lives: number,
  personality: string
): "A" | "B" {
  const frag = fragment.toLowerCase();

  // Try to match fragment words to one of the options
  const a = options.optionA.toLowerCase();
  const b = options.optionB.toLowerCase();

  const fragTokens = frag.split(/\s+/).filter(Boolean);
  const score = (text: string) =>
    fragTokens.reduce((acc, t) => (t.length >= 4 && text.includes(t) ? acc + 1 : acc), 0);

  const scoreA = score(a);
  const scoreB = score(b);

  if (scoreA > scoreB) return "A";
  if (scoreB > scoreA) return "B";

  // If still tied, pick based on risk tolerance:
  // - low lives or "cautious" => safer / preserve life (often the sacrifice option)
  // - high lives or "bold" => take active/heroic option
  const cautious = personality.includes("cautious") || lives <= 2;
  return cautious ? "A" : "B";
}

/**
 * Turn an option like "slice your shadows free with a Void-Dagger"
 * into a present-tense clause: "slice my shadows free with the Void-Dagger"
 */
function toFirstPersonPresent(option: string) {
  let o = option.trim();

  // simple pronoun swaps
  o = o.replace(/\byour\b/gi, "my");
  o = o.replace(/\byourself\b/gi, "myself");
  o = o.replace(/\byours\b/gi, "mine");
  o = o.replace(/\byou\b/gi, "I"); // last resort

  // Ensure it starts with a verb phrase, not "I"
  o = o.replace(/^I\s+/i, "");

  return o;
}

/**
 * Expand short / truncated Gemini output into a complete 12–22 word sentence,
 * using the actual scenario options (no hard-coded bomb text).
 */
function expandFragmentAction(params: {
  fragment: string;
  scenario: string;
  personality: string;
  lives: number;
}): string {
  let frag = cleanAction(params.fragment);

  // normalize "I will X" => "I X"
  frag = frag.replace(/^I will\s+/i, "I ").trim();

  if (!frag.startsWith("I ")) return "";

  // If already valid-length, return as-is (still must pass validator later)
  const wc = wordCount(frag);
  if (wc >= 12 && wc <= 22) return frag;

  const opts = parseScenarioOptions(params.scenario);

  const style =
    params.personality.includes("desperate")
      ? "without hesitation"
      : params.personality.includes("cautious")
      ? "carefully controlling my breath"
      : "with grim resolve";

  if (opts) {
    const pick = chooseOption(frag, opts, params.lives, params.personality);
    const chosen = pick === "A" ? opts.optionA : opts.optionB;

    const clause = toFirstPersonPresent(chosen);

    // Build sentence; keep within 12–22 words by trimming variants.
    let sentence = cleanAction(`I ${clause}, ${style}, before the danger tightens around us.`);
    if (wordCount(sentence) > 22) {
      sentence = cleanAction(`I ${clause}, ${style}, before it is too late.`);
    }
    if (wordCount(sentence) > 22) {
      sentence = cleanAction(`I ${clause}, ${style}, to keep us alive.`);
    }
    if (wordCount(sentence) < 12) {
      sentence = cleanAction(`I ${clause}, ${style}, to keep my party alive.`);
    }
    return sentence;
  }

  // If parsing fails, create a scenario-anchored generic action
  const anchors = extractScenarioAnchors(params.scenario);
  const anchorText = anchors.length ? `against the ${anchors[0]}` : "against the threat";

  let sentence = cleanAction(`I steady myself, ${style}, and act decisively ${anchorText} before time runs out.`);
  if (wordCount(sentence) > 22) {
    sentence = cleanAction(`I steady myself, ${style}, and act decisively ${anchorText} before it is too late.`);
  }
  if (wordCount(sentence) < 12) {
    sentence = cleanAction(`I steady myself ${style} and act decisively ${anchorText} before it is too late.`);
  }
  return sentence;
}

async function generateBotActionWithGemini3(params: {
  botName: string;
  lives: number;
  personality: string;
  scenario: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const { botName, lives, personality, scenario } = params;
  const modelName = "gemini-3-flash-preview";

  const systemInstruction = `
You are writing a bot action for a fantasy adventure game.

Output rules (MUST follow):
- Output EXACTLY ONE line.
- That line MUST start with: ACTION:
- After ACTION:, write ONE complete first-person sentence.
- 12 to 22 words.
- Must start with "I" after the prefix.
- Must commit to one of the scenario options.
- No extra text before or after.
`.trim();

  const baseUser = `
Bot: ${botName}
Lives: ${lives}
Personality: ${personality}
Scenario: ${scenario}

Return only the ACTION line.
`.trim();

  for (let attempt = 1; attempt <= 4; attempt++) {
    const userText =
      attempt === 1
        ? baseUser
        : baseUser +
          `\nINVALID OUTPUT. Output ONLY one line starting with ACTION: followed by a FULL 12-22 word sentence.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: {
            temperature: 0.25,
            topP: 0.9,
            maxOutputTokens: 140,
          },
        }),
      }
    );

    if (!resp.ok) {
      console.error("[BotAction] Gemini REST non-OK:", resp.status);
      continue;
    }

    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log(`[BotAction] Raw AI output (attempt ${attempt}):`, raw);

    let candidate = extractActionLine(raw);
    console.log(
      `[BotAction] Extracted+Cleaned AI action (attempt ${attempt}):`,
      candidate
    );

    // Expand fragments using scenario-derived options (not hard-coded)
    if (candidate && wordCount(candidate) < 12) {
      const expanded = expandFragmentAction({
        fragment: candidate,
        scenario,
        personality,
        lives,
      });
      console.log(`[BotAction] Expanded fragment (attempt ${attempt}):`, expanded);
      candidate = expanded;
    }

    if (isValidBotSentence(candidate)) return candidate;
  }

  return "";
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
    const scenario = getScenarioText(gameState);

    console.log("[BotAction] scenario:", scenario);

    const personality =
      lives > 2
        ? "brave and bold"
        : lives === 2
        ? "cautious but determined"
        : "desperate and reckless";

    let actionText = "";

    if (process.env.GEMINI_API_KEY) {
      actionText = await generateBotActionWithGemini3({
        botName,
        lives,
        personality,
        scenario,
      });
    }

    if (!actionText) {
      const fallbackActions = [
        "I steady my breathing and commit to a decisive solution, accepting the cost to save lives.",
        "I choose the safer path and move with controlled focus, refusing to let panic win.",
        "I act quickly and commit to one option, keeping my fear buried under practiced calm.",
        "I prioritize saving the innocents and accept the sacrifice, moving with grim determination.",
      ];
      actionText = fallbackActions[Math.floor(Math.random() * fallbackActions.length)];
    }

    const actionResult = await evaluateAction(actionText, scenario);

    let outcome = actionResult.outcome;

    if (actionResult.success) {
      currentPlayer.score += 10;
      gameState.phase = "letter-selection";
      outcome += " Success!";
    } else {
      currentPlayer.lives -= 1;

      if (currentPlayer.lives <= 0) {
        currentPlayer.isAlive = false;
        outcome += " Eliminated!";
      } else {
        outcome += ` Lost a life! ${currentPlayer.lives} remaining.`;
      }

      const alivePlayers = gameState.players.filter((p: any) => p.isAlive);

      if (alivePlayers.length === 0) {
        gameState.phase = "game-over";
        const winner = [...gameState.players].sort(
          (a: any, b: any) => b.score - a.score
        )[0];
        gameState.winner = winner.id;
        outcome += " All players have been eliminated!";
      } else if (alivePlayers.length === 1) {
        gameState.phase = "game-over";
        gameState.winner = alivePlayers[0].id;
        outcome += ` ${alivePlayers[0].name} is the last one standing!`;
      } else {
        gameState.phase = "waiting-continue";
      }
    }

    await setGame(gameId, gameState);

    return NextResponse.json({
      gameState: serializeGameState(gameState),
      outcome,
      botAction: actionText,
    });
  } catch (e: any) {
    console.error("Bot-action route error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to process bot action" },
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

Does this action succeed?

Respond ONLY with valid JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
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
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);

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
