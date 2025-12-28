import fs from "fs";
import path from "path";

// File-based storage to survive HMR restarts in development
const STORAGE_FILE = path.join(process.cwd(), ".tmp-game-storage.json");

// In-memory game storage (in production, use a database)
const games = new Map<string, any>();
let gamesLoaded = false;

// Load games from file on startup
function loadGamesFromFile() {
  if (gamesLoaded) return; // Only load once

  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      Object.entries(parsed).forEach(([id, state]: [string, any]) => {
        // Convert revealedLetters array back to Set
        if (state.puzzle && Array.isArray(state.puzzle.revealedLetters)) {
          state.puzzle.revealedLetters = new Set(state.puzzle.revealedLetters);
        }
        games.set(id, state);
      });
      gamesLoaded = true;
      console.log(`📂 Loaded ${games.size} games from persistent storage`);
    }
  } catch (error) {
    console.error("Error loading games from file:", error);
  }
}

// Save games to file
function saveGamesToFile() {
  try {
    const gamesObj: Record<string, any> = {};
    games.forEach((state, id) => {
      gamesObj[id] = state;
    });
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(gamesObj, null, 2));
  } catch (error) {
    console.error("Error saving games to file:", error);
  }
}

// Load on initialization
loadGamesFromFile();

export function getGame(gameId: string) {
  const game = games.get(gameId);
  if (!game && games.size === 0) {
    console.warn(
      "⚠️ Games map is empty - attempting to reload from storage..."
    );
    loadGamesFromFile();
    return games.get(gameId);
  }

  // Convert revealedLetters array back to Set if needed (from JSON deserialization)
  if (game && game.puzzle && Array.isArray(game.puzzle.revealedLetters)) {
    game.puzzle.revealedLetters = new Set(game.puzzle.revealedLetters);
  }

  console.log(
    `Getting game ${gameId}:`,
    game ? "found" : "not found",
    `(total games: ${games.size})`
  );
  return game;
}

export function setGame(gameId: string, gameState: any) {
  console.log(`Setting game ${gameId} (total games before: ${games.size})`);
  games.set(gameId, gameState);
  saveGamesToFile();
  console.log(`✅ Game saved (total games: ${games.size})`);
}

export function deleteGame(gameId: string) {
  games.delete(gameId);
  saveGamesToFile();
}

// List of puzzles for the game
export const PUZZLES = [
  { phrase: "THE TREASURE IS CURSED", category: "Adventure Warning" },
  { phrase: "ESCAPE FROM THE DUNGEON", category: "Classic Quest" },
  { phrase: "BEWARE OF THE DRAGON", category: "Monster Alert" },
  { phrase: "FINDING THE MAGIC SWORD", category: "Epic Quest" },
  { phrase: "LOST IN THE HAUNTED FOREST", category: "Spooky Adventure" },
  { phrase: "DEFEAT THE EVIL WIZARD", category: "Hero's Journey" },
  { phrase: "CLIMBING THE MOUNTAIN PEAK", category: "Dangerous Expedition" },
  { phrase: "SWIMMING ACROSS THE RIVER", category: "Survival Challenge" },
];

export function getRandomPuzzle() {
  return PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
}

// Generate starting scenarios
export function generateScenario(roundNumber: number): string {
  const scenarios = [
    "You approach a rickety rope bridge suspended over a bottomless chasm. The wooden planks creak ominously beneath your feet. What do you do?",
    "A treasure chest sits in the center of the room, but the floor around it is covered with suspicious-looking tiles. What do you do?",
    "You encounter a sleeping dragon blocking the only path forward. Its treasure hoard glitters behind it. What do you do?",
    "A mysterious potion sits on a pedestal. It could grant you power... or poison you. What do you do?",
    "The path splits three ways: one leads up, one down, and one straight ahead into darkness. What do you do?",
    "A riddle is carved into a stone door: 'What walks on four legs in morning, two at noon, three at night?' What do you do?",
    "You find a sword stuck in a stone with ancient runes glowing around it. What do you do?",
    "A group of goblins blocks your path, but they seem distracted by their card game. What do you do?",
  ];

  return scenarios[roundNumber % scenarios.length];
}
