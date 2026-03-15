import OpenAI from 'openai';
import { getSkills, saveSkill } from './db.js';
import { executeSkill } from './skills.js';
import { builtinTools } from '../tools/index.js';
import { logger } from './logger.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const SYSTEM_PROMPT = `
You are Nujin, the world's first free-to-use, serverless, zero-runtime-cost autonomous onchain AI Agent. You are designed to generate a living for your user while they enjoy life. 

Key architectural components:
1. Tools: These are your built-in, static primitive capabilities (e.g., checking weather, time, or web search). 
2. Skills: These are your dynamic, learned capabilities. You can create them yourself to solve complex problems.

Key characteristics:
- Autonomous: You operate proactively to achieve financial goals.
- Self-Improving: You continuously optimize your own skills and tools based on performance.
- Onchain Native: You operate directly on the blockchain with transparent and unstoppable execution.

Functional Capabilities:
- When a user asks you to do something you don't know how to do, you can use the create_skill function to write a Javascript snippet that achieves it. 
- All skills run in a sandboxed Node.js VM context with access to fetch and console.
- When writing a skill, make sure the final result is assigned to the result variable in the global scope (e.g. result = await fetch(...).then(r => r.json());). 
- To use an existing learned skill, you can use the execute_skill functions.
- You also have built-in tools available for common primitive tasks.
`;

export async function processChat(messages: any[], chatId: number): Promise<string> {
    logger.info({ chatId, messageCount: messages.length }, 'Processing chat');

    // Load dynamic skills and map them to OpenAI function definitions
    const dynamicSkills = await getSkills();

    const tools: any[] = [
        {
            type: 'function',
            function: {
                name: 'create_skill',
                description: 'Creates a new javascript skill and saves it to the database so you can use it later.',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'A unique name for the skill (e.g. get_crypto_price)' },
                        description: { type: 'string', description: 'What the skill does' },
                        code: { type: 'string', description: 'The javascript code that executes the skill. Assign the output to the global variable result.' }
                    },
                    required: ['name', 'description', 'code']
                }
            }
        },
    ];

    // Expose existing dynamic skills
    for (const skill of dynamicSkills) {
        tools.push({
            type: 'function',
            function: {
                name: `execute_skill_${skill.name}`,
                description: `Executes the dynamic skill: ${skill.name} - ${skill.description}`,
                parameters: {
                    type: 'object',
                    properties: {
                        args: {
                            type: 'object',
                            description: 'Arguments to pass to the skill, accessed via args in the code'
                        }
                    }
                }
            }
        });
    }

    // Expose built-in tools
    for (const tool of builtinTools) {
        tools.push({
            type: 'function',
            function: {
                name: `tool_${tool.name}`,
                description: `BUILT-IN TOOL: ${tool.description}. USE THIS for any real-time information, news, or general knowledge search.`,
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
            const toolCall = message.tool_calls[0] as any;
            const args = JSON.parse(toolCall.function.arguments || '{}');

            logger.info({ toolName: toolCall.function.name, args, chatId }, 'Tool call detected');

            if (toolCall.function.name === 'create_skill') {
                const saved = await saveSkill({
                    name: args.name,
                    description: args.description,
                    code: args.code
                });

                const skillResult = saved ? `Successfully saved skill: ${args.name}` : 'Failed to save skill.';
                logger.info({ skillName: args.name, saved, chatId }, 'Skill creation result');

                // Loop back with the result
                messages.push(message);
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: skillResult
                });

                return processChat(messages, chatId);
            }
            else if (toolCall.function.name.startsWith('execute_skill_')) {
                const skillName = toolCall.function.name.replace('execute_skill_', '');
                const skill = dynamicSkills.find(s => s.name === skillName);

                let executionResult;
                if (skill) {
                    executionResult = await executeSkill(skill.code, args.args || args);
                } else {
                    executionResult = `Skill ${skillName} not found.`;
                }

                logger.info({ skillName, success: !!skill, chatId }, 'Skill execution completed');

                messages.push(message);
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(executionResult)
                });

                return processChat(messages, chatId);
            }
            else if (toolCall.function.name.startsWith('tool_')) {
                const toolName = toolCall.function.name.replace('tool_', '');
                const tool = builtinTools.find(t => t.name === toolName);

                let executionResult;
                if (tool) {
                    try {
                        executionResult = await tool.execute(args);
                    } catch (e: any) {
                        logger.error({ error: e.message, toolName, chatId }, 'Error executing built-in tool');
                        executionResult = `Error executing built-in tool: ${e.message}`;
                    }
                } else {
                    executionResult = `Built-in tool ${toolName} not found.`;
                }

                logger.info({ toolName, success: !!tool, chatId }, 'Built-in tool execution completed');

                messages.push(message);
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(executionResult)
                });

                return processChat(messages, chatId);
            }
        }

        return message.content || 'I have nothing more to say.';
    } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, chatId }, 'Error in processChat');
        throw error;
    }
}
