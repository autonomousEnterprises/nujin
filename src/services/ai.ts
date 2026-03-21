import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDynamicTools, saveDynamicTool, getDynamicSkills, saveDynamicSkill, getChatHistory } from './db.js';
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
    task: AgentTask
): Promise<AgentDecision> {
    logger.info({ chatId, status: task.status, goal: task.goal }, 'Running agent loop');

    const dynamicTools = await getDynamicTools();
    const chatHistoryReversed = await getChatHistory(chatId, 10);

    // Format chat history for the prompt
    const chatHistory = chatHistoryReversed.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n');

    // Build the available tool documentation for the LLM to reference
    const toolDocs = [
        ...builtinTools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        })),
        ...dynamicTools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: { type: 'object', properties: {}, required: [] } // Dynamic tools are simpler but we should at least give the description
        }))
    ];

    const userContent = JSON.stringify({
        goal: task.goal || '(no goal set)',
        recent_chat_history: chatHistory || '(no previous messages)',
        task_history: task.task_history,
        available_tools: toolDocs
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

    // If the agent wants to call a tool, execute it
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

    // Append this step to task_history (caller is responsible for persisting)
    const historyEntry: { thought: string; action?: string; result?: string } = {
        thought: parsed.thought
    };
    if (parsed.tool_to_call) historyEntry.action = parsed.tool_to_call;
    if (toolResult !== undefined) historyEntry.result = toolResult;
    task.task_history.push(historyEntry);

    return parsed;
}
