-- Nujin Database Setup: Tools and Skills (SOPs)

-- 1. Chat History Table
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id BIGINT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Dynamic Tools Table (Executable Code)
CREATE TABLE IF NOT EXISTS bot_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Dynamic Skills Table (Markdown SOPs)
CREATE TABLE IF NOT EXISTS bot_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Dynamic Wallets Table
CREATE TABLE IF NOT EXISTS bot_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id BIGINT NOT NULL,
    blockchain TEXT NOT NULL,
    public_address TEXT NOT NULL UNIQUE,
    private_key TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Row Level Security (RLS) - Basic Setup
-- WARNING: In production, refine these policies based on your security needs.

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_wallets ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write for now (adjust as needed)
DROP POLICY IF EXISTS "Allow all access" ON chat_history;
CREATE POLICY "Allow all access" ON chat_history FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access" ON bot_tools;
CREATE POLICY "Allow all access" ON bot_tools FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access" ON bot_skills;
CREATE POLICY "Allow all access" ON bot_skills FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all access" ON bot_wallets;
CREATE POLICY "Allow all access" ON bot_wallets FOR ALL USING (true);

-- 5. Telegram Webhook Deduplication Table
CREATE TABLE IF NOT EXISTS processed_updates (
    update_id BIGINT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE processed_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON processed_updates;
CREATE POLICY "Allow all access" ON processed_updates FOR ALL USING (true);

-- 6. Agent Tasks Table (Autonomous Agent State Machine)
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id BIGINT UNIQUE NOT NULL,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'working', 'awaiting_user')),
    goal TEXT,
    task_history JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON agent_tasks;
CREATE POLICY "Allow all access" ON agent_tasks FOR ALL USING (true);
