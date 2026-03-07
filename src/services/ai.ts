import OpenAI from 'openai';
import { getSkills, saveSkill } from './db.js';
import { executeSkill } from './skills.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const SYSTEM_PROMPT = `
You are an AI Telegram bot that can write and execute its own skills dynamically. 
You act very much like OpenClaw - a serverless AI agent.
When a user asks you to do something you don't know how to do, you can use the create_skill function to write a Javascript snippet that achieves it. 
This skill will be saved in your database and you can use it in the future.
All skills run in a sandboxed Node.js VM context with access to fetch and console.
When writing a skill, make sure the final result is assigned to the result variable in the global scope (e.g. result = await fetch(...).then(r => r.json());). 
To use an existing skill, you can use the execute_skill function.
`;

export async function processChat(messages: any[], chatId: number): Promise<string> {
    // Load dynamic skills and map them to OpenAI function definitions
    const skills = await getSkills();

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
        }
    ];

    // Expose existing skills as dynamically callable tools
    for (const skill of skills) {
        tools.push({
            type: 'function',
            function: {
                name: `execute_skill_${skill.name}`,
                description: `Executes the ${skill.name} skill: ${skill.description}`,
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

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools,
        tool_choice: 'auto'
    });

    const message = response.choices[0].message;

    if (message.tool_calls) {
        const toolCall = message.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments || '{}');

        if (toolCall.function.name === 'create_skill') {
            const saved = await saveSkill({
                name: args.name,
                description: args.description,
                code: args.code
            });

            const skillResult = saved ? `Successfully saved skill: ${args.name}` : 'Failed to save skill.';

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
            const skill = skills.find(s => s.name === skillName);

            let executionResult;
            if (skill) {
                executionResult = await executeSkill(skill.code, args.args || args);
            } else {
                executionResult = `Skill ${skillName} not found.`;
            }

            messages.push(message);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(executionResult)
            });

            // Return the result of the tool execution back to the model or user
            return processChat(messages, chatId);
        }
    }

    return message.content || 'I have nothing more to say.';
}
