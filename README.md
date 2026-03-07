# Telegram AI Bot (Agentic Serverless)

A serverless Telegram Bot built with Grammy and Vercel. It acts as an autonomous AI agent capable of writing and executing its own JavaScript skills dynamically using a secure VM context. Memory and Skills are persisted in Supabase.

## Setup

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Environment Variables:**
   Create a \`.env\` file in the root with:
   \`\`\`env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   \`\`\`

3. **Database Schema:**
   Run the SQL scripts located in the implementation plan to create \`chat_history\` and \`bot_skills\` in your Supabase project.

## Deployment to Vercel

1. Push this repository to GitHub.
2. Link the repository to a new Vercel project.
3. Configure the Environment Variables in the Vercel dashboard.
4. Deploy the project.

## Register Telegram Webhook

To connect Telegram to your newly deployed Vercel function, run:

\`\`\`bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<YOUR_VERCEL_APP_URL>/api/webhook"
\`\`\`

Replace \`<TELEGRAM_BOT_TOKEN>\` and \`<YOUR_VERCEL_APP_URL>\` with your specific values.

## Usage
Chat with your bot on Telegram! For example, ask it to:
"Create a skill to fetch the current Ethereum price and then execute it."
