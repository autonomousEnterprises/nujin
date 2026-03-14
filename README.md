# Telegram AI Bot (Agentic Serverless)

A serverless Telegram Bot built with Grammy and Vercel. It acts as an autonomous AI agent capable of writing and executing its own JavaScript skills dynamically using a secure VM context. Memory and Skills are persisted in Supabase.

## Setup

1. **Telegram Bot Setup:**
   - Open Telegram and search for [@BotFather](https://t.me/botfather).
   - Send `/newbot` and follow the instructions to create a new bot.
   - Once created, copy the **API Token** provided.
   - (Optional) Send `/setprivacy` to `@BotFather`, select your bot, and set it to **Disabled** if you want the bot to receive all group messages.

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root with:
   
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   ```
   
   > [!NOTE]
   > Use the `service_role` key from Supabase (Settings > API) to bypass RLS policies for the backend bot. If you use the `anon` key, ensure the RLS policies in `supabase_setup.sql` are applied.

4. **Database Schema:**
   Run the SQL script `supabase_setup.sql` in your Supabase SQL Editor to create the `chat_history` and `bot_skills` tables.

## Deployment to Vercel

1. Push this repository to GitHub.
2. Link the repository to a new Vercel project.
3. Configure the Environment Variables in the Vercel dashboard.
4. Deploy the project.

## Register Telegram Webhook

To connect Telegram to your newly deployed Vercel function, run:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<YOUR_VERCEL_APP_URL>/api/webhook"
```

Replace `<TELEGRAM_BOT_TOKEN>` and `<YOUR_VERCEL_APP_URL>` with your specific values.

## Usage
Chat with your bot on Telegram! For example, ask it to:
"Create a skill to fetch the current Ethereum price and then execute it."
