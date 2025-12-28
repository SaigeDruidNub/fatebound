import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback scenarios
      const fallbackScenarios = [
        "You approach a rickety rope bridge suspended over a bottomless chasm. The wooden planks creak ominously beneath your feet. What do you do?",
        "A treasure chest sits in the center of the room, but the floor around it is covered with suspicious-looking tiles. What do you do?",
        "You encounter a sleeping dragon blocking the only path forward. Its treasure hoard glitters behind it. What do you do?",
      ];
      return NextResponse.json({
        scenario:
          fallbackScenarios[
            Math.floor(Math.random() * fallbackScenarios.length)
          ],
      });
    }

    const systemPrompt = `Create a dramatic adventure challenge for a game (2-3 sentences max).

REQUIREMENTS:
✓ Present a clear danger or obstacle
✓ Give players a meaningful choice
✓ End with "What do you do?"
✓ Be specific and vivid (not generic)
✓ Create tension and urgency

AVOID:
✗ Falling/collapsing floors or bridges
✗ Bottomless pits or falling hazards  
✗ Overused fantasy clichés
✗ Vague descriptions

DANGER TYPES (pick one):
• Enemy/creature encounter (blocking path, hunting, guarding)
• Environmental threat (fire, poison, water, darkness, thorns)
• Moral choice (save someone, sacrifice, betray)
• Resource crisis (low supplies, time limit, broken equipment)
• Mystery/puzzle (trapped, cursed object, riddle door)
• Social encounter (hostile guards, suspicious NPC, negotiation)

EXAMPLES:
"Three guards approach, swords drawn. One whispers 'Run now, or they'll see you too.' The others are seconds away. What do you do?"

"The ancient tree's roots writhe, pulling your companion underground. You hear muffled screams as vines wrap around your legs. What do you do?"

"Your map dissolves in your hands - it was cursed. Behind you, the maze walls shift and grind, sealing the path you came from. What do you do?"

Write ONE new scenario (different from examples):`;

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
            temperature: 1.2,
            maxOutputTokens: 150,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Gemini API failed");
    }

    const data = await response.json();
    const scenario = data.candidates[0].content.parts[0].text.trim();

    return NextResponse.json({ scenario });
  } catch (error) {
    console.error("Error generating scenario:", error);
    return NextResponse.json({
      scenario:
        "You find yourself at a crossroads with three paths. One glows faintly, one is pitch black, and one echoes with strange sounds. What do you do?",
    });
  }
}
