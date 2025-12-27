# MyEZList

A smart shopping list and recipe management app built with React and Supabase.

## Features

- 🛒 **Shopping Lists** - Create and manage multiple shopping lists
- 🍳 **Recipes** - Browse, save, and generate AI-powered recipes
- ✅ **Tasks** - Keep track of to-dos and errands
- 🎨 **Themes** - Customize the look with multiple color themes
- 📱 **PWA** - Install as a native app on any device
- 🤖 **AI-Powered** - Smart categorization and recipe generation

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Styling**: Tailwind CSS + shadcn/ui
- **AI**: OpenAI / Google Gemini (via Edge Functions)
- **Payments**: Stripe (subscriptions)

## Running the app

```bash
npm install
npm run dev
```

## Building the app

```bash
npm run build
```

## Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing

```bash
npm run test:e2e        # Run E2E tests
npm run test:e2e:ui     # Run tests with UI
npm run test:e2e:headed # Run tests in headed mode
```
