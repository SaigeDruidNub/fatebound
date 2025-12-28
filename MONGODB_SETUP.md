# MongoDB Setup Instructions

Your game now uses MongoDB for persistent storage, which is required for serverless deployments.

## Setup Steps

### Option 1: MongoDB Atlas (Recommended for Production)

1. **Create a MongoDB Atlas account**

   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for a free account

2. **Create a new cluster**

   - Click "Build a Database"
   - Choose the FREE tier (M0)
   - Select a region close to your users
   - Click "Create Cluster"

3. **Set up database access**

   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a username and strong password (save these!)
   - Set user privileges to "Read and write to any database"
   - Click "Add User"

4. **Configure network access**

   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"

5. **Get your connection string**

   - Go back to "Database" in the left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - It will look like: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

6. **Add to Vercel**

   - Go to your Vercel project dashboard
   - Go to Settings → Environment Variables
   - Add a new variable:
     - Name: `MONGODB_URI`
     - Value: Your connection string (replace `<username>` and `<password>` with your actual credentials)
   - Click "Save"

7. **Redeploy**
   - Push your latest changes to git
   - Vercel will automatically redeploy with MongoDB

### Option 2: Local MongoDB (For Development)

1. **Install MongoDB locally**

   - Download from https://www.mongodb.com/try/download/community
   - Or use Docker: `docker run -d -p 27017:27017 --name mongodb mongo`

2. **Set environment variable**
   - Create or update `.env.local`:
     ```
     MONGODB_URI=mongodb://localhost:27017
     ```

## What Changed

- The game now stores all data in MongoDB instead of file-based storage
- All API routes use async/await with MongoDB
- Automatic fallback to in-memory storage if MongoDB isn't configured
- Data persists indefinitely (you can add TTL indexes if needed)

## Local Development

For local development without MongoDB, the app will automatically use in-memory storage (games won't persist between restarts, but perfect for testing).

To use MongoDB locally:

1. Add `MONGODB_URI` to your `.env.local` file
2. Restart your dev server

## Testing

After setup, test by:

1. Creating a new game
2. Joining the game from a different browser/incognito window
3. Both should see the same game state
4. Games will persist even after server restarts

## Troubleshooting

If you get errors:

- **"Failed to connect to MongoDB"**: Check your connection string and network access settings
- **"Authentication failed"**: Verify your username and password in the connection string
- **"Connection timeout"**: Make sure you allowed access from anywhere (0.0.0.0/0) in Network Access
- Check Vercel function logs for detailed error messages
