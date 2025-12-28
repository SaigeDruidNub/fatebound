import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback puzzles with much more variety
      const fallbackPuzzles = [
        { phrase: "THE TREASURE IS CURSED", category: "Adventure Warning" },
        { phrase: "BEWARE OF THE DRAGON", category: "Monster Alert" },
        { phrase: "LOST IN THE HAUNTED FOREST", category: "Spooky Quest" },
        { phrase: "CLIMBING THE FROZEN MOUNTAIN", category: "Epic Challenge" },
        { phrase: "GUARDIAN OF THE ANCIENT RUINS", category: "Mythic Title" },
        { phrase: "CROSSING THE BURNING DESERT", category: "Survival Quest" },
        { phrase: "RIDDLE OF THE SPHINX", category: "Ancient Mystery" },
        { phrase: "SWORD IN THE STONE", category: "Legendary Artifact" },
        { phrase: "SHADOW OF THE TOWER", category: "Dark Location" },
        { phrase: "WHISPERS IN THE DARK", category: "Eerie Encounter" },
        { phrase: "CHAMPION OF THE ARENA", category: "Heroic Title" },
        { phrase: "CURSE OF THE PHARAOH", category: "Ancient Doom" },
        { phrase: "SWIMMING WITH SEA MONSTERS", category: "Oceanic Danger" },
        { phrase: "KEEPER OF THE FLAME", category: "Sacred Duty" },
        { phrase: "THRONE OF SKULLS", category: "Dark Throne" },
      ];
      const puzzle =
        fallbackPuzzles[Math.floor(Math.random() * fallbackPuzzles.length)];
      return NextResponse.json(puzzle);
    }

    const systemPrompt = `Create a puzzle phrase for an adventure game like Wheel of Fortune.

REQUIREMENTS:
- 3 to 6 words total
- CAPITAL LETTERS ONLY (no lowercase)
- NO punctuation, numbers, or special characters
- Adventure/fantasy themed
- Exciting and evocative

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

AVOID THESE OVERUSED PHRASES:
- "SEEK THE ANCIENT..."
- "FIND THE LOST..."
- "ESCAPE FROM THE..."
- "DEFEAT THE EVIL..."
- Generic "THE TREASURE" phrases

GOOD EXAMPLES:
- "KEEPER OF THE FLAME"
- "SWIMMING WITH SHARKS"
- "CURSE OF THE MUMMY"
- "THRONE OF BONES"
- "WHISPERS IN DARKNESS"
- "CHAMPION OF THE PIT"

Respond with ONLY this JSON (no extra text):
{ "phrase": "YOUR PHRASE", "category": "Category Name" }

Make it UNIQUE and EXCITING!`;

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
            temperature: 1.3,
            maxOutputTokens: 100,
            topP: 0.95,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Gemini API failed");
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text.trim();

    // Try to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const puzzle = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        phrase: puzzle.phrase.toUpperCase(),
        category: puzzle.category,
      });
    }

    // Fallback
    return NextResponse.json({
      phrase: "GUARDIAN OF THE RUINS",
      category: "Mythic Protector",
    });
  } catch (error) {
    console.error("Error generating puzzle:", error);
    return NextResponse.json({
      phrase: "SHADOW OF THE COLOSSUS",
      category: "Epic Encounter",
    });
  }
}
