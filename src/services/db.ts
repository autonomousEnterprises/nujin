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

export interface WalletData {
  id?: string;
  chat_id: number;
  blockchain: string;
  public_address: string;
  private_key: string;
  metadata?: Record<string, any>;
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

export async function getWallets(chatId: number, blockchain?: string): Promise<WalletData[]> {
  let query = supabase.from('bot_wallets').select('*').eq('chat_id', chatId);
  if (blockchain) {
    query = query.eq('blockchain', blockchain);
  }
  const { data, error } = await query;
  if (error) {
    logger.error({ error, blockchain, chatId }, 'Error fetching wallets');
    return [];
  }
  return data as WalletData[];
}

export async function isUpdateProcessed(updateId: number): Promise<boolean> {
  // Try to insert the updateId. If it fails (already exists), it means it's processed.
  const { error } = await supabase
    .from('processed_updates')
    .insert([{ update_id: updateId }]);
  
  if (error) {
    if (error.code === '23505') { // Unique violation
      return true;
    }
    logger.error({ error, updateId }, 'Error checking if update is processed');
    // If it's a "relation not found" error, we should probably log it clearly
    if (error.code === 'PGRST116' || error.message.includes('not found')) {
       logger.error('Table "processed_updates" does not exist. Please run the SQL setup.');
    }
  }
  
  return false;
}


export async function saveWallet(wallet: WalletData): Promise<boolean> {
  if (!wallet.chat_id) {
    logger.error({ wallet }, 'Missing chat_id when attempting to save wallet');
    return false;
  }
  const { error } = await supabase.from('bot_wallets').insert([wallet]);
  if (error) {
    logger.error({ error, wallet }, 'Error saving wallet');
    return false;
  }
  return true;
}

