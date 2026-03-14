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

-- Note: Since the bot is backend-driven, you might want to use the service role key.
-- If you need specific policies, you can define them here.
-- Example: Allow service role full access (default)
-- For client-side access, you would need more specific policies.
