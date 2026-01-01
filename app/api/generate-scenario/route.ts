import { NextRequest, NextResponse } from "next/server";
import { generateScenario } from "@/lib/scenario";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const body = await request.json().catch(() => ({}));
    const recentScenarios = body.recentScenarios || [];

    const scenario = await generateScenario(recentScenarios);
    return NextResponse.json({ scenario });
  } catch (error) {
    console.error("Error generating scenario:", error);
    return NextResponse.json({
      scenario:
        "You find yourself at a crossroads with three paths. One glows faintly, one is pitch black, and one echoes with strange sounds. What do you do?",
    });
  }
}
