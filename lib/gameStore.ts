import { MongoClient, Db, Collection } from "mongodb";
import { LeaderboardEntry, PuzzleDifficulty } from "@/types/game";

// In-memory fallback for local development without MongoDB
const localGames = new Map<string, any>();
const localLeaderboard: LeaderboardEntry[] = [];

let client: MongoClient | null = null;
let db: Db | null = null;
let gamesCollection: Collection | null = null;
let leaderboardCollection: Collection | null = null;

// Initialize MongoDB connection
async function getMongoClient() {
  if (!process.env.MONGODB_URI) {
    return null;
  }

  if (client && db) {
    return { client, db, gamesCollection, leaderboardCollection };
  }

  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db("fatebound");
    gamesCollection = db.collection("games");
    leaderboardCollection = db.collection("leaderboard");

    // Create index on gameId for faster lookups
    await gamesCollection.createIndex({ gameId: 1 }, { unique: true });

    // Create indexes for leaderboard
    await leaderboardCollection.createIndex(
      { difficulty: 1, score: -1, date: -1 },
      { name: "difficulty_score_date" }
    );

  
    return { client, db, gamesCollection, leaderboardCollection };
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    return null;
  }
}

// Check if MongoDB is configured
const isMongoConfigured = () => {
  return !!process.env.MONGODB_URI;
};

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
    if (isMongoConfigured()) {
      const mongo = await getMongoClient();
      if (mongo?.gamesCollection) {
        const doc = await mongo.gamesCollection.findOne({ gameId });
        const game = doc ? deserializeFromStorage(doc.gameState) : null;
        return game;
      }
    }

    // Fallback to in-memory storage
    const game = localGames.get(gameId);
    return game;
  } catch (error) {
    console.error(`Error fetching game ${gameId}:`, error);
    // Fallback to local storage on error
    return localGames.get(gameId) || null;
  }
}

export async function setGame(gameId: string, gameState: any) {
  try {
    if (isMongoConfigured()) {
      const mongo = await getMongoClient();
      if (mongo?.gamesCollection) {
        const serialized = serializeForStorage(gameState);
        await mongo.gamesCollection.updateOne(
          { gameId },
          {
            $set: {
              gameId,
              gameState: serialized,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
        return;
      }
    }

    // Fallback to in-memory storage
    localGames.set(gameId, gameState);
  } catch (error) {
    console.error(`Error saving game ${gameId}:`, error);
    // Fallback to local storage on error
    localGames.set(gameId, gameState);
  }
}

export async function deleteGame(gameId: string) {
  try {
    if (isMongoConfigured()) {
      const mongo = await getMongoClient();
      if (mongo?.gamesCollection) {
        await mongo.gamesCollection.deleteOne({ gameId });
        return;
      }
    }

    // Fallback to in-memory storage
    localGames.delete(gameId);
  } catch (error) {
    console.error(`Error deleting game ${gameId}:`, error);
    localGames.delete(gameId);
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

// Leaderboard functions
export async function saveLeaderboardEntry(entry: LeaderboardEntry) {
  try {
    if (isMongoConfigured()) {
      const mongo = await getMongoClient();
      if (mongo?.leaderboardCollection) {
        await mongo.leaderboardCollection.insertOne({
          ...entry,
          createdAt: new Date(),
        });
        return;
      }
    }

    // Fallback to in-memory storage
    localLeaderboard.push(entry);
    // Keep only top 100 entries in memory to prevent memory bloat
    localLeaderboard.sort((a, b) => b.score - a.score);
    if (localLeaderboard.length > 100) {
      localLeaderboard.length = 100;
    }
  } catch (error) {
    console.error("Error saving leaderboard entry:", error);
    // Fallback to local storage on error
    localLeaderboard.push(entry);
  }
}

export async function getLeaderboard(
  difficulty?: PuzzleDifficulty,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  try {
    if (isMongoConfigured()) {
      const mongo = await getMongoClient();
      if (mongo?.leaderboardCollection) {
        const query = difficulty ? { difficulty } : {};
        const entries = await mongo.leaderboardCollection
          .find(query)
          .sort({ score: -1, date: 1 })
          .limit(limit)
          .toArray();

        return entries.map((entry) => ({
          playerName: entry.playerName,
          score: entry.score,
          difficulty: entry.difficulty,
          date: entry.date,
          gameId: entry.gameId,
        }));
      }
    }

    // Fallback to in-memory storage
    let filtered = difficulty
      ? localLeaderboard.filter((e) => e.difficulty === difficulty)
      : [...localLeaderboard];

    filtered.sort((a, b) => b.score - a.score || a.date - b.date);
    return filtered.slice(0, limit);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    // Fallback to local storage on error
    let filtered = difficulty
      ? localLeaderboard.filter((e) => e.difficulty === difficulty)
      : [...localLeaderboard];

    filtered.sort((a, b) => b.score - a.score || a.date - b.date);
    return filtered.slice(0, limit);
  }
}
