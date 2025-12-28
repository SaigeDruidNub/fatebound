import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

function cleanAction(text: string) {
  // Keep it readable + safe for your game log
  // Allow common punctuation; remove anything weird
  return text
    .replace(/[^\w\s'.,!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidAction(text: string) {
  const len = text.length;
  if (len < 20 || len > 140) return false; // keep it tight
  // avoid meta/system leakage
  const banned = ["as an ai", "i cannot", "system prompt", "json", "model"];
  const lower = text.toLowerCase();
  if (banned.some((b) => lower.includes(b))) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const { botName, lives, personality, scenario } = await req.json();

    // Gemini model name: adjust to whatever you're actually using in your project
    // Common preview IDs include: "gemini-1.5-pro" or preview variants.
    // If you already know the exact one, swap it here.
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro", // <-- change to your exact "Gemini Pro Preview" model id if different
      generationConfig: {
        temperature: 1.0,       // higher => more variety
        topP: 0.9,
        maxOutputTokens: 60,
      },
    });

    const system = `
You write ONE first-person action a bot takes in an adventure game.
Rules:
- Output ONE sentence.
- 8 to 22 words.
- No quotes, no lists, no emojis.
- Be specific and varied; avoid generic "I proceed carefully" phrasing.
- Must be plausible given the scenario and personality.
- No meta commentary.
`.trim();

    const user = `
Bot: ${botName}
Lives: ${lives}
Personality: ${personality}
Scenario: ${scenario}

Write the bot's action:
`.trim();

    const result = await model.generateContent([system, user]);
    const raw = result.response.text() || "";
    const cleaned = cleanAction(raw);

    if (!isValidAction(cleaned)) {
      return NextResponse.json({ error: "Invalid AI action" }, { status: 400 });
    }

    return NextResponse.json({ action: cleaned });
  } catch (e) {
    console.error("Gemini bot-action error:", e);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
