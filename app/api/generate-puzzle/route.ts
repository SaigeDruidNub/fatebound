export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { PuzzleDifficulty } from "@/types/game";

type DifficultySettings = {
  wordCount: string;
  complexity: string;
  examples: string[];
};

const DIFFICULTY_CONFIG: Record<PuzzleDifficulty, DifficultySettings> = {
  easy: {
    wordCount: "2 to 3 words",
    complexity: "Simple, common words. Easy to guess.",
    examples: ["DRAGON SLAYER", "MAGIC SWORD", "DARK FOREST", "LOST TREASURE"],
  },
  medium: {
    wordCount: "3 to 4 words",
    complexity: "Moderately challenging. Mix of common and less common words.",
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

const FALLBACK_PUZZLES: Record<
  PuzzleDifficulty,
  Array<{ phrase: string; category: string }>
> = {
  easy: [
    { phrase: "MAGIC SWORD", category: "Legendary Weapon" },
    { phrase: "DRAGON SLAYER", category: "Heroic Title" },
    { phrase: "DARK FOREST", category: "Spooky Place" },
    { phrase: "LOST TREASURE", category: "Quest Goal" },
    { phrase: "STONE CASTLE", category: "Ancient Structure" },
  ],
  medium: [
    { phrase: "THE TREASURE IS CURSED", category: "Adventure Warning" },
    { phrase: "BEWARE OF THE DRAGON", category: "Monster Alert" },
    { phrase: "GUARDIAN OF THE RUINS", category: "Mythic Title" },
    { phrase: "SWORD IN THE STONE", category: "Legendary Artifact" },
    { phrase: "CURSE OF THE PHARAOH", category: "Ancient Doom" },
  ],
  hard: [
    { phrase: "SHADOW OF THE FORGOTTEN KING", category: "Dark Legacy" },
    { phrase: "WHISPERS IN THE ANCIENT TOMB", category: "Eerie Mystery" },
    { phrase: "KEEPER OF THE SACRED FLAME", category: "Holy Guardian" },
    { phrase: "PROPHECY OF THE CRIMSON MOON", category: "Dark Omen" },
    { phrase: "GUARDIAN OF CELESTIAL SECRETS", category: "Cosmic Keeper" },
  ],
  "very-hard": [
    { phrase: "CHRONICLE OF THE FALLEN EMPIRE", category: "Ancient History" },
    {
      phrase: "REMNANTS OF THE CELESTIAL GUARDIAN ORDER",
      category: "Lost Organization",
    },
    {
      phrase: "PROPHECY OF THE WANDERING SHADOW LORDS",
      category: "Dark Prophecy",
    },
    {
      phrase: "KEEPER OF THE FORBIDDEN ARCANE KNOWLEDGE",
      category: "Mystic Secret",
    },
    {
      phrase: "LEGEND OF THE ETERNAL TWILIGHT REALM",
      category: "Mythic Dimension",
    },
  ],
};

function pickFallback(difficulty: PuzzleDifficulty) {
  const puzzles = FALLBACK_PUZZLES[difficulty];
  // Use crypto for better randomness in serverless
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    const idx = array[0] % puzzles.length;
    return puzzles[idx];
  }
  // Fallback to Math.random if crypto is unavailable
  return puzzles[Math.floor(Math.random() * puzzles.length)];
}

function normalizePhrase(raw: string) {
  return (raw || "")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(phrase: string) {
  return phrase.split(/\s+/).filter(Boolean).length;
}

function wordRangeForDifficulty(
  difficulty: PuzzleDifficulty,
): [number, number] {
  switch (difficulty) {
    case "easy":
      return [2, 3];
    case "medium":
      return [3, 4];
    case "hard":
      return [4, 5];
    case "very-hard":
      return [5, 6];
    default:
      return [3, 4];
  }
}

/**
 * Accept BOTH formats:
 * 1) PHRASE=...|CATEGORY=...
 * 2) PHRASE=...\nCATEGORY=...
 */
function parsePuzzle(text: string) {
  const t = (text || "").trim();

  // One-line pipe form
  const pipe = t.match(/PHRASE\s*[:=]\s*(.+?)\s*\|\s*CATEGORY\s*[:=]\s*(.+)$/i);
  if (pipe) {
    const phrase = normalizePhrase(pipe[1]);
    const category = (pipe[2] || "").trim();
    if (phrase && category && /^[A-Z ]+$/.test(phrase))
      return { phrase, category };
    return null;
  }

  // Two-line form
  const phraseLine = t.match(/PHRASE\s*[:=]\s*(.+)/i);
  const catLine = t.match(/CATEGORY\s*[:=]\s*(.+)/i);
  if (phraseLine && catLine) {
    const phrase = normalizePhrase(phraseLine[1]);
    const category = (catLine[1] || "").trim();
    if (phrase && category && /^[A-Z ]+$/.test(phrase))
      return { phrase, category };
    return null;
  }

  // Phrase-only form (we can salvage by asking for category)
  if (phraseLine && !catLine) {
    const phrase = normalizePhrase(phraseLine[1]);
    if (phrase && /^[A-Z ]+$/.test(phrase)) return { phrase, category: "" };
  }

  return null;
}

async function generatePuzzleWithGemini(params: {
  apiKey: string;
  difficulty: PuzzleDifficulty;
  config: DifficultySettings;
  debugCollector?: (info: any) => void;
}): Promise<{ phrase: string; category: string } | null> {
  const { apiKey, difficulty, config, debugCollector } = params;
  const [minW, maxW] = wordRangeForDifficulty(difficulty);
  const targetWords = Math.random() < 0.5 ? minW : maxW;

  const examplesText = config.examples.map((ex) => `- ${ex}`).join("\n");

  const systemInstruction = `
You generate Wheel-of-Fortune style puzzle phrases for a fantasy adventure game.

OUTPUT FORMAT (allowed):
- Either ONE line: PHRASE=<PHRASE>|CATEGORY=<CATEGORY>
- Or TWO lines:
  PHRASE=<PHRASE>
  CATEGORY=<CATEGORY>

RULES FOR PHRASE:
- CAPITAL LETTERS and SPACES only
- NO punctuation, numbers, hyphens, apostrophes
- NO proper nouns
- EXACTLY ${targetWords} words
- Adventure/fantasy themed, evocative, not generic

RULES FOR CATEGORY:
- 2 to 4 words, short adventure-related label
- MUST be specific, creative, and fit the phrase
- DO NOT use generic categories like "Epic Quest", "Adventure", "Fantasy", or "Quest"
- Use more descriptive, imaginative, or scenario-specific labels (e.g. "Cursed Relic", "Forbidden Ritual", "Ancient Prophecy", "Monster Alert", "Lost Civilization", "Heroic Title", "Spooky Place")

DO NOT add extra commentary. Do NOT say "Here is...". Do NOT mention JSON.
`.trim();

  const userPrompt = `
DIFFICULTY: ${difficulty.toUpperCase()}
COMPLEXITY: ${config.complexity}

EXAMPLES:
${examplesText}

Generate ONE new puzzle now.
`.trim();

  async function callGemini(promptText: string, retry: boolean) {
    let debug: any = { sentPrompt: promptText, retry };
    let resp: Response | null = null;
    let data: any = null;
    try {
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: retry ? 0.2 : 0.35,
              topP: 0.9,
              maxOutputTokens: 350,
              // IMPORTANT: do NOT stop on "\n" or you'll cut off the CATEGORY line
              // stopSequences: ["\n\n\n"], // optional, usually not needed
            },
          }),
        },
      );
      debug.status = resp.status;
      debug.statusText = resp.statusText;
      if (!resp.ok) {
        debug.error = `HTTP ${resp.status} ${resp.statusText}`;
        try {
          debug.responseBody = await resp.text();
        } catch (e) {
          debug.responseBody = `Failed to read response body: ${e}`;
        }
        if (debugCollector) debugCollector({ geminiHttpError: debug });
        return { text: "", finishReason: null as any };
      }
      data = await resp.json();
      debug.responseData = data;
      const finishReason = data?.candidates?.[0]?.finishReason ?? null;
      if (finishReason)
        console.warn("[PUZZLE DEBUG] finishReason:", finishReason);

      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((p: any) => p?.text ?? "")
        .join("")
        .trim();
      if (debugCollector) debugCollector({ geminiCall: debug });
      return { text, finishReason };
    } catch (err) {
      debug.error = err instanceof Error ? err.message : String(err);
      if (resp && !data) {
        try {
          debug.responseBody = await resp.text();
        } catch (e) {
          debug.responseBody = `Failed to read response body: ${e}`;
        }
      }
      if (debugCollector) debugCollector({ geminiException: debug });
      return { text: "", finishReason: null as any };
    }
  }

  // Attempt 1
  const r1 = await callGemini(userPrompt, false);
  if (debugCollector) debugCollector({ r1 });
  let parsed = parsePuzzle(r1.text);

  // Attempt 2: repair
  if (!parsed || !parsed.phrase) {
    if (debugCollector) debugCollector({ r1_invalid: r1.text });
    console.warn(`[PUZZLE DEBUG] Attempt 1 not valid, raw:`, r1.text);
    const repairPrompt =
      userPrompt +
      `\n\nREPAIR: Output only the PHRASE and CATEGORY in the required format. No extra words.`;

    const r2 = await callGemini(repairPrompt, true);
    if (debugCollector) debugCollector({ r2 });
    parsed = parsePuzzle(r2.text);

    if (!parsed) {
      if (debugCollector) debugCollector({ r2_invalid: r2.text });
      console.warn(`[PUZZLE DEBUG] Attempt 2 not valid, raw:`, r2.text);
      return null;
    }
  }

  // If we got phrase but missing or banned category, ask category-only (with retry for banned)
  const bannedCategories = ["Epic Quest", "Adventure", "Fantasy", "Quest"];
  function isBannedCategory(cat: string) {
    return bannedCategories.some(
      (b) => cat.trim().toLowerCase() === b.toLowerCase(),
    );
  }

  async function fetchCategory(phrase: string) {
 const catSystem = `
Create a category label for a fantasy Wheel-of-Fortune puzzle.

OUTPUT FORMAT (exact):
CATEGORY=<CATEGORY>###

CATEGORY RULES:
- EXACTLY 2 to 4 words
- Category should describe the *TYPE* (broad class), not a rewording of the phrase
- DO NOT paraphrase or synonym-swap the phrase’s nouns (e.g. do not turn "CAVE ENTRANCE" into "MOUNTAIN PASSAGEWAY")
- Avoid overly literal/location-feature labels (Terrain Feature, Hidden Passageway, Concealed Feature)
- Choose from category styles like: Spooky Place, Secret Route, Ancient Ruins, Arcane Relic, Monster Threat, Dark Prophecy, Heroic Title, Cursed Object, Dangerous Mission

BANNED GENERIC:
- Epic Quest, Adventure, Fantasy, Quest

Output ONLY the format above. No extra text.
`.trim();


  const catPrompt = `PHRASE: ${phrase}`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: catSystem }] },
        contents: [{ role: "user", parts: [{ text: catPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 280,
          stopSequences: ["###"], // HARD STOP so it can’t ramble
        },
      }),
    }
  );

  if (!resp.ok) return "";

  const data = await resp.json();
  const finishReason = data?.candidates?.[0]?.finishReason;
  console.log("[PUZZLE DEBUG] category finishReason:", finishReason);

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const txt = parts.map((p: any) => p?.text ?? "").join("").trim();

  console.log(`[PUZZLE DEBUG] Raw category AI output:`, txt);

  const m = txt.match(/CATEGORY\s*[:=]\s*([A-Za-z][A-Za-z ]{2,60})/i);
  if (!m) return "";

  const category = (m[1] || "").trim().replace(/\s+/g, " ");
  const wc = category.split(/\s+/).filter(Boolean).length;
  if (wc < 2 || wc > 4) return "";

  const upper = category.toUpperCase();
  const banned = ["EPIC QUEST", "ADVENTURE", "FANTASY", "QUEST"];
  if (banned.includes(upper)) return "";

  return category;
}



  if (parsed.category.trim() === "" || isBannedCategory(parsed.category)) {
    let newCat = await fetchCategory(parsed.phrase);
    if (isBannedCategory(newCat)) {
      // Retry once with extra warning
      newCat = await fetchCategory(parsed.phrase);
    }
    if (newCat && !isBannedCategory(newCat)) parsed.category = newCat;
  }

  // Word count validation + rewrite salvage if needed
  if (wordCount(parsed.phrase) !== targetWords) {
    const rewriteSystem = `
Rewrite a fantasy puzzle phrase to EXACTLY ${targetWords} words.

RULES:
- CAPITAL LETTERS and SPACES only
- No punctuation or proper nouns
- Return ONLY: PHRASE=<PHRASE>
`.trim();

    const rewritePrompt = `Original phrase: ${parsed.phrase}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: rewriteSystem }] },
          contents: [{ role: "user", parts: [{ text: rewritePrompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
            maxOutputTokens: 500,
          },
        }),
      },
    );

    if (resp.ok) {
      const data = await resp.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const txt = parts
        .map((p: any) => p?.text ?? "")
        .join("")
        .trim();
      const m = txt.match(/PHRASE\s*[:=]\s*(.+)$/i);
      if (m) parsed.phrase = normalizePhrase(m[1]);
    }
  }

  // Final guards
  if (wordCount(parsed.phrase) !== targetWords) return null;
  function isBadCategory(cat: string) {
    const c = (cat || "").trim();
    if (!c) return true;

    const words = c.split(/\s+/).filter(Boolean);
    if (words.length < 2) return true;

    // Avoid trivial determiners / truncations
    const upper = c.toUpperCase();
    const banned = new Set(["A", "AN", "THE", "OF", "IN", "ON", "TO"]);
    if (words.length === 1 && banned.has(upper)) return true;
    if (c.length < 6) return true;

    return false;
  }

  // ... after your category-only salvage and phrase rewrite ...

  // Final guards
  if (wordCount(parsed.phrase) !== targetWords) return null;

  if (
  isBadCategory(parsed.category) ||
  isGenericCategory(parsed.category) ||
  looksTruncatedCategory(parsed.category)
) {
  const aiCat = await fetchCategory(parsed.phrase);
  parsed.category = (!isBadCategory(aiCat) && !isGenericCategory(aiCat))
    ? aiCat
    : fallbackCategoryFromPhrase(parsed.phrase);
}



  return { phrase: parsed.phrase, category: parsed.category.trim() };
}

function fallbackCategoryFromPhrase(phrase: string): string {
  const p = phrase.toUpperCase();

  // Weapons / gear
  if (/\b(SWORD|DAGGER|AXE|BOW|SPEAR|HAMMER)\b/.test(p)) return "Legendary Weapon";
  if (/\b(STAFF|WAND|ORB|TOME|GRIMOIRE)\b/.test(p)) return "Arcane Relic";
  if (/\b(SHIELD|ARMOR|HELM|GAUNTLET)\b/.test(p)) return "Ancient Gear";

  // Magic / curses / prophecy
  if (/\b(CURSE|Cursed|HEX|DOOM|BANE)\b/.test(p)) return "Dark Curse";
  if (/\b(PROPHECY|OMEN|FATE|DESTINY)\b/.test(p)) return "Ancient Prophecy";
  if (/\b(RITUAL|SPELL|INCANTATION)\b/.test(p)) return "Forbidden Ritual";

  // Places
  if (/\b(CRYPT|TOMB|CATACOMB)\b/.test(p)) return "Haunted Ruins";
  if (/\b(CASTLE|FORTRESS|CITADEL|TOWER)\b/.test(p)) return "Dangerous Location";
  if (/\b(FOREST|SWAMP|CAVERN|MOUNTAIN)\b/.test(p)) return "Wild Territory";

  // Creatures
  if (/\b(DRAGON|WYVERN|BEAST|DEMON|GHOUL|WRAITH)\b/.test(p)) return "Monster Threat";

  // Default that’s still non-generic
  return "Hidden Mystery";
}

function isGenericCategory(cat: string) {
  const upper = (cat || "").trim().toUpperCase();
  const banned = ["EPIC QUEST", "ADVENTURE", "FANTASY", "QUEST"];
  return banned.includes(upper);
}

function looksTruncatedCategory(cat: string) {
  const c = (cat || "").trim();
  if (!c) return true;

  // Too short or too few words
  const words = c.split(/\s+/).filter(Boolean);
  if (words.length < 2) return true;
  if (c.length < 8) return true;

  // Last word suspiciously short (common truncation)
  const last = words[words.length - 1];
  if (last.length <= 2) return true;

  // Ends with incomplete-looking fragment
  if (/[A-Z]{1,2}$/.test(c)) return true; // "AR", "AN", etc.

  return false;
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const difficulty: PuzzleDifficulty = body.difficulty || "medium";
    const config = DIFFICULTY_CONFIG[difficulty];

    console.log(`[PUZZLE DEBUG] Requested difficulty: ${difficulty}`);

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const fb = pickFallback(difficulty);
      console.log(`[PUZZLE DEBUG] Fallback selected:`, fb);
      return NextResponse.json({
        ...fb,
        difficulty,
        debug: {
          source: "fallback",
          requestBody: body,
          resolvedDifficulty: difficulty,
        },
      });
    }

    let geminiDebug: Record<string, any> = {};
    let puzzle = null;
    try {
      puzzle = await generatePuzzleWithGemini({
        apiKey,
        difficulty,
        config,
        debugCollector: (info) => {
          geminiDebug = { ...geminiDebug, ...info };
        },
      });
    } catch (e) {
      geminiDebug.error =
        typeof e === "object" && e && "message" in e
          ? (e as any).message
          : String(e);
    }

    if (!puzzle) {
      const fb = pickFallback(difficulty);
      console.log(`[PUZZLE DEBUG] AI failed, fallback selected:`, fb);
      return NextResponse.json({
        ...fb,
        difficulty,
        debug: {
          source: "fallback_after_ai_failed",
          gemini: geminiDebug,
          requestBody: body,
          resolvedDifficulty: difficulty,
        },
      });
    }

    console.log(`[PUZZLE DEBUG] Gemini puzzle:`, puzzle);

    return NextResponse.json({
      ...puzzle,
      difficulty,
      debug: {
        source: "gemini",
        gemini: geminiDebug,
        requestBody: body,
        resolvedDifficulty: difficulty,
      },
    });
  } catch (error) {
    console.error(`[PUZZLE DEBUG] Internal server error:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
