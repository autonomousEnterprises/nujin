import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

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
  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }
  return data.reverse() as ChatMessage[];
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  const { error } = await supabase.from('chat_history').insert([message]);
  if (error) {
    console.error('Error saving chat message:', error);
  }
}

export async function getSkills(): Promise<Skill[]> {
  const { data, error } = await supabase.from('bot_skills').select('*');
  if (error) {
    console.error('Error fetching skills:', error);
    return [];
  }
  return data as Skill[];
}

export async function saveSkill(skill: Skill): Promise<boolean> {
  const { error } = await supabase.from('bot_skills').insert([skill]);
  if (error) {
    console.error('Error saving skill:', error);
    return false;
  }
  return true;
}
