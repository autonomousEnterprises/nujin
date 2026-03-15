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
CREATE POLICY "Allow all access" ON chat_history FOR ALL USING (true);
CREATE POLICY "Allow all access" ON bot_tools FOR ALL USING (true);
CREATE POLICY "Allow all access" ON bot_skills FOR ALL USING (true);
CREATE POLICY "Allow all access" ON bot_wallets FOR ALL USING (true);
