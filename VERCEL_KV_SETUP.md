# Vercel KV Setup Instructions

Your game now uses Vercel KV (Redis) for persistent storage, which is required for serverless deployments.

## Setup Steps

1. **Go to your Vercel project dashboard**

   - Navigate to https://vercel.com/dashboard

2. **Add Vercel KV Storage**

   - Go to your project
   - Click on the "Storage" tab
   - Click "Create Database"
   - Select "KV" (Redis-compatible key-value store)
   - Choose a name (e.g., "fatebound-kv")
   - Select a region close to your users
   - Click "Create"

3. **Connect to your project**

   - After creating the KV database, Vercel will show you connection details
   - Click "Connect Project" and select your fatebound project
   - Vercel will automatically add the required environment variables:
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
     - `KV_REST_API_READ_ONLY_TOKEN`

4. **Redeploy your application**
   - Push your latest changes to git
   - Vercel will automatically redeploy with the new KV storage

## Local Development

For local development, you can either:

**Option 1: Use Vercel KV locally (recommended)**

- Run `vercel env pull .env.local` to download your environment variables
- This will include your KV credentials

**Option 2: Use a local Redis instance**

- Install Redis locally
- Update the KV connection in your `.env.local` file

## What Changed

- The game now stores all data in Vercel KV instead of file-based storage
- All API routes have been updated to use async/await with KV
- Games expire after 24 hours (configurable in `gameStore.ts`)

## Testing

After setup, test by:

1. Creating a new game
2. Joining the game from a different browser/incognito window
3. Both should see the same game state

## Troubleshooting

If you get errors:

- Check that KV environment variables are set in Vercel dashboard
- Redeploy after adding storage
- Check Vercel function logs for detailed error messages
