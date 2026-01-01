"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Player, GamePhase, PuzzleDifficulty } from "@/types/game";

type GameState = {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  puzzle: {
    phrase: string;
    category: string;
    revealedLetters: string[];
    difficulty: PuzzleDifficulty;
  };
  /** All letters guessed so far (correct and incorrect) */
  selectedLetters: string[];
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
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [leaderboardDifficulty, setLeaderboardDifficulty] = useState<
    PuzzleDifficulty | "all"
  >("all");
  const [puzzleDifficulty, setPuzzleDifficulty] =
    useState<PuzzleDifficulty>("medium");
  const botActionInProgress = useRef(false);
  const leaderboardSubmitted = useRef(false);

  // Sync gameId from gameState if needed
  useEffect(() => {
    if (gameState?.id && !gameId) {
      setGameId(gameState.id);
    }
  }, [gameState, gameId]);

  // Submit to leaderboard when game ends
  useEffect(() => {
    if (
      gameState?.phase === "game-over" &&
      gameState.winner &&
      !leaderboardSubmitted.current
    ) {
      leaderboardSubmitted.current = true;
      const winner = gameState.players.find((p) => p.id === gameState.winner);

      if (winner && winner.score > 0) {
        fetch("/api/leaderboard/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerName: winner.name,
            score: winner.score,
            difficulty: gameState.puzzle.difficulty,
            gameId: gameState.id,
          }),
        })
          .then((res) => res.json())
          .then((data) => {})
          .catch((error) => {
            console.error("Failed to submit leaderboard entry:", error);
          });
      }
    }
  }, [gameState?.phase, gameState?.winner, gameState]);

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
    if (!gameState || botThinking || loading || botActionInProgress.current)
      return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    // Bot takes action during playing phase
    if (currentPlayer?.isBot && gameState.phase === "playing") {
      botActionInProgress.current = true;
      setBotThinking(true);

      setTimeout(async () => {
        try {
          const response = await fetch("/api/game/bot-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameId }),
          });

          const data = await response.json();

          if (data.error) {
            console.error("Bot action error:", data.error);
            setBotThinking(false);
            botActionInProgress.current = false;
            return;
          }

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
          botActionInProgress.current = false;
        }
      }, 1500 + Math.random() * 1000);

      return;
    }

    // Bot selects letter during letter-selection phase
    if (currentPlayer?.isBot && gameState.phase === "letter-selection") {
      botActionInProgress.current = true;
      setBotThinking(true);

      setTimeout(async () => {
        try {
          // Pick a random letter that hasn't been revealed yet
          const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          const availableLetters = alphabet
            .split("")
            .filter((l) => !gameState.puzzle.revealedLetters.includes(l));

          if (availableLetters.length > 0) {
            const randomLetter =
              availableLetters[
                Math.floor(Math.random() * availableLetters.length)
              ];

            const response = await fetch("/api/game/letter", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                gameId,
                playerId: currentPlayer.id,
                letter: randomLetter,
              }),
            });

            const data = await response.json();

            if (data.error) {
              console.error("Bot letter error:", data.error);
            } else {
              setGameState(data.gameState);
              if (data.message) {
                setMessage(
                  `${currentPlayer.name} guesses ${randomLetter}: ${data.message}`
                );
              }
            }
          }
        } catch (error) {
          console.error("Error processing bot letter:", error);
        } finally {
          setBotThinking(false);
          botActionInProgress.current = false;
        }
      }, 1500 + Math.random() * 1000);

      return;
    }

    // Auto-continue for bots after failure
    if (
      gameState.phase === "waiting-continue" &&
      currentPlayer?.isBot &&
      !botActionInProgress.current
    ) {
      botActionInProgress.current = true;
      setBotThinking(true);
      setTimeout(async () => {
        try {
          await continueGame();
        } finally {
          setBotThinking(false);
          botActionInProgress.current = false;
        }
      }, 2000);
    }
  }, [
    gameState?.phase,
    gameState?.currentPlayerIndex,
    botThinking,
    loading,
    gameId,
  ]);

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
        body: JSON.stringify({ playerName, difficulty: puzzleDifficulty }),
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

  const fetchLeaderboard = async (difficulty?: PuzzleDifficulty | "all") => {
    try {
      const url =
        difficulty && difficulty !== "all"
          ? `/api/leaderboard?difficulty=${difficulty}&limit=10`
          : `/api/leaderboard?limit=10`;

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setLeaderboardData(data.leaderboard);
      } else {
        console.error(
          "❌ Leaderboard fetch failed:",
          response.status,
          await response.text()
        );
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
  };

  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    await fetchLeaderboard(leaderboardDifficulty);
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

    setLoading(true);
    try {
      const response = await fetch("/api/game/add-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });

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

    try {
      const response = await fetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, playerId, action }),
      });

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

    setLoading(true);
    try {
      const response = await fetch("/api/game/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, playerId, letter: selectedLetter }),
      });

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

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors (like punctuation) without clearing the guess
        if (data.error === "No punctuation allowed") {
          setMessage(
            data.message || "Please remove punctuation from your guess"
          );
          // Update game state if provided but don't clear the guess
          if (data.gameState) {
            setGameState(data.gameState);
          }
          return;
        }

        console.error("Guess submission error:", data);
        setMessage(data.error || "Failed to submit guess");
        return;
      }

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
      <div className="mb-4 sm:mb-6 rounded-lg bg-[#1B2A30] p-3 sm:p-6 border-2 border-[#B06821]">
        <div className="text-center mb-3 sm:mb-4">
          <p className="text-[#B06821] font-bold text-base sm:text-lg">
            {gameState.puzzle.category}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
          {words.map((word, wordIdx) => (
            <div key={wordIdx} className="flex gap-1">
              {word.split("").map((letter, letterIdx) => {
                const isRevealed = gameState.puzzle.revealedLetters.includes(
                  letter.toUpperCase()
                );
                return (
                  <div
                    key={letterIdx}
                    className="w-8 h-12 sm:w-10 sm:h-14 md:w-12 md:h-16 border-2 border-white bg-white/10 flex items-center justify-center text-lg sm:text-2xl font-bold text-white"
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
      <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#511B18] via-[#1B2A30] to-[#511B18] font-sans pt-4 sm:pt-12 px-4">
        <main className="w-full max-w-2xl p-4 sm:p-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/Fatebound.png"
              alt="Fatebound - Where Words Decide"
              width={600}
              height={400}
              priority
              className="max-w-full h-auto w-full sm:w-auto"
            />
          </div>

          <div className="flex justify-center mb-6">
            <button
              onClick={() => setShowHowToPlay(true)}
              className="text-[#B06821] hover:text-white transition-colors underline text-sm sm:text-base mr-4"
            >
              📖 How to Play
            </button>
            <button
              onClick={openLeaderboard}
              className="text-[#B06821] hover:text-white transition-colors underline text-sm sm:text-base"
            >
              🏆 Leaderboard
            </button>
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

              <div>
                <label className="block text-white mb-2">
                  Puzzle Difficulty:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {["easy", "medium", "hard", "very-hard"].map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() =>
                        setPuzzleDifficulty(diff as PuzzleDifficulty)
                      }
                      className={`rounded-lg px-4 py-3 font-semibold text-white transition-colors ${
                        puzzleDifficulty === diff
                          ? "bg-[#B06821] ring-2 ring-[#B06821]"
                          : "bg-[#305853] hover:bg-[#B06821]/50"
                      }`}
                    >
                      {diff === "very-hard"
                        ? "Very Hard"
                        : diff.charAt(0).toUpperCase() + diff.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#305853] mt-2">
                  {puzzleDifficulty === "easy" && "2-3 words • Simple phrases"}
                  {puzzleDifficulty === "medium" &&
                    "3-4 words • Moderate challenge"}
                  {puzzleDifficulty === "hard" &&
                    "4-5 words • Challenging phrases"}
                  {puzzleDifficulty === "very-hard" &&
                    "5-6 words • Very challenging"}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={createGame}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-[#9E2C21] px-6 py-4 font-semibold text-white transition-colors hover:bg-[#511B18] disabled:bg-[#1B2A30] text-base sm:text-lg"
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
                className="w-full rounded-lg bg-[#B06821] px-6 py-4 font-semibold text-white transition-colors hover:bg-[#9E2C21] disabled:bg-[#1B2A30] text-base sm:text-lg"
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

              <div className="bg-[#305853]/40 p-4 rounded border border-[#305853]">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">
                    Puzzle Difficulty:
                  </span>
                  <span className="text-[#B06821] font-bold capitalize">
                    {gameState.puzzle?.difficulty
                      ? gameState.puzzle.difficulty === "very-hard"
                        ? "Very Hard"
                        : gameState.puzzle.difficulty
                      : "Medium"}
                  </span>
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

        {/* How to Play Modal */}
        {showHowToPlay && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowHowToPlay(false)}
          >
            <div
              className="bg-[#1B2A30] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#B06821]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#B06821]">
                    📖 How to Play
                  </h2>
                  <button
                    onClick={() => setShowHowToPlay(false)}
                    className="text-white hover:text-[#B06821] text-2xl transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-6 text-white">
                  <section>
                    <h3 className="text-xl font-bold text-[#B06821] mb-2">
                      🎯 Objective
                    </h3>
                    <p className="text-sm sm:text-base leading-relaxed">
                      Be the last player standing by solving the word puzzle!
                      Navigate dangerous scenarios, reveal letters, and outsmart
                      your opponents to win.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-[#B06821] mb-2">
                      🎮 Game Setup
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-sm sm:text-base">
                      <li>Create a new game or join with a game code</li>
                      <li>
                        Add computer players (bots) or wait for friends to join
                      </li>
                      <li>
                        Each player starts with <strong>3 lives ❤️</strong>
                      </li>
                      <li>
                        The host starts the game when ready (minimum 2 players)
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-[#B06821] mb-2">
                      ⚔️ Your Turn - Action Phase
                    </h3>
                    <p className="text-sm sm:text-base leading-relaxed mb-2">
                      Each round, you'll face a dangerous scenario. Describe
                      what your character does:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm sm:text-base">
                      <li>
                        <strong>Smart, cautious actions</strong> = More likely
                        to succeed
                      </li>
                      <li>
                        <strong>Creative solutions</strong> = Rewarded
                      </li>
                      <li>
                        <strong>Reckless actions</strong> = Higher risk of
                        failure
                      </li>
                      <li>
                        <strong>Success:</strong> Move to letter selection (+10
                        points)
                      </li>
                      <li>
                        <strong>Failure:</strong> Lose 1 life ❤️
                      </li>
                      <li>
                        <strong>0 lives:</strong> You're eliminated! 💀
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-[#B06821] mb-2">
                      🔤 Letter Selection Phase
                    </h3>
                    <p className="text-sm sm:text-base leading-relaxed mb-2">
                      After surviving a challenge, choose one of these options:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm sm:text-base">
                      <li>
                        <strong>Pick a Letter:</strong> Earn points if it's in
                        the puzzle (+5 per letter)
                      </li>
                      <li>
                        <strong>Solve the Puzzle:</strong> Win the game
                        instantly! (+100 points)
                      </li>
                      <li>
                        <strong>Wrong puzzle guess:</strong> You're eliminated
                        immediately! ☠️
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-[#B06821] mb-2">
                      🏆 Winning the Game
                    </h3>
                    <p className="text-sm sm:text-base leading-relaxed">
                      There are three ways to win:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm sm:text-base mt-2">
                      <li>
                        <strong>Solve the puzzle correctly</strong> - Instant
                        win!
                      </li>
                      <li>
                        <strong>Reveal all letters</strong> - Automatic win!
                      </li>
                      <li>
                        <strong>Be the last player alive</strong> - Everyone
                        else eliminated
                      </li>
                    </ul>
                    <p className="text-sm sm:text-base leading-relaxed mt-2">
                      If all players are eliminated, the highest score wins!
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-[#B06821] mb-2">
                      💡 Pro Tips
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-sm sm:text-base">
                      <li>Start with common letters: E, T, A, O, I, N</li>
                      <li>Balance risk vs. reward in challenges</li>
                      <li>
                        Don't guess the puzzle too early - wrong guesses
                        eliminate you!
                      </li>
                      <li>Pay attention to the puzzle category for clues</li>
                      <li>
                        Every correct letter guess gets you closer to solving
                      </li>
                    </ul>
                  </section>

                  <div className="pt-4 border-t border-[#305853]">
                    <p className="text-center text-[#305853] text-sm">
                      May fate be on your side! ⚔️✨
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setShowHowToPlay(false)}
                    className="rounded-lg bg-[#9E2C21] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#511B18]"
                  >
                    Got It!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowLeaderboard(false)}
          >
            <div
              className="bg-[#1B2A30] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#B06821]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#B06821]">
                    🏆 Leaderboard
                  </h2>
                  <button
                    onClick={() => setShowLeaderboard(false)}
                    className="text-white hover:text-[#B06821] text-2xl transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-6">
                  <label className="block text-white mb-2 text-sm">
                    Filter by Difficulty:
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {["all", "easy", "medium", "hard", "very-hard"].map(
                      (diff) => (
                        <button
                          key={diff}
                          onClick={async () => {
                            const newDiff = diff as PuzzleDifficulty | "all";
                            setLeaderboardDifficulty(newDiff);
                            await fetchLeaderboard(newDiff);
                          }}
                          className={`rounded px-3 py-2 text-xs font-semibold transition-colors ${
                            leaderboardDifficulty === diff
                              ? "bg-[#B06821] text-white"
                              : "bg-[#305853] text-white hover:bg-[#B06821]/50"
                          }`}
                        >
                          {diff === "very-hard"
                            ? "V.Hard"
                            : diff.charAt(0).toUpperCase() + diff.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {leaderboardData.length === 0 ? (
                    <div className="text-center text-[#305853] py-8">
                      No entries yet. Be the first to make it to the
                      leaderboard!
                    </div>
                  ) : (
                    leaderboardData.map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-[#305853]/40 p-4 rounded border border-[#305853]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-[#B06821] w-8">
                            {index === 0
                              ? "🥇"
                              : index === 1
                              ? "🥈"
                              : index === 2
                              ? "🥉"
                              : `${index + 1}.`}
                          </span>
                          <div>
                            <div className="text-white font-semibold">
                              {entry.playerName}
                            </div>
                            <div className="text-xs text-[#305853] capitalize">
                              {entry.difficulty === "very-hard"
                                ? "Very Hard"
                                : entry.difficulty}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[#B06821] font-bold text-lg">
                            {entry.score}
                          </div>
                          <div className="text-xs text-[#305853]">
                            {new Date(entry.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setShowLeaderboard(false)}
                    className="rounded-lg bg-[#9E2C21] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#511B18]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Game Over Screen
  if (gameState.phase === "game-over") {
    const winner = gameState.players.find((p) => p.id === gameState.winner);
    return (
      <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#511B18] via-[#1B2A30] to-[#511B18] font-sans pt-4 sm:pt-12 px-4">
        <main className="w-full max-w-4xl p-4 sm:p-8">
          <div className="text-center space-y-4 sm:space-y-6 bg-[#1B2A30]/60 p-6 sm:p-12 rounded-lg backdrop-blur">
            <div className="flex justify-center mb-2">
              <Image
                src="/Fatebound.png"
                alt="Fatebound - Where Words Decide"
                width={500}
                height={333}
                className="max-w-full h-auto w-full sm:w-auto"
              />
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
              Game Over!
            </h1>
            <div className="text-3xl sm:text-3xl md:text-3xl text-[#B06821] font-bold">
              🏆 {winner?.name} wins! 🏆
            </div>
            <div className="text-lg sm:text-xl text-white">
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

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  openLeaderboard();
                }}
                className="mt-8 rounded-lg bg-[#B06821] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#9E2C21]"
              >
                🏆 View Leaderboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="mt-8 rounded-lg bg-[#9E2C21] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#511B18]"
              >
                Play Again
              </button>
            </div>
          </div>
        </main>

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowLeaderboard(false)}
          >
            <div
              className="bg-[#1B2A30] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#B06821]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#B06821]">
                    🏆 Leaderboard
                  </h2>
                  <button
                    onClick={() => setShowLeaderboard(false)}
                    className="text-white hover:text-[#B06821] text-2xl transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-6">
                  <label className="block text-white mb-2 text-sm">
                    Filter by Difficulty:
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {["all", "easy", "medium", "hard", "very-hard"].map(
                      (diff) => (
                        <button
                          key={diff}
                          onClick={async () => {
                            const newDiff = diff as PuzzleDifficulty | "all";
                            setLeaderboardDifficulty(newDiff);
                            await fetchLeaderboard(newDiff);
                          }}
                          className={`rounded px-3 py-2 text-xs font-semibold transition-colors ${
                            leaderboardDifficulty === diff
                              ? "bg-[#B06821] text-white"
                              : "bg-[#305853] text-white hover:bg-[#B06821]/50"
                          }`}
                        >
                          {diff === "very-hard"
                            ? "V.Hard"
                            : diff.charAt(0).toUpperCase() + diff.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {leaderboardData.length === 0 ? (
                    <div className="text-center text-[#305853] py-8">
                      No entries yet. Be the first to make it to the
                      leaderboard!
                    </div>
                  ) : (
                    leaderboardData.map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-[#305853]/40 p-4 rounded border border-[#305853]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-[#B06821] w-8">
                            {index === 0
                              ? "🥇"
                              : index === 1
                              ? "🥈"
                              : index === 2
                              ? "🥉"
                              : `${index + 1}.`}
                          </span>
                          <div>
                            <div className="text-white font-semibold">
                              {entry.playerName}
                            </div>
                            <div className="text-xs text-[#305853] capitalize">
                              {entry.difficulty === "very-hard"
                                ? "Very Hard"
                                : entry.difficulty}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[#B06821] font-bold text-lg">
                            {entry.score}
                          </div>
                          <div className="text-xs text-[#305853]">
                            {new Date(entry.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setShowLeaderboard(false)}
                    className="rounded-lg bg-[#9E2C21] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#511B18]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Game Screen
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#511B18] via-[#1B2A30] to-[#511B18] font-sans p-2 sm:p-4">
      <main className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-4">
        {/* Left sidebar - Players */}
        <div className="w-full lg:w-64 space-y-4 lg:order-first order-last">
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

          {/* Selected Letters Section */}
          {gameState.selectedLetters &&
            gameState.selectedLetters.length > 0 && (
              <div className="bg-[#1B2A30]/60 p-4 rounded-lg backdrop-blur border border-[#305853]/40 mb-2">
                <h3 className="text-[#B06821] font-bold mb-2 text-lg">
                  Selected Letters
                </h3>
                <div className="flex flex-wrap gap-2">
                  {gameState.selectedLetters.map((letter, idx) => (
                    <span
                      key={letter + idx}
                      className="inline-block px-3 py-2 rounded bg-[#305853] text-white text-xl font-mono border border-[#B06821]/40 shadow-sm"
                    >
                      {letter}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
                <div className="space-y-3 sm:space-y-4 bg-[#1B2A30]/60 p-4 sm:p-6 rounded-lg backdrop-blur">
                  <p className="text-white font-bold text-base sm:text-lg">
                    Your turn! What do you do?
                  </p>
                  <textarea
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="Describe your action..."
                    className="w-full rounded-lg bg-[#305853] p-4 text-white text-base placeholder-[#305853]/60 focus:outline-none focus:ring-2 focus:ring-[#B06821] min-h-[100px] resize-none border border-[#B06821]/30"
                    disabled={loading}
                  />
                  <button
                    onClick={submitAction}
                    disabled={loading || !action.trim()}
                    className="w-full rounded-lg bg-[#9E2C21] px-6 py-4 text-base sm:text-lg font-semibold text-white transition-colors hover:bg-[#511B18] disabled:bg-[#1B2A30] disabled:cursor-not-allowed"
                  >
                    {loading ? "Processing..." : "Take Action"}
                  </button>
                </div>
              )}

              {gameState.phase === "letter-selection" && isMyTurn && (
                <div className="space-y-3 sm:space-y-4 bg-[#1B2A30]/60 p-4 sm:p-6 rounded-lg backdrop-blur">
                  <p className="text-white font-bold text-base sm:text-lg">
                    You survived! Choose a letter or solve the puzzle:
                  </p>

                  <div>
                    <label className="block text-white mb-2 text-sm sm:text-base">
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
                        className="w-16 sm:w-20 rounded-lg bg-[#305853] p-3 sm:p-4 text-white text-center text-2xl sm:text-3xl border border-[#B06821] focus:outline-none focus:ring-2 focus:ring-[#B06821]"
                        placeholder="?"
                      />
                      <button
                        onClick={submitLetter}
                        disabled={loading || !selectedLetter}
                        className="flex-1 rounded-lg bg-[#B06821] px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white transition-colors hover:bg-[#9E2C21] disabled:bg-[#1B2A30]"
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
                    <label className="block text-white mb-2 text-sm sm:text-base">
                      Solve the Puzzle:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={puzzleGuess}
                        onChange={(e) =>
                          setPuzzleGuess(e.target.value.toUpperCase())
                        }
                        className="flex-1 rounded-lg bg-[#305853] p-3 sm:p-4 text-base text-white border border-[#B06821] focus:outline-none focus:ring-2 focus:ring-[#B06821]"
                        placeholder="Enter full phrase"
                      />
                      <button
                        onClick={guessPuzzle}
                        disabled={loading || !puzzleGuess.trim()}
                        className="rounded-lg bg-[#9E2C21] px-6 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white transition-colors hover:bg-[#511B18] disabled:bg-[#1B2A30] whitespace-nowrap"
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

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHowToPlay(false)}
        >
          <div
            className="bg-[#1B2A30] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#B06821]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#B06821]">
                  📖 How to Play
                </h2>
                <button
                  onClick={() => setShowHowToPlay(false)}
                  className="text-white hover:text-[#B06821] text-2xl transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6 text-white">
                <section>
                  <h3 className="text-xl font-bold text-[#B06821] mb-2">
                    🎯 Objective
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed">
                    Be the last player standing by solving the word puzzle!
                    Navigate dangerous scenarios, reveal letters, and outsmart
                    your opponents to win.
                  </p>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-[#B06821] mb-2">
                    🎮 Game Setup
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-sm sm:text-base">
                    <li>Create a new game or join with a game code</li>
                    <li>
                      Add computer players (bots) or wait for friends to join
                    </li>
                    <li>
                      Each player starts with <strong>3 lives ❤️</strong>
                    </li>
                    <li>
                      The host starts the game when ready (minimum 2 players)
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-[#B06821] mb-2">
                    ⚔️ Your Turn - Action Phase
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed mb-2">
                    Each round, you'll face a dangerous scenario. Describe what
                    your character does:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm sm:text-base">
                    <li>
                      <strong>Smart, cautious actions</strong> = More likely to
                      succeed
                    </li>
                    <li>
                      <strong>Creative solutions</strong> = Rewarded
                    </li>
                    <li>
                      <strong>Reckless actions</strong> = Higher risk of failure
                    </li>
                    <li>
                      <strong>Success:</strong> Move to letter selection (+10
                      points)
                    </li>
                    <li>
                      <strong>Failure:</strong> Lose 1 life ❤️
                    </li>
                    <li>
                      <strong>0 lives:</strong> You're eliminated! 💀
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-[#B06821] mb-2">
                    🔤 Letter Selection Phase
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed mb-2">
                    After surviving a challenge, choose one of these options:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm sm:text-base">
                    <li>
                      <strong>Pick a Letter:</strong> Earn points if it's in the
                      puzzle (+5 per letter)
                    </li>
                    <li>
                      <strong>Solve the Puzzle:</strong> Win the game instantly!
                      (+100 points)
                    </li>
                    <li>
                      <strong>Wrong guess:</strong> You're eliminated
                      immediately! ☠️
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-[#B06821] mb-2">
                    🏆 Winning the Game
                  </h3>
                  <p className="text-sm sm:text-base leading-relaxed">
                    There are three ways to win:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm sm:text-base mt-2">
                    <li>
                      <strong>Solve the puzzle correctly</strong> - Instant win!
                    </li>
                    <li>
                      <strong>Reveal all letters</strong> - Automatic win!
                    </li>
                    <li>
                      <strong>Be the last player alive</strong> - Everyone else
                      eliminated
                    </li>
                  </ul>
                  <p className="text-sm sm:text-base leading-relaxed mt-2">
                    If all players are eliminated, the highest score wins!
                  </p>
                </section>

                <section>
                  <h3 className="text-xl font-bold text-[#B06821] mb-2">
                    💡 Pro Tips
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-sm sm:text-base">
                    <li>Start with common letters: E, T, A, O, I, N</li>
                    <li>Balance risk vs. reward in challenges</li>
                    <li>
                      Don't guess the puzzle too early - wrong guesses eliminate
                      you!
                    </li>
                    <li>Pay attention to the puzzle category for clues</li>
                    <li>
                      Every correct letter guess gets you closer to solving
                    </li>
                  </ul>
                </section>

                <div className="pt-4 border-t border-[#305853]">
                  <p className="text-center text-[#305853] text-sm">
                    May fate be on your side! ⚔️✨
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowHowToPlay(false)}
                  className="rounded-lg bg-[#9E2C21] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#511B18]"
                >
                  Got It!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
