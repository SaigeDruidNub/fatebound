import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback puzzles
      const fallbackPuzzles = [
        { phrase: "THE TREASURE IS CURSED", category: "Adventure Warning" },
        { phrase: "ESCAPE FROM THE DUNGEON", category: "Classic Quest" },
        { phrase: "BEWARE OF THE DRAGON", category: "Monster Alert" },
      ];
      const puzzle =
        fallbackPuzzles[Math.floor(Math.random() * fallbackPuzzles.length)];
      return NextResponse.json(puzzle);
    }

    const systemPrompt = `You are creating puzzles for an adventure game similar to Wheel of Fortune.
Generate a puzzle phrase related to adventures, quests, dungeons, fantasy, or heroic themes.

Rules:
- Phrase must be 3–6 words
- Use ONLY capital letters and spaces
- No punctuation or numbers
- Phrase should be exciting and evocative
- Do NOT always start with a verb
- Avoid overused verbs like FIND ESCAPE BATTLE

Choose ONE phrase style:
- Imperative action
- Descriptive location
- Dramatic situation
- Hero identity or title
- Legendary object or artifact
- Mythic event or prophecy
- Respond ONLY with a JSON object: { "phrase": "YOUR PHRASE HERE", "category": "Category Name" }
- Categories must match the chosen phrase style and be adventure-themed.`;

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
            temperature: 1.0,
            maxOutputTokens: 100,
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
      phrase: "SEEK THE ANCIENT ARTIFACT",
      category: "Epic Quest",
    });
  } catch (error) {
    console.error("Error generating puzzle:", error);
    return NextResponse.json({
      phrase: "DISCOVER THE LOST TEMPLE",
      category: "Adventure Quest",
    });
  }
}
