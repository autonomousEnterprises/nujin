import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDynamicTools, saveDynamicTool, getDynamicSkills, saveDynamicSkill, getChatHistory, searchChatHistory, searchAgentMemories } from './db.js';
import type { AgentTask } from './db.js';
import { executeDynamicTool } from './tools.js';
import { builtinTools } from '../tools/index.js';
import { getAvailableSkills, readSkillContent } from './skills.js';
import { logger } from './logger.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROMPTS_DIR = path.join(__dirname, '../prompts');

export function getSystemPrompt(): string {
    const filePath = path.join(PROMPTS_DIR, 'system.md');
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
}

export const SYSTEM_PROMPT = getSystemPrompt();



// ─── Autonomous Agent Loop ────────────────────────────────────────────────────

export interface AgentDecision {
    thought: string;
    decision: 'CONTINUE' | 'WAIT_FOR_USER' | 'FINISH';
    tool_to_call?: string;
    tool_args?: Record<string, any>;
    message_to_telegram: string;
}

export async function runAgentLoop(
    chatId: number,
    task?: AgentTask
): Promise<AgentDecision> {
    logger.info({ chatId, status: task?.status, goal: task?.goal }, 'Running agent loop');

    const dynamicTools = await getDynamicTools();
    const chatHistoryReversed = await getChatHistory(chatId, 50);
    const chatHistory = chatHistoryReversed.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n');

    const toolDocs = [
        ...builtinTools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        })),
        ...dynamicTools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: { type: 'object', properties: {}, required: [] }
        }))
    ];

    let queryText = task?.goal || '';
    if (!queryText) {
        const latestUserMsg = chatHistoryReversed.find(m => m.role === 'user');
        queryText = latestUserMsg?.content || '';
    }

    let relevantPastContext = '';
    if (queryText) {
        // Find top 5 relevant older messages
        const relevantChats = await searchChatHistory(chatId, queryText, 5, 0.4);
        if (relevantChats.length > 0) {
            relevantPastContext += '--- RELEVANT PAST CHAT MESSAGES ---\n' + 
                relevantChats.map(m => `[${m.role.toUpperCase()}] (Score: ~sim): ${m.content}`).join('\n') + '\n\n';
        }

        // Find top 3 relevant declarative memories
        const relevantMemories = await searchAgentMemories(chatId, queryText, 3, 0.4);
        if (relevantMemories.length > 0) {
            relevantPastContext += '--- EXPLICIT CORE MEMORIES ---\n' + 
                relevantMemories.map(m => `Topic: ${m.topic}\nContent: ${m.content}`).join('\n') + '\n\n';
        }
    }

    const maxChatIterations = 5;
    let iterations = 0;
    const localHistory = task ? [...task.task_history] : [];

    while (iterations < maxChatIterations) {
        iterations++;

        const userContent = JSON.stringify({
            goal: task?.goal || '(standard chat - no active goal)',
            recent_chat_history: chatHistory || '(no previous messages)',
            relevant_longterm_memory: relevantPastContext || '(no relevant past memory found)',
            task_history: localHistory,
            available_tools: toolDocs,
            mode: task ? 'AUTONOMOUS' : 'CHAT'
        });

        let raw: string;
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userContent }
                ],
                response_format: { type: 'json_object' }
            });
            raw = response.choices[0]?.message?.content || '{}';
        } catch (err: any) {
            logger.error({ err: err.message, chatId }, 'LLM call failed in runAgentLoop');
            return {
                thought: 'LLM call failed.',
                decision: 'WAIT_FOR_USER',
                message_to_telegram: '⚠️ I hit an error during my reasoning loop. Please check back shortly.'
            };
        }

        let parsed: AgentDecision;
        try {
            parsed = JSON.parse(raw);
        } catch {
            logger.warn({ raw, chatId }, 'Failed to parse agent JSON response');
            return {
                thought: raw,
                decision: 'WAIT_FOR_USER',
                message_to_telegram: '⚠️ I produced an unexpected response. Please try again.'
            };
        }

        // Execute tool if requested
        let toolResult: string | undefined;
        if (parsed.tool_to_call) {
            const toolArgs = parsed.tool_args || {};
            const builtIn = builtinTools.find(t => t.name === parsed.tool_to_call);
            const dynamic = dynamicTools.find(t => t.name === parsed.tool_to_call);

            try {
                if (builtIn) {
                    const res = await builtIn.execute(toolArgs, { chatId });
                    toolResult = typeof res === 'string' ? res : JSON.stringify(res);
                } else if (dynamic) {
                    const res = await executeDynamicTool(dynamic.code, toolArgs);
                    toolResult = typeof res === 'string' ? res : JSON.stringify(res);
                } else {
                    toolResult = `Tool "${parsed.tool_to_call}" not found.`;
                }
            } catch (e: any) {
                toolResult = `Tool error: ${e.message}`;
            }
            logger.info({ chatId, tool: parsed.tool_to_call, toolResult }, 'Agent tool executed');
        }

        // Update local history
        const historyEntry: { thought: string; action?: string; result?: string } = {
            thought: parsed.thought
        };
        if (parsed.tool_to_call) historyEntry.action = parsed.tool_to_call;
        if (toolResult !== undefined) historyEntry.result = toolResult;
        localHistory.push(historyEntry);

        // In autonomous mode, return after one step to allow persistence and cron orchestration
        if (task) {
            task.task_history = localHistory;
            return parsed;
        }

        // In chat mode, if a tool was called, we loop back to let the LLM see the result and respond
        if (parsed.tool_to_call) {
            continue;
        }

        // Final response from the LLM
        return parsed;
    }

    return {
        thought: 'Hit max iterations in chat mode.',
        decision: 'WAIT_FOR_USER',
        message_to_telegram: '⚠️ I took too many steps. Please simplify your request.'
    };
}
