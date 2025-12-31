import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const body = await request.json().catch(() => ({}));
    const recentScenarios = body.recentScenarios || [];

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

      // Filter out any that were recently used
      const available = fallbackScenarios.filter(
        (s) => !recentScenarios.includes(s)
      );
      const choices = available.length > 0 ? available : fallbackScenarios;

      return NextResponse.json({
        scenario: choices[Math.floor(Math.random() * choices.length)],
      });
    }

    const recentScenariosText =
      recentScenarios.length > 0
        ? `\n\nDO NOT REPEAT these recent scenarios:\n${recentScenarios
            .map((s: string, i: number) => `${i + 1}. ${s}`)
            .join("\n")}\n\nCreate something COMPLETELY DIFFERENT.`
        : "";

    const prompt = `Create a vivid, unique adventure scenario (2 sentences, end with 'What do you do?'). Avoid clichés. Be specific.`;
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
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 1.2,
            maxOutputTokens: 80,
            responseMimeType: "text/plain",
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
