"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Player, GamePhase } from "@/types/game";

type GameState = {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  puzzle: {
    phrase: string;
    category: string;
    revealedLetters: string[];
  };
  currentScenario: string;
  roundNumber: number;
  winner: string | null;
};

export default function Home() {
  const [gameId, setGameId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [action, setAction] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const [puzzleGuess, setPuzzleGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [lastOutcome, setLastOutcome] = useState("");
  const [botThinking, setBotThinking] = useState(false);

  // Sync gameId from gameState if needed
  useEffect(() => {
    if (gameState?.id && !gameId) {
      console.log("Syncing gameId from gameState:", gameState.id);
      setGameId(gameState.id);
    }
  }, [gameState, gameId]);

  // Poll for game state updates
  useEffect(() => {
    if (!gameId) return;
    // Don't poll if game is over
    if (gameState?.phase === "game-over") return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/game/${gameId}`);
        if (response.ok) {
          const data = await response.json();
          setGameState(data);
        }
      } catch (error) {
        console.error("Error fetching game state:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [gameId, gameState?.phase]);

  // Auto-play bot turns
  useEffect(() => {
    if (!gameState || botThinking || loading) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (
      currentPlayer?.isBot &&
      (gameState.phase === "playing" || gameState.phase === "letter-selection")
    ) {
      // Wait a bit so it feels natural
      setBotThinking(true);

      setTimeout(async () => {
        try {
          const response = await fetch("/api/game/bot-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameId }),
          });

          const data = await response.json();
          setGameState(data.gameState);

          if (data.outcome) {
            setLastOutcome(data.outcome);
          }
          if (data.message) {
            setMessage(
              `${currentPlayer.name} ${data.botAction}: ${data.message}`
            );
          }
        } catch (error) {
          console.error("Error processing bot action:", error);
        } finally {
          setBotThinking(false);
        }
      }, 1500 + Math.random() * 1000); // Random delay 1.5-2.5 seconds
    }

    // Auto-continue for bots after failure
    if (gameState.phase === "waiting-continue" && currentPlayer?.isBot) {
      setBotThinking(true);
      setTimeout(async () => {
        try {
          await continueGame();
        } finally {
          setBotThinking(false);
        }
      }, 2000);
    }
  }, [gameState, botThinking, loading, gameId]);

  const createGame = async () => {
    if (!playerName.trim()) {
      setMessage("Please enter your name");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Create game error:", errorData);
        setMessage(
          `Error creating game: ${errorData.error || "Unknown error"}`
        );
        return;
      }

      const data = await response.json();
      console.log("Game created:", data);
      setGameId(data.gameId);
      setPlayerId(data.playerId);
      setGameState(data.gameState);
      setMessage(`Game created! Share this code: ${data.gameId}`);
    } catch (error) {
      console.error("Error creating game:", error);
      setMessage("Error creating game");
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async () => {
    if (!playerName.trim() || !gameId.trim()) {
      setMessage("Please enter your name and game code");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/game/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, playerName }),
      });

      if (!response.ok) {
        throw new Error("Failed to join game");
      }

      const data = await response.json();
      setPlayerId(data.playerId);
      setGameState(data.gameState);
      setMessage("Joined game successfully!");
    } catch (error) {
      setMessage("Error joining game - check the game code");
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });

      const data = await response.json();
      setGameState(data.gameState);
    } catch (error) {
      setMessage("Error starting game");
    } finally {
      setLoading(false);
    }
  };

  const addBot = async () => {
    if (!gameId) {
      setMessage("Error: No game ID found. Please refresh and try again.");
      return;
    }

    console.log("Adding bot to game:", gameId);
    setLoading(true);
    try {
      const response = await fetch("/api/game/add-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });

      console.log(
        "Add bot response status:",
        response.status,
        response.statusText
      );

      if (!response.ok) {
        let errorMessage = "Unknown error";
        try {
          const errorData = await response.json();
          console.error("Add bot error data:", JSON.stringify(errorData));
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error("Could not parse error response:", e);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        setMessage(`Error adding bot: ${errorMessage}`);
        return;
      }

      const data = await response.json();
      console.log("Bot added successfully, new game state:", data);
      setGameState(data.gameState);
      setMessage("");
    } catch (error) {
      console.error("Error adding bot:", error);
      setMessage(
        `Error adding bot: ${
          error instanceof Error ? error.message : "Network error"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const submitAction = async () => {
    if (!action.trim() || loading) return;

    if (!gameId) {
      setMessage("Error: No game ID found. Please refresh and try again.");
      console.error("No gameId when submitting action");
      return;
    }

    if (!playerId) {
      setMessage("Error: No player ID found. Please refresh and try again.");
      console.error("No playerId when submitting action");
      return;
    }

    setLoading(true);
    setLastOutcome("");

    console.log("Submitting action:", {
      gameId,
      playerId,
      action: action.substring(0, 50),
    });

    try {
      const response = await fetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, playerId, action }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = {
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        console.error("Action submission error:", errorData);
        setMessage(
          errorData.error || `Failed to submit action (${response.status})`
        );
        return;
      }

      const data = await response.json();
      console.log("Action response:", data);

      if (data.gameState) {
        setGameState(data.gameState);
      }
      if (data.outcome) {
        setLastOutcome(data.outcome);
      }
      setAction("");
    } catch (error) {
      console.error("Error submitting action:", error);
      setMessage(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const submitLetter = async () => {
    if (!selectedLetter || loading) return;

    if (!gameId || !playerId) {
      setMessage("Error: Missing game or player information");
      return;
    }

    console.log("Submitting letter:", selectedLetter, "for game:", gameId);
    setLoading(true);
    try {
      const response = await fetch("/api/game/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, playerId, letter: selectedLetter }),
      });

      console.log(
        "Letter response status:",
        response.status,
        response.statusText
      );

      if (!response.ok) {
        let errorMessage = "Failed to submit letter";
        try {
          const errorData = await response.json();
          console.error(
            "Letter submission error data:",
            JSON.stringify(errorData)
          );
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error("Could not parse error response:", e);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        setMessage(errorMessage);
        return;
      }

      const data = await response.json();
      console.log("Letter submitted successfully:", data);
      if (data.gameState) {
        setGameState(data.gameState);
      }
      setSelectedLetter("");
      if (data.message) {
        setMessage(data.message);
      }
    } catch (error) {
      console.error("Error submitting letter:", error);
      setMessage(
        `Error submitting letter: ${
          error instanceof Error ? error.message : "Network error"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const guessPuzzle = async () => {
    if (!puzzleGuess.trim() || loading) return;

    setLoading(true);
    try {
      const response = await fetch("/api/game/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, playerId, guess: puzzleGuess }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Guess submission error:", errorData);
        setMessage(errorData.error || "Failed to submit guess");
        return;
      }

      const data = await response.json();
      if (data.gameState) {
        setGameState(data.gameState);
      }
      setPuzzleGuess("");
      if (data.message) {
        setMessage(data.message);
      }
    } catch (error) {
      console.error("Error submitting guess:", error);
      setMessage("Error submitting guess");
    } finally {
      setLoading(false);
    }
  };

  const continueGame = async () => {
    setLoading(true);
    setLastOutcome("");
    try {
      const response = await fetch("/api/game/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Continue game error:", errorData);
        setMessage(errorData.error || "Failed to continue game");
        return;
      }

      const data = await response.json();
      if (data.gameState) {
        setGameState(data.gameState);
      }
    } catch (error) {
      console.error("Error continuing game:", error);
      setMessage("Error continuing game");
    } finally {
      setLoading(false);
    }
  };

  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const me = gameState?.players.find((p) => p.id === playerId);

  // Render puzzle board
  const renderPuzzleBoard = () => {
    if (!gameState) return null;

    const words = gameState.puzzle.phrase.split(" ");

    return (
      <div className="mb-6 rounded-lg bg-[#1B2A30] p-6 border-2 border-[#B06821]">
        <div className="text-center mb-4">
          <p className="text-[#B06821] font-bold text-lg">
            {gameState.puzzle.category}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {words.map((word, wordIdx) => (
            <div key={wordIdx} className="flex gap-1">
              {word.split("").map((letter, letterIdx) => {
                const isRevealed = gameState.puzzle.revealedLetters.includes(
                  letter.toUpperCase()
                );
                return (
                  <div
                    key={letterIdx}
                    className="w-10 h-14 sm:w-12 sm:h-16 border-2 border-white bg-white/10 flex items-center justify-center text-2xl font-bold text-white"
                  >
                    {isRevealed ? letter.toUpperCase() : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Lobby Screen
  if (!gameState || gameState.phase === "lobby") {
    return (
      <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#511B18] via-[#1B2A30] to-[#511B18] font-sans pt-12">
        <main className="w-full max-w-2xl p-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/Fatebound.png"
              alt="Fatebound - Where Words Decide"
              width={600}
              height={400}
              priority
              className="max-w-full h-auto"
            />
          </div>

          {!gameState ? (
            <div className="space-y-6 bg-[#1B2A30]/60 p-8 rounded-lg backdrop-blur">
              <div>
                <label className="block text-white mb-2">Your Name:</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full rounded-lg bg-[#305853] p-3 text-white border border-[#B06821] focus:outline-none focus:ring-2 focus:ring-[#B06821]"
                  placeholder="Enter your name"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={createGame}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-[#9E2C21] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#511B18] disabled:bg-[#1B2A30]"
                >
                  Create Game
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[#305853]"></div>
                <span className="text-[#305853]">OR</span>
                <div className="flex-1 h-px bg-[#305853]"></div>
              </div>

              <div>
                <label className="block text-white mb-2">Game Code:</label>
                <input
                  type="text"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value.toUpperCase())}
                  className="w-full rounded-lg bg-[#305853] p-3 text-white border border-[#B06821] focus:outline-none focus:ring-2 focus:ring-[#B06821]"
                  placeholder="Enter game code"
                />
              </div>

              <button
                onClick={joinGame}
                disabled={loading}
                className="w-full rounded-lg bg-[#B06821] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#9E2C21] disabled:bg-[#1B2A30]"
              >
                Join Game
              </button>

              {message && (
                <div className="text-center text-white bg-[#305853] p-3 rounded">
                  {message}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 bg-[#1B2A30]/60 p-8 rounded-lg backdrop-blur">
              <div className="text-center">
                <p className="text-2xl text-white mb-2">
                  Game Code:{" "}
                  <span className="text-[#B06821] font-bold">
                    {gameState.id}
                  </span>
                </p>
                <p className="text-[#305853]">
                  Share this code with other players
                </p>
              </div>

              <div>
                <h3 className="text-white font-bold mb-3">
                  Players ({gameState.players.length}):
                </h3>
                <div className="space-y-2">
                  {gameState.players.map((player) => (
                    <div
                      key={player.id}
                      className="bg-[#305853]/40 p-3 rounded border border-[#305853] text-white flex items-center justify-between"
                    >
                      <span>
                        {player.name} {player.id === playerId && "(You)"}
                      </span>
                      {player.isBot && (
                        <span className="text-xs text-[#B06821] bg-[#B06821]/20 px-2 py-1 rounded">
                          BOT
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {gameState.players[0]?.id === playerId && (
                <>
                  <button
                    onClick={addBot}
                    disabled={loading || gameState.players.length >= 8}
                    className="w-full rounded-lg bg-[#305853] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#B06821] disabled:bg-[#1B2A30] disabled:cursor-not-allowed"
                  >
                    + Add Computer Player
                  </button>

                  <button
                    onClick={startGame}
                    disabled={loading || gameState.players.length < 2}
                    className="w-full rounded-lg bg-[#9E2C21] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#511B18] disabled:bg-[#1B2A30] disabled:cursor-not-allowed"
                  >
                    {gameState.players.length < 2
                      ? "Need at least 2 players (add bots or wait for others)"
                      : "Start Game"}
                  </button>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Game Over Screen
  if (gameState.phase === "game-over") {
    const winner = gameState.players.find((p) => p.id === gameState.winner);
    return (
      <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#511B18] via-[#1B2A30] to-[#511B18] font-sans pt-12">
        <main className="w-full max-w-4xl p-8">
          <div className="text-center space-y-6 bg-[#1B2A30]/60 p-12 rounded-lg backdrop-blur">
            <div className="flex justify-center mb-2">
              <Image
                src="/Fatebound.png"
                alt="Fatebound - Where Words Decide"
                width={500}
                height={333}
                className="max-w-full h-auto"
              />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Game Over!</h1>
            <div className="text-3xl text-[#B06821] font-bold">
              🏆 {winner?.name} wins! 🏆
            </div>
            <div className="text-xl text-white">
              The puzzle was:{" "}
              <span className="text-[#B06821]">{gameState.puzzle.phrase}</span>
            </div>

            <div className="mt-8">
              <h3 className="text-white font-bold mb-4">Final Scores:</h3>
              <div className="space-y-2">
                {gameState.players
                  .sort((a, b) => b.score - a.score)
                  .map((player) => (
                    <div
                      key={player.id}
                      className="flex justify-between bg-[#305853]/40 p-4 rounded border border-[#305853] text-white"
                    >
                      <span>{player.name}</span>
                      <span className="text-[#B06821] font-bold">
                        {player.score} points
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="mt-8 rounded-lg bg-[#9E2C21] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#511B18]"
            >
              Play Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Main Game Screen
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#511B18] via-[#1B2A30] to-[#511B18] font-sans p-4">
      <main className="w-full max-w-7xl mx-auto flex gap-4">
        {/* Left sidebar - Players */}
        <div className="w-64 space-y-4">
          <div className="bg-[#1B2A30]/60 p-4 rounded-lg backdrop-blur">
            <h3 className="text-white font-bold mb-3">Players</h3>
            <div className="space-y-2">
              {gameState.players.map((player, idx) => (
                <div
                  key={player.id}
                  className={`p-3 rounded border ${
                    idx === gameState.currentPlayerIndex
                      ? "bg-[#B06821]/30 border-[#B06821]"
                      : "bg-[#305853]/20 border-[#305853]/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-semibold text-sm ${
                        player.isAlive
                          ? "text-white"
                          : "text-red-500 line-through"
                      }`}
                    >
                      {player.name}
                      {player.id === playerId && " (You)"}
                      {player.isBot && " 🤖"}
                    </span>
                    {idx === gameState.currentPlayerIndex && (
                      <span className="text-[#B06821]">👉</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#B06821]">{player.score} pts</span>
                    {player.isAlive && (
                      <span className="text-white">
                        {"❤️".repeat(player.lives || 0)}
                      </span>
                    )}
                  </div>
                  {!player.isAlive && (
                    <div className="text-xs text-red-400">Eliminated</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1B2A30]/60 p-4 rounded-lg backdrop-blur">
            <div className="text-white text-sm">
              <div>Round: {gameState.roundNumber}</div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-4">
          {renderPuzzleBoard()}

          {/* Current scenario */}
          {gameState.phase === "playing" && (
            <div className="bg-[#305853]/40 p-6 rounded-lg border border-[#305853]">
              <h3 className="text-[#B06821] font-bold mb-2">
                Current Challenge:
              </h3>
              <p className="text-white text-lg leading-relaxed">
                {gameState.currentScenario}
              </p>
            </div>
          )}

          {/* Last outcome */}
          {lastOutcome && (
            <div className="bg-[#B06821]/20 p-4 rounded-lg border border-[#B06821]">
              <p className="text-white">{lastOutcome}</p>
            </div>
          )}

          {/* Action input or letter selection */}
          {me?.isAlive && (
            <>
              {gameState.phase === "playing" && isMyTurn && (
                <div className="space-y-4 bg-[#1B2A30]/60 p-6 rounded-lg backdrop-blur">
                  <p className="text-white font-bold">
                    Your turn! What do you do?
                  </p>
                  <textarea
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="Describe your action..."
                    className="w-full rounded-lg bg-[#305853] p-4 text-white placeholder-[#305853]/60 focus:outline-none focus:ring-2 focus:ring-[#B06821] min-h-[100px] resize-none border border-[#B06821]/30"
                    disabled={loading}
                  />
                  <button
                    onClick={submitAction}
                    disabled={loading || !action.trim()}
                    className="w-full rounded-lg bg-[#9E2C21] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#511B18] disabled:bg-[#1B2A30] disabled:cursor-not-allowed"
                  >
                    {loading ? "Processing..." : "Take Action"}
                  </button>
                </div>
              )}

              {gameState.phase === "letter-selection" && isMyTurn && (
                <div className="space-y-4 bg-[#1B2A30]/60 p-6 rounded-lg backdrop-blur">
                  <p className="text-white font-bold">
                    You survived! Choose a letter or solve the puzzle:
                  </p>

                  <div>
                    <label className="block text-white mb-2">
                      Pick a Letter:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={1}
                        value={selectedLetter}
                        onChange={(e) =>
                          setSelectedLetter(e.target.value.toUpperCase())
                        }
                        className="w-20 rounded-lg bg-[#305853] p-3 text-white text-center text-2xl border border-[#B06821] focus:outline-none focus:ring-2 focus:ring-[#B06821]"
                        placeholder="?"
                      />
                      <button
                        onClick={submitLetter}
                        disabled={loading || !selectedLetter}
                        className="flex-1 rounded-lg bg-[#B06821] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#9E2C21] disabled:bg-[#1B2A30]"
                      >
                        Submit Letter
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-[#305853]"></div>
                    <span className="text-[#305853]">OR</span>
                    <div className="flex-1 h-px bg-[#305853]"></div>
                  </div>

                  <div>
                    <label className="block text-white mb-2">
                      Solve the Puzzle:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={puzzleGuess}
                        onChange={(e) =>
                          setPuzzleGuess(e.target.value.toUpperCase())
                        }
                        className="flex-1 rounded-lg bg-[#305853] p-3 text-white border border-[#B06821] focus:outline-none focus:ring-2 focus:ring-[#B06821]"
                        placeholder="Enter full phrase"
                      />
                      <button
                        onClick={guessPuzzle}
                        disabled={loading || !puzzleGuess.trim()}
                        className="rounded-lg bg-[#9E2C21] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#511B18] disabled:bg-[#1B2A30]"
                      >
                        Solve
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {gameState.phase === "waiting-continue" && (
                <div className="text-center bg-[#1B2A30]/60 p-6 rounded-lg backdrop-blur space-y-4">
                  <p className="text-white text-lg">
                    {currentPlayer?.name}{" "}
                    {currentPlayer?.id === playerId ? "(You)" : ""} failed the
                    challenge!
                  </p>
                  {!currentPlayer?.isBot && (
                    <button
                      onClick={continueGame}
                      disabled={loading}
                      className="rounded-lg bg-[#B06821] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#9E2C21] disabled:bg-[#1B2A30]"
                    >
                      {loading ? "Loading..." : "Continue to Next Turn"}
                    </button>
                  )}
                  {currentPlayer?.isBot && botThinking && (
                    <p className="text-[#305853]">
                      Bot will continue automatically...
                    </p>
                  )}
                </div>
              )}

              {!isMyTurn && gameState.phase !== "waiting-continue" && (
                <div className="text-center bg-[#1B2A30]/60 p-6 rounded-lg backdrop-blur">
                  <p className="text-white">
                    Waiting for {currentPlayer?.name}'s turn...
                  </p>
                  {currentPlayer?.isBot && botThinking && (
                    <p className="text-[#B06821] mt-2">🤖 Bot is thinking...</p>
                  )}
                </div>
              )}
            </>
          )}

          {me && !me.isAlive && (
            <div className="text-center bg-[#511B18]/60 p-6 rounded-lg backdrop-blur">
              <p className="text-red-400 text-xl font-bold">
                You've been eliminated! Watch the others continue...
              </p>
            </div>
          )}

          {message && (
            <div className="text-center text-white bg-[#305853] p-4 rounded">
              {message}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
