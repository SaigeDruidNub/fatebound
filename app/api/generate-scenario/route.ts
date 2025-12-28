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

    const systemPrompt = `You are creating adventure challenges for a game.
Generate a dangerous, exciting scenario that the player must overcome.

Rules:
- Keep it 1–3 sentences
- Make it dramatic and engaging
- End with "What do you do?"
- Present danger that requires a decision, not just a reflex
- Include at least one obstacle AND one meaningful choice

Constraints:
- Do NOT use falling bridges, collapsing floors, or bottomless pits
- Avoid gravity-only hazards
- Avoid repeating common fantasy tropes
- Make each scenario feel distinct

Choose ONE primary danger type:
- Intelligent enemy or ambush
- Environmental hazard (fire, ice, poison, storm, darkness)
- Moral dilemma or hostage situation
- Time pressure or countdown
- Equipment failure or limited resources
- Psychological or sensory distortion

Examples of strong scenarios:
- "Your torch sputters out as whispers begin answering your thoughts, offering guidance at a price. Footsteps close in from behind. What do you do?"
- "A wounded enemy blocks the only exit while the chamber fills with toxic gas, and they beg for help. What do you do?"

Respond ONLY with the scenario text, nothing else.`;

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
