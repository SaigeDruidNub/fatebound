# Adventure Story Game

An interactive AI-powered adventure game where you describe your actions and the AI determines the outcomes. Make strategic decisions, solve puzzles, and navigate through exciting scenarios!

## Features

- 🎮 Interactive text-based adventure gameplay
- 🤖 AI-powered story generation (with intelligent fallback system)
- 🎨 Beautiful, responsive UI with smooth animations
- 📖 Story history tracking
- 🔄 Ability to start new games

## How It Works

1. You're presented with a scenario (e.g., "You see treasure but the floor is booby-trapped")
2. You type your action (e.g., "I carefully examine the floor for traps")
3. The AI evaluates your action and generates the outcome
4. A new scenario is presented based on your choices

## Getting Started

### Installation

First, install dependencies:

```bash
npm install
```

### Optional: Set Up Gemini API (Recommended)

For the best experience with dynamic AI-generated stories:

1. Copy `.env.local.example` to `.env.local`:

   ```bash
   copy .env.local.example .env.local
   ```

2. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

3. Add your API key to `.env.local`:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

**Note:** The app works without an API key using a built-in fallback system, but the AI version provides much more dynamic and creative responses!

### Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to start playing!

## How to Play

1. Read the scenario presented to you
2. Type what you want your character to do in the text area
3. Click "Take Action" to see what happens
4. The AI will evaluate your action and present a new situation
5. Continue making choices to progress through your adventure!

**Tips:**

- Be creative with your actions!
- Cautious approaches might help you avoid traps
- Bold actions might yield greater rewards (or greater risks!)
- The AI considers the context of your previous actions

## Technology Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI:** Google Gemini 3.0 Flash Preview (optional, with fallback system)

## Learn More

To learn more about Next.js, take a look at the following resources:

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
