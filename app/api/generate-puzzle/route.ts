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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const difficulty: PuzzleDifficulty = body.difficulty || "medium";
    const config = DIFFICULTY_CONFIG[difficulty];

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.log("⚠️ No GEMINI_API_KEY found, using fallback puzzles");
      // Fallback puzzles organized by difficulty
      const fallbackPuzzles: Record<
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
          {
            phrase: "GUARDIAN OF CELESTIAL SECRETS",
            category: "Cosmic Keeper",
          },
        ],
        "very-hard": [
          {
            phrase: "CHRONICLE OF THE FALLEN EMPIRE STATE",
            category: "Ancient History",
          },
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

      const puzzles = fallbackPuzzles[difficulty];
      const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
      return NextResponse.json({ ...puzzle, difficulty });
    }

    const examplesText = config.examples
      .map((ex, i) => `${i + 1}. "${ex}"`)
      .join("\n");

    const systemPrompt = `Create a puzzle phrase for an adventure game like Wheel of Fortune.

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
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
            temperature: 1.3,
            maxOutputTokens: 100,
            topP: 0.95,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Gemini API response received");
    const text = data.candidates[0].content.parts[0].text.trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const puzzle = JSON.parse(jsonMatch[0]);
      console.log("✅ Generated puzzle:", puzzle.phrase);
      return NextResponse.json({
        phrase: puzzle.phrase.toUpperCase(),
        category: puzzle.category,
        difficulty,
      });
    }

    console.log("⚠️ No JSON found in response, using fallback");
    // Fallback
    return NextResponse.json({
      phrase: "GUARDIAN OF THE RUINS",
      category: "Mythic Protector",
      difficulty,
    });
  } catch (error) {
    console.error("Error generating puzzle:", error);
    return NextResponse.json({
      phrase: "SHADOW OF THE COLOSSUS",
      category: "Epic Encounter",
      difficulty: "medium",
    });
  }
}
