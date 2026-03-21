import { upsertAgentTask, getAgentTask } from '../services/db.js';
import type { BuiltinTool } from './types.js';

export const manageTaskTool: BuiltinTool = {
    name: 'manage_task',
    description: 'Manage an autonomous background task for complex goals. Use this ONLY for long-running or multi-step processes that require background execution.',
    parameters: {
        type: 'object',
        properties: {
            action: { 
                type: 'string', 
                enum: ['start', 'update', 'finish', 'status'],
                description: 'The action to perform on the autonomous task.'
            },
            goal: { 
                type: 'string', 
                description: 'The complex goal to pursue autonomously (required for "start" and "update").' 
            }
        },
        required: ['action']
    },
    execute: async (args: { action: 'start' | 'update' | 'finish' | 'status', goal?: string }, { chatId }) => {
        if (!chatId) return "Error: chatId is required.";

        const currentTask = await getAgentTask(chatId);

        switch (args.action) {
            case 'start':
                if (!args.goal) return "Error: goal is required to start a task.";
                await upsertAgentTask({
                    chat_id: chatId,
                    goal: args.goal,
                    status: 'working',
                    task_history: []
                });
                return `Autonomous task started with goal: "${args.goal}". I will now work on this in the background.`;

            case 'update':
                if (!args.goal) return "Error: goal is required to update a task.";
                await upsertAgentTask({
                    chat_id: chatId,
                    goal: args.goal,
                    status: 'working'
                });
                return `Goal updated to: "${args.goal}". Continuing autonomously.`;

            case 'finish':
                await upsertAgentTask({
                    chat_id: chatId,
                    status: 'idle',
                    goal: null,
                    task_history: []
                });
                return "Autonomous task finished. Returning to standard chat mode.";

            case 'status':
                if (!currentTask || currentTask.status === 'idle') {
                    return "No active autonomous task found for this chat.";
                }
                return `Current Goal: "${currentTask.goal}"\nStatus: ${currentTask.status}\nSteps taken: ${currentTask.task_history.length}`;

            default:
                return "Invalid action.";
        }
    }
};
