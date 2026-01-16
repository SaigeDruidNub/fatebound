// Centralized scenario generation for Fatebound

export async function generateScenario(recentScenarios: string[] = []) {
  const apiKey = process.env.GEMINI_API_KEY;

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

  const pickFallback = () => {
    const available = fallbackScenarios.filter(
      (s) => !recentScenarios.includes(s),
    );
    const choices = available.length > 0 ? available : fallbackScenarios;
    return choices[Math.floor(Math.random() * choices.length)];
  };

  if (!apiKey) return pickFallback();

  // --- helpers to salvage partial outputs ---

  const clean = (t: string) =>
    (t || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  // Appends 'What do you do?' only if not already present (case-insensitive, ignores trailing punctuation/whitespace)
  function appendWhatDoYouDoOnce(text: string): string {
    const cleaned = clean(text);
    // Regex: ends with 'what do you do' (case-insensitive), optional punctuation, optional whitespace
    if (/what do you do[.?!"']*\s*$/i.test(cleaned)) {
      return cleaned.replace(/([.?!"']*)\s*$/i, "?"); // Normalize ending to '?'
    }
    return cleaned.replace(/[.?!"']*\s*$/, "") + ". What do you do?";
  }

  const ensureEnding = (t: string) => {
    const trimmed = clean(t);
    const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length < 2) {
      return "";
    }
    const base = sentences.slice(0, 2).join(" ");
    return appendWhatDoYouDoOnce(base);
  };

  const systemInstruction = `
You write adventure scenarios for a fantasy RPG word-puzzle game.

OUTPUT RULES:
- Output ONLY the scenario text (no preface, no markdown).
- EXACTLY 2 sentences.
- Total length: 30–55 words.
- Sentence 1: present a concrete danger or dilemma.
- Sentence 2: present a meaningful choice and END with "What do you do?"
- Avoid collapsing bridges/falling floors/pits.
- Do not reuse recent scenarios.
`.trim();

  const recentBlock =
    recentScenarios.length > 0
      ? `Recent scenarios to avoid:\n${recentScenarios
          .slice(-5)
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n")}`
      : "";

  const userPrompt = `
Create one new, unique scenario.
${recentBlock}
`.trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 1500,
            stopSequences: ["What do you do?"],
          },
        }),
      },
    );

    if (!response.ok) {
      return pickFallback();
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const rawText = parts
      .map((p: any) => p?.text ?? "")
      .join("")
      .trim();
    const scenario = ensureEnding(rawText);
    if (!scenario || scenario.length < 30) {
      return pickFallback();
    }
    return scenario;
  } catch (err) {
    return pickFallback();
  }
}
