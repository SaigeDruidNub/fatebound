"use client";

import { useState } from "react";

type StoryEntry = {
  prompt: string;
  action?: string;
  result?: string;
};

export default function Home() {
  const [story, setStory] = useState<StoryEntry[]>([
    {
      prompt:
        "You find yourself at the entrance of a dark dungeon. The air is thick with mystery and danger. A flickering torch lights the stone corridor ahead. What do you do?",
    },
  ]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action.trim() || loading) return;

    setLoading(true);
    const currentAction = action;
    setAction("");

    // Add user action to story
    const updatedStory = [...story];
    updatedStory[updatedStory.length - 1].action = currentAction;
    setStory(updatedStory);

    try {
      const response = await fetch("/api/adventure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousStory: story,
          action: currentAction,
        }),
      });

      const data = await response.json();

      // Add result and new prompt
      setStory([
        ...updatedStory,
        {
          prompt: data.nextPrompt,
        },
      ]);
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetGame = () => {
    setStory([
      {
        prompt:
          "You find yourself at the entrance of a dark dungeon. The air is thick with mystery and danger. A flickering torch lights the stone corridor ahead. What do you do?",
      },
    ]);
    setAction("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#511B18] via-[#1B2A30] to-[#511B18] font-sans">
      <main className="flex min-h-screen w-full max-w-4xl flex-col py-8 px-4 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-4xl font-bold text-white">Adventure Story</h1>
          <button
            onClick={resetGame}
            className="rounded-lg bg-[#B06821] px-4 py-2 text-white transition-colors hover:bg-[#9E2C21]"
          >
            New Game
          </button>
        </div>

        <div className="mb-6 flex-1 space-y-6 overflow-y-auto rounded-lg bg-[#1B2A30]/60 p-6 backdrop-blur">
          {story.map((entry, index) => (
            <div key={index} className="space-y-3">
              <div className="rounded-lg bg-[#305853]/40 p-4 border border-[#305853]">
                <p className="text-lg leading-relaxed text-white">
                  {entry.prompt}
                </p>
              </div>

              {entry.action && (
                <div className="rounded-lg bg-[#B06821]/30 p-4 border border-[#B06821]/60 ml-8">
                  <p className="text-sm font-semibold text-[#B06821] mb-1">
                    You:
                  </p>
                  <p className="text-base leading-relaxed text-white">
                    {entry.action}
                  </p>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#9E2C21] border-t-transparent"></div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="What do you do? (e.g., 'I carefully examine the floor for traps before proceeding')"
              className="w-full rounded-lg bg-[#1B2A30] p-4 text-white placeholder-[#305853] focus:outline-none focus:ring-2 focus:ring-[#B06821] min-h-[100px] resize-none border border-[#305853]/30"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !action.trim()}
            className="w-full rounded-lg bg-[#9E2C21] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#511B18] disabled:bg-[#1B2A30] disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : "Take Action"}
          </button>
        </form>
      </main>
    </div>
  );
}
