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

export async function processChat(messages: any[], chatId: number): Promise<string> {
    logger.info({ chatId, messageCount: messages.length }, 'Processing chat');

    const dynamicTools = await getDynamicTools();
    const availableSkills = await getAvailableSkills();

    const tools: any[] = [
        {
            type: 'function',
            function: {
                name: 'create_tool',
                description: 'Creates a new javascript executable tool.',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Unique name for the tool' },
                        description: { type: 'string', description: 'What the tool does' },
                        code: { type: 'string', description: 'Javascript code' }
                    },
                    required: ['name', 'description', 'code']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'create_skill',
                description: 'Creates a new Skill SOP (Standard Operating Procedure).',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Unique name for the skill (e.g. market_analysis)' },
                        description: { type: 'string', description: 'Brief description of the strategy' },
                        content: { type: 'string', description: 'Markdown content of the SOP' }
                    },
                    required: ['name', 'description', 'content']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'read_skill',
                description: 'Reads a Skill SOP (Standard Operating Procedure).',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { 
                            type: 'string', 
                            description: 'The name of the skill to read',
                            enum: availableSkills.map(s => s.name)
                        }
                    },
                    required: ['name']
                }
            }
        }
    ];

    for (const tool of dynamicTools) {
        tools.push({
            type: 'function',
            function: {
                name: `tool_execute_${tool.name}`,
                description: `Executes dynamic tool: ${tool.name}`,
                parameters: {
                    type: 'object',
                    properties: { args: { type: 'object' } }
                }
            }
        });
    }

    for (const tool of builtinTools) {
        tools.push({
            type: 'function',
            function: {
                name: `tool_${tool.name}`,
                description: `BUILT-IN TOOL: ${tool.description}`,
                parameters: tool.parameters
            }
        });
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            tools,
            tool_choice: 'auto'
        });

        const message = response.choices[0]?.message;
        if (!message) return 'No response generated.';

        if (message.tool_calls && message.tool_calls.length > 0) {
            messages.push({ ...message, content: message.content || '' });

            for (const tc of message.tool_calls) {
                if (tc.type !== 'function') continue;
                const toolCall = tc as any;
                const args = JSON.parse(toolCall.function.arguments || '{}');

                if (toolCall.function.name === 'create_tool') {
                    const saved = await saveDynamicTool({
                        name: args.name,
                        description: args.description,
                        code: args.code
                    });
                    const content = saved ? `Saved tool: ${args.name}` : 'Failed to save.';
                    messages.push({ role: 'tool', tool_call_id: toolCall.id, content });
                }
                else if (toolCall.function.name === 'create_skill') {
                    const saved = await saveDynamicSkill({
                        name: args.name,
                        description: args.description,
                        content: args.content
                    });
                    const content = saved ? `Saved skill: ${args.name}` : 'Failed to save.';
                    messages.push({ role: 'tool', tool_call_id: toolCall.id, content });
                }
                else if (toolCall.function.name === 'read_skill') {
                    const result = await readSkillContent(args.name) || 'Skill not found.';
                    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
                }
                else if (toolCall.function.name.startsWith('tool_execute_')) {
                    const name = toolCall.function.name.replace('tool_execute_', '');
                    const tool = dynamicTools.find(t => t.name === name);
                    const result = tool ? await executeDynamicTool(tool.code, args.args || args) : 'Tool not found.';
                    messages.push({ 
                        role: 'tool', 
                        tool_call_id: toolCall.id, 
                        content: typeof result === 'string' ? result : (JSON.stringify(result) ?? 'null') 
                    });
                }
                else if (toolCall.function.name.startsWith('tool_')) {
                    const name = toolCall.function.name.replace('tool_', '');
                    const tool = builtinTools.find(t => t.name === name);
                    let result;
                    if (tool) {
                        try { result = await tool.execute(args, { chatId }); } catch (e: any) { result = `Error: ${e.message}`; }
                    } else { result = 'Tool not found.'; }
                    messages.push({ 
                        role: 'tool', 
                        tool_call_id: toolCall.id, 
                        content: typeof result === 'string' ? result : (JSON.stringify(result) ?? 'null') 
                    });
                }
            }

            return processChat(messages, chatId);
        }

        return message.content || 'I have nothing more to say.';
    } catch (error: any) {
        logger.error({ error: error.message, chatId }, 'Error in processChat');
        throw error;
    }
}

// ─── Autonomous Agent Loop ────────────────────────────────────────────────────

export interface AgentDecision {
    thought: string;
    decision: 'CONTINUE' | 'WAIT_FOR_USER' | 'FINISH';
    tool_to_call?: string;
    tool_args?: Record<string, any>;
    message_to_telegram: string;
}

const AGENT_SYSTEM_PROMPT = `You are an autonomous AI Agent called Nujin. You operate in a reasoning loop.
You will receive your current GOAL and TASK_HISTORY.
You MUST respond ONLY with a single valid JSON object — no prose, no markdown fences — in this exact format:
{
  "thought": "Your internal reasoning about what to do next",
  "decision": "CONTINUE" | "WAIT_FOR_USER" | "FINISH",
  "tool_to_call": "optional_tool_name or null",
  "tool_args": {},
  "message_to_telegram": "Short status update or question for the user"
}
Rules:
- CONTINUE  → you have more autonomous steps to take. Call a tool or reason further.
- WAIT_FOR_USER → you need clarification or permission before continuing.
- FINISH → the goal has been fully achieved. Summarise what was done.
Always write message_to_telegram in a concise, human-friendly tone.`;

export async function runAgentLoop(
    chatId: number,
    task: AgentTask
): Promise<AgentDecision> {
    logger.info({ chatId, status: task.status, goal: task.goal }, 'Running agent loop');

    const dynamicTools = await getDynamicTools();
    const chatHistoryReversed = await getChatHistory(chatId, 10);
    
    // Format chat history for the prompt
    const chatHistory = chatHistoryReversed.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n');

    // Build the available tool names for the LLM to reference
    const toolNames = [
        ...builtinTools.map(t => t.name),
        ...dynamicTools.map(t => t.name)
    ];

    const userContent = JSON.stringify({
        goal: task.goal || '(no goal set)',
        recent_chat_history: chatHistory || '(no previous messages)',
        task_history: task.task_history,
        available_tools: toolNames
    });

    let raw: string;
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: AGENT_SYSTEM_PROMPT },
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
