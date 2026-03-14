import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { logger } from './logger.js';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  logger.warn('SUPABASE_URL or SUPABASE_KEY is missing. Database features will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface ChatMessage {
  id?: string;
  chat_id: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  created_at?: string;
}

export interface Skill {
  id?: string;
  name: string;
  description: string;
  code: string;
  created_at?: string;
}

export async function getChatHistory(chatId: number, limit = 20): Promise<ChatMessage[]> {
  logger.debug({ chatId, limit }, 'Fetching chat history');
  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error, chatId }, 'Error fetching chat history');
    return [];
  }
  return data.reverse() as ChatMessage[];
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  const { error } = await supabase.from('chat_history').insert([message]);
  if (error) {
    logger.error({ error, message }, 'Error saving chat message');
  }
}

export async function getSkills(): Promise<Skill[]> {
  const { data, error } = await supabase.from('bot_skills').select('*');
  if (error) {
    logger.error({ error }, 'Error fetching skills');
    return [];
  }
  return data as Skill[];
}

export async function saveSkill(skill: Skill): Promise<boolean> {
  const { error } = await supabase.from('bot_skills').insert([skill]);
  if (error) {
    logger.error({ error, skill }, 'Error saving skill');
    return false;
  }
  return true;
}
