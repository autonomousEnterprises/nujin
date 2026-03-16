# Nujin (Agentic Eco)

> [!WARNING]
> This project is in an early stage and is currently in the development and testing phase. Use it at your own risk. Contributions and feedback are always welcome!

Nujin is a serverless, **autonomous** Telegram Bot built with [Grammy](https://grammy.dev/) and [Vercel](https://vercel.com/). It operates as a self-directing AI agent: it reasons in a loop, executes its own tools, and only pauses to ask you when it genuinely needs input.

## 🧠 How Autonomy Works

Nujin implements a **state machine** backed by Supabase. Each conversation has a persistent `agent_tasks` row with a `goal`, `task_history`, and one of three statuses:

| Status | Meaning |
|---|---|
| `working` | Agent is actively reasoning and taking actions |
| `awaiting_user` | Agent needs your input before continuing |
| `idle` | Goal has been achieved |

On each user message, the bot runs one reasoning iteration immediately. An **external cron** can then POST to `/api/cron` to keep the loop running in the background without you doing anything.

The LLM always responds in structured JSON:
```json
{
  "thought": "...",
  "decision": "CONTINUE | WAIT_FOR_USER | FINISH",
  "tool_to_call": "optional_tool_name",
  "tool_args": {},
  "message_to_telegram": "What the user sees"
}
```

## 🏗 Architecture: Tools vs Skills

- **Built-in Tools:** TypeScript functions for core capabilities (Web Search, Web3, Time).
- **Dynamic Tools:** JavaScript snippets created by the AI at runtime and executed in a secure sandbox.
- **Skills (Markdown SOPs):** Strategic procedures that guide the AI on multi-step tasks.

All state, tools, skills, wallets, and chat history are persisted in **Supabase**.

## 🚀 Setup

### 1. Telegram Bot
- Contact [@BotFather](https://t.me/botfather) and use `/newbot`. Copy the **API Token**.

### 2. Environment Variables
Create a `.env` file or set these in Vercel:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
CRON_SECRET=a_random_secret_string
LANGSEARCH_API_KEY=your_langsearch_api_key
```

> [!IMPORTANT]
> Use the `service_role` key from Supabase to bypass RLS. Set `CRON_SECRET` to protect your `/api/cron` endpoint.

### 3. Database
Run `supabase_setup.sql` in the Supabase SQL Editor to create all tables:
`chat_history`, `bot_tools`, `bot_skills`, `bot_wallets`, `processed_updates`, `agent_tasks`.

### 4. Local Development
```bash
npm install
npm run dev
```

## 🌍 Deployment

1. Push to GitHub and connect to Vercel.
2. Register the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<APP>.vercel.app/api/webhook"
   ```
3. Configure your external cron to POST to `/api/cron` at your desired interval:
   ```bash
   curl -X POST https://<APP>.vercel.app/api/cron \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```

## 🎮 Usage
Chat with Nujin on Telegram. Examples:
- *"Research the best DeFi yield strategies and create a report."*
- *"Create a tool to track ETH gas prices and check it every hour."*
- *"Develop a skill for analyzing crypto market sentiment."*
