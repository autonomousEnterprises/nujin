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

export interface DynamicTool {
  id?: string;
  name: string;
  description: string;
  code: string;
  created_at?: string;
}

export interface DynamicSkill {
  id?: string;
  name: string;
  description: string;
  content: string;
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

export async function getDynamicTools(): Promise<DynamicTool[]> {
  const { data, error } = await supabase.from('bot_tools').select('*');
  if (error) {
    logger.error({ error }, 'Error fetching dynamic tools');
    return [];
  }
  return data as DynamicTool[];
}

export async function saveDynamicTool(tool: DynamicTool): Promise<boolean> {
  const { error } = await supabase.from('bot_tools').insert([tool]);
  if (error) {
    logger.error({ error, tool }, 'Error saving dynamic tool');
    return false;
  }
  return true;
}

export async function getDynamicSkills(): Promise<DynamicSkill[]> {
  const { data, error } = await supabase.from('bot_skills').select('*');
  if (error) {
    logger.error({ error }, 'Error fetching dynamic skills');
    return [];
  }
  return data as DynamicSkill[];
}

export async function saveDynamicSkill(skill: DynamicSkill): Promise<boolean> {
  const { error } = await supabase.from('bot_skills').insert([skill]);
  if (error) {
    logger.error({ error, skill }, 'Error saving dynamic skill');
    return false;
  }
  return true;
}
