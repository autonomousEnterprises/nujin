-- Create chat_history table
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster chat history retrieval
CREATE INDEX IF NOT EXISTS idx_chat_history_chat_id ON public.chat_history(chat_id);

-- Create bot_skills table
CREATE TABLE IF NOT EXISTS public.bot_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_skills ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow anyone to insert and select chat history (since we identify by chat_id)
CREATE POLICY "Allow anon insert" ON public.chat_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon select" ON public.chat_history FOR SELECT USING (true);

-- Allow anyone to insert and select bot skills
CREATE POLICY "Allow anon insert" ON public.bot_skills FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon select" ON public.bot_skills FOR SELECT USING (true);

-- Note: In production, you might want to use the service role key for the backend bot
-- to bypass RLS entirely instead of using these wide-open policies.
