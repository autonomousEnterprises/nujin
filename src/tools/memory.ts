import { saveAgentMemory, searchAgentMemories } from '../services/db.js';
import type { BuiltinTool } from './types.js';

export const storeMemoryTool: BuiltinTool = {
    name: 'store_memory',
    description: 'Store an important fact, user preference, or strategy into your core permanent memory.',
    parameters: {
        type: 'object',
        properties: {
            topic: { type: 'string', description: 'What this memory is about (e.g. "User Preference", "Trading Strategy")' },
            content: { type: 'string', description: 'The exact fact or strategy to remember' }
        },
        required: ['topic', 'content']
    },
    execute: async (args: { topic: string; content: string }, { chatId }) => {
        if (!chatId) return "Error: chatId is required.";
        const success = await saveAgentMemory({
            chat_id: chatId,
            topic: args.topic,
            content: args.content
        });
        return success ? `Successfully stored core memory on topic: ${args.topic}` : "Failed to store memory.";
    }
};

export const searchMemoryTool: BuiltinTool = {
    name: 'search_explicit_memory',
    description: 'Search your core permanent memory for a specific topic or fact.',
    parameters: {
        type: 'object',
        properties: {
             query: { type: 'string', description: 'The topic or fact to search for' }
        },
        required: ['query']
    },
    execute: async (args: { query: string }, { chatId }) => {
        if (!chatId) return "Error: chatId is required.";
        const results = await searchAgentMemories(chatId, args.query, 5, 0.4);
        if (results.length === 0) return "No relevant core memories found.";
        return results.map(r => `[${r.topic}]: ${r.content}`).join('\n');
    }
};
