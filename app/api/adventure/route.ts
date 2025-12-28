import { NextRequest, NextResponse } from "next/server";

type StoryEntry = {
  prompt: string;
  action?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { previousStory, action } = await request.json();

    // Get the current situation
    const currentPrompt = previousStory[previousStory.length - 1].prompt;

    // Build context from previous story
    const storyContext = previousStory
      .slice(-3) // Only use last 3 entries for context
      .map((entry: StoryEntry) => {
        let text = `Situation: ${entry.prompt}`;
        if (entry.action) {
          text += `\nPlayer Action: ${entry.action}`;
        }
        return text;
      })
      .join("\n\n");

    const systemPrompt = `You are a creative dungeon master for an adventure story game. 
The player describes their actions, and you determine the outcome and present the next scenario.

Rules:
- Be creative and descriptive
- Make outcomes realistic based on the player's actions
- Include consequences (both positive and negative) based on their choices
- Keep the story engaging with varied scenarios
- Sometimes let clever or cautious actions succeed, sometimes add unexpected twists
- End each response with a new situation/prompt that gives the player options
- Keep responses concise but vivid (2-4 sentences for the outcome, 1-2 for the new situation)`;

    const userPrompt = `Previous context:
${storyContext}

Current situation: ${currentPrompt}
Player's action: ${action}

Describe what happens as a result of the player's action, then present a new situation/prompt for them to respond to. Format your response as a continuous narrative that flows naturally.`;

    // Use Google Gemini API
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback to a simple rule-based system if no API key
      const nextPrompt = generateFallbackResponse(action, currentPrompt);
      return NextResponse.json({ nextPrompt });
    }

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
            temperature: 0.8,
            maxOutputTokens: 300,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Gemini API request failed");
    }

    const data = await response.json();
    const nextPrompt = data.candidates[0].content.parts[0].text.trim();

    return NextResponse.json({ nextPrompt });
  } catch (error) {
    console.error("Error in adventure API:", error);
    return NextResponse.json(
      { error: "Failed to generate story continuation" },
      { status: 500 }
    );
  }
}

// Fallback response generator when API key is not available
function generateFallbackResponse(
  action: string,
  currentPrompt: string
): string {
  const actionLower = action.toLowerCase();

  // Simple keyword-based responses
  if (
    actionLower.includes("trap") ||
    actionLower.includes("careful") ||
    actionLower.includes("examine")
  ) {
    return "Your cautious approach pays off! You spot subtle pressure plates on the floor and carefully navigate around them. You successfully reach the treasure chest and claim your reward - a gleaming golden amulet! As you turn to leave, you notice another corridor leading deeper into the dungeon. Strange sounds echo from within. What do you do?";
  } else if (
    actionLower.includes("run") ||
    actionLower.includes("rush") ||
    actionLower.includes("sprint")
  ) {
    return "You dash forward recklessly! Suddenly, arrows shoot from the walls - you narrowly dodge most of them but take a grazing hit to your shoulder. The treasure chest is now within reach, but you're wounded and hear footsteps approaching. What do you do?";
  } else if (
    actionLower.includes("magic") ||
    actionLower.includes("spell") ||
    actionLower.includes("cast")
  ) {
    return "You cast a detection spell that reveals hidden magical wards around the room. By speaking the counter-charm, you safely deactivate the traps. The treasure chest opens to reveal ancient scrolls of power! However, your magic has alerted the dungeon guardian. A massive stone golem awakens nearby. What do you do?";
  } else {
    return "You proceed with your plan. Things don't go exactly as expected - there's resistance, but you manage to make progress. The situation has changed now. You find yourself in a new chamber with multiple paths ahead: one lit by torches, one dark and cold, and one that seems to pulse with an eerie glow. What do you do?";
  }
}
