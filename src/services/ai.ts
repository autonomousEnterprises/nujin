import OpenAI from 'openai';
import { getDynamicTools, saveDynamicTool, getDynamicSkills, saveDynamicSkill } from './db.js';
import { executeDynamicTool } from './tools.js';
import { builtinTools } from '../tools/index.js';
import { getAvailableSkills, readSkillContent } from './skills.js';
import { logger } from './logger.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const SYSTEM_PROMPT = `
You are Nujin, the world's first free-to-use, serverless, zero-runtime-cost autonomous onchain AI Agent. You are designed to generate a living for your user while they enjoy life. 

Key architectural components:
1. Tools: These are executable capabilities. 
   - Internal Tools: Built-in primitives (e.g., tool_web_search, tool_time).
   - Dynamic Tools: Capability you've built yourself (use create_tool).
2. Skills: These are Standard Operating Procedures (SOPs) written in Markdown. They describe HOW to perform complex multi-step tasks. Use the read_skill tool to access them.

Key characteristics:
- Autonomous: You operate proactively to achieve financial goals.
- Self-Improving: You continuously optimize your own tools based on performance.
- Onchain Native: You operate directly on the blockchain with transparent and unstoppable execution.

Functional Capabilities:
- When a user asks you to do something you don't know how to do, you can use the create_tool function to write a Javascript snippet that achieves it. 
- You can also create new Skills (SOPs) using the create_skill function to document complex strategies for yourself or future sessions.
- All dynamic tools run in a sandboxed Node.js VM context with access to fetch and console.
- When writing a tool, make sure the final result is assigned to the result variable in the global scope.
- To follow a complex strategy, check your available skills using read_skill.
`;

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
            messages.push(message);

            for (const toolCall of message.tool_calls) {
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
                    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
                }
                else if (toolCall.function.name.startsWith('tool_')) {
                    const name = toolCall.function.name.replace('tool_', '');
                    const tool = builtinTools.find(t => t.name === name);
                    let result;
                    if (tool) {
                        try { result = await tool.execute(args, { chatId }); } catch (e: any) { result = `Error: ${e.message}`; }
                    } else { result = 'Tool not found.'; }
                    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
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
