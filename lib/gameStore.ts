import { kv } from "@vercel/kv";

// Helper to serialize game state for storage
function serializeForStorage(gameState: any) {
  return {
    ...gameState,
    puzzle: {
      ...gameState.puzzle,
      revealedLetters: Array.from(gameState.puzzle.revealedLetters || []),
    },
  };
}

// Helper to deserialize game state from storage
function deserializeFromStorage(gameState: any) {
  if (!gameState) return null;
  return {
    ...gameState,
    puzzle: {
      ...gameState.puzzle,
      revealedLetters: new Set(gameState.puzzle.revealedLetters || []),
    },
  };
}

export async function getGame(gameId: string) {
  try {
    console.log(`🔍 Fetching game ${gameId} from KV...`);
    const gameState = await kv.get(`game:${gameId}`);
    const game = deserializeFromStorage(gameState);
    console.log(
      `Getting game ${gameId}:`,
      game ? "found" : "not found"
    );
    return game;
  } catch (error) {
    console.error(`Error fetching game ${gameId}:`, error);
    return null;
  }
}

export async function setGame(gameId: string, gameState: any) {
  try {
    console.log(`💾 Saving game ${gameId} to KV...`);
    const serialized = serializeForStorage(gameState);
    await kv.set(`game:${gameId}`, serialized, { ex: 86400 }); // Expire after 24 hours
    console.log(`✅ Game ${gameId} saved successfully`);
  } catch (error) {
    console.error(`Error saving game ${gameId}:`, error);
    throw error;
  }
}

export async function deleteGame(gameId: string) {
  try {
    await kv.del(`game:${gameId}`);
    console.log(`🗑️ Game ${gameId} deleted`);
  } catch (error) {
    console.error(`Error deleting game ${gameId}:`, error);
  }
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
