import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { logger } from './logger.js';
import { generateEmbedding } from './embeddings.js';
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
  embedding?: number[] | null;
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
  if (!message.embedding && message.content && (message.role === 'user' || message.role === 'assistant')) {
    try {
      message.embedding = await generateEmbedding(message.content);
    } catch (e) {
      logger.error('Failed to generate embedding for chat message');
    }
  }
  const { error } = await supabase.from('chat_history').insert([message]);
  if (error) {
    logger.error({ error, message }, 'Error saving chat message');
  }
}

export async function searchChatHistory(chatId: number, queryText: string, matchCount: number = 5, matchThreshold: number = 0.5): Promise<ChatMessage[]> {
    const queryEmbedding = await generateEmbedding(queryText);
    if (!queryEmbedding) return [];

    const { data, error } = await supabase.rpc('match_chat_history', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        p_chat_id: chatId
    });

    if (error) {
        logger.error({ error, chatId }, 'Error searching chat history');
        return [];
    }
    return data as ChatMessage[];
}

export interface AgentMemory {
  id?: string;
  chat_id: number;
  topic: string;
  content: string;
  embedding?: number[] | null;
  created_at?: string;
}

export async function saveAgentMemory(memory: AgentMemory): Promise<boolean> {
  if (!memory.embedding && memory.content) {
    try {
      const embedText = `${memory.topic}: ${memory.content}`;
      memory.embedding = await generateEmbedding(embedText);
    } catch (e) {
      logger.error('Failed to generate embedding for agent memory');
    }
  }

  const { error } = await supabase.from('agent_memories').insert([memory]);
  if (error) {
    logger.error({ error, memory }, 'Error saving agent memory');
    return false;
  }
  return true;
}

export async function searchAgentMemories(chatId: number, queryText: string, matchCount: number = 5, matchThreshold: number = 0.5): Promise<AgentMemory[]> {
    const queryEmbedding = await generateEmbedding(queryText);
    if (!queryEmbedding) return [];

    const { data, error } = await supabase.rpc('match_agent_memories', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        p_chat_id: chatId
    });

    if (error) {
        logger.error({ error, chatId }, 'Error searching agent memories');
        return [];
    }
    return data as AgentMemory[];
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

// ─── Autonomous Agent State Machine ──────────────────────────────────────────

export interface AgentTask {
  id?: string;
  chat_id: number;
  status: 'idle' | 'working' | 'awaiting_user' | 'processing';
  goal?: string | null;
  task_history: Array<{ thought: string; action?: string; action_args?: Record<string, any>; result?: string }>;
  updated_at?: string;
}

export async function getAgentTask(chatId: number): Promise<AgentTask | null> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle();

  if (error) {
    logger.error({ error, chatId }, 'Error fetching agent task');
    return null;
  }
  return data as AgentTask | null;
}

export async function upsertAgentTask(task: Partial<AgentTask> & { chat_id: number }): Promise<boolean> {
  const { error } = await supabase
    .from('agent_tasks')
    .upsert({ ...task, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' });

  if (error) {
    logger.error({ error, task }, 'Error upserting agent task');
    return false;
  }
  return true;
}

/**
 * Atomically claims a task for processing by transitioning its status
 * from 'working' → 'processing'. Returns true only if THIS invocation won
 * the race. Any concurrent cron that tries to claim the same task will get
 * back an empty result and should skip it.
 */
export async function claimAgentTask(chatId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('status', 'working')
    .select();

  if (error) {
    logger.error({ error, chatId }, 'Error claiming agent task');
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

export async function getWorkingTasks(): Promise<AgentTask[]> {
  const STALE_PROCESSING_THRESHOLD_MS = 60_000; // 60 seconds
  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS).toISOString();

  // Fetch tasks that are 'working', OR 'processing' but have been stuck
  // for > 60 s (e.g. cron crashed before finishing).
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .or(`status.eq.working,and(status.eq.processing,updated_at.lt.${staleThreshold})`);

  if (error) {
    logger.error({ error }, 'Error fetching working agent tasks');
    return [];
  }

  // Re-mark any stale 'processing' tasks back to 'working' so claimAgentTask
  // can pick them up cleanly.
  const staleTasks = (data as AgentTask[]).filter(t => t.status === 'processing');
  for (const stale of staleTasks) {
    logger.warn({ chatId: stale.chat_id }, 'Resetting stale processing task to working');
    await supabase
      .from('agent_tasks')
      .update({ status: 'working', updated_at: new Date().toISOString() })
      .eq('chat_id', stale.chat_id)
      .eq('status', 'processing');
  }

  return data as AgentTask[];
}
