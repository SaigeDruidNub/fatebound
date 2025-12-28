import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/gameStore";
import { PuzzleDifficulty } from "@/types/game";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get(
      "difficulty"
    ) as PuzzleDifficulty | null;
    const limit = parseInt(searchParams.get("limit") || "10");

    const leaderboard = await getLeaderboard(difficulty || undefined, limit);

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
