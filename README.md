# Nujin (Agentic Eco)

> [!WARNING]
> This project is in an early stage and is currently in the development and testing phase. Use it at your own risk. Contributions and feedback are always welcome!

Nujin is a serverless Telegram Bot built with [Grammy](https://grammy.dev/) and [Vercel](https://vercel.com/). It acts as an autonomous AI agent capable of managing its own capabilities through a dual architecture of **Tools** and **Skills**.

## 🏗 Architecture: Tools vs Skills

Nujin distinguishes between executable code and strategic procedures:

- **Tools (Executable Code):** 
  - **Built-in Tools:** Hardcoded TypeScript functions for core capabilities (Web Search, Web3, Time).
  - **Dynamic Tools:** JavaScript code snippets created by the AI at runtime, executed in a secure sandbox context.
- **Skills (Markdown SOPs):** 
  - Standard Operating Procedures (SOPs) written in Markdown that guide the AI on how to perform complex, multi-step tasks using available tools.

All dynamic tools, skills, and chat history are persisted in **Supabase**.

## 🛠 Built-in Capabilities

- **Web Search & Visit:** Real-time information retrieval and page content extraction.
- **Web3 Integration:** Wallet management and blockchain interactions.
- **Dynamic Learning:** Ability to `create_tool` (JS execution) and `create_skill` (SOP writing) on the fly.

## 🚀 Setup

### 1. Telegram Bot Setup
- Contact [@BotFather](https://t.me/botfather) and use `/newbot`.
- Copy the **API Token**.
- (Optional) Use `/setprivacy` and set it to **Disabled** to receive all messages in groups.

### 2. Environment Variables
Create a `.env` file or set these in Vercel:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

> [!IMPORTANT]
> Use the `service_role` key from Supabase to bypass RLS for internal bot operations.

### 3. Database
Run `supabase_setup.sql` in your Supabase SQL Editor to initialize the necessary tables (`chat_history`, `bot_skills`, `bot_tools`).

### 4. Local Development
```bash
npm install
npm run dev
```

## 🌍 Deployment

1. Push to GitHub.
2. Connect to Vercel.
3. Register the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<APP>.vercel.app/api/webhook"
   ```

## 🎮 Usage
Chat with Nujin on Telegram. Try:
- "Search for the latest news on AI agents."
- "Create a tool to calculate Fibonacci numbers and test it."
- "Develop a skill for analyzing crypto market sentiment."
