import { NextRequest, NextResponse } from "next/server";
import { saveLeaderboardEntry } from "@/lib/gameStore";
import { LeaderboardEntry } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerName, score, difficulty, gameId } = body;

    if (
      !playerName ||
      typeof playerName !== "string" ||
      playerName.length > 20
    ) {
      return NextResponse.json(
        { error: "Player name must be 1-20 characters." },
        { status: 400 }
      );
    }
    if (typeof score !== "number" || !difficulty || !gameId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const entry: LeaderboardEntry = {
      playerName,
      score,
      difficulty,
      date: Date.now(),
      gameId,
    };

    await saveLeaderboardEntry(entry);

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error("Error submitting leaderboard entry:", error);
    return NextResponse.json(
      { error: "Failed to submit leaderboard entry" },
      { status: 500 }
    );
  }
}
