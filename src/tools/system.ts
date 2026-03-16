import type { BuiltinTool } from './types.js';
import { saveDynamicTool, saveDynamicSkill } from '../services/db.js';
import { readSkillContent } from '../services/skills.js';

export const createTool: BuiltinTool = {
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
    },
    execute: async (args: { name: string; description: string; code: string }) => {
        const saved = await saveDynamicTool(args);
        return saved ? `Saved tool: ${args.name}` : `Failed to save tool: ${args.name}.`;
    }
};

export const createSkill: BuiltinTool = {
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
    },
    execute: async (args: { name: string; description: string; content: string }) => {
        const saved = await saveDynamicSkill(args);
        return saved ? `Saved skill: ${args.name}` : `Failed to save skill: ${args.name}.`;
    }
};

export const readSkill: BuiltinTool = {
    name: 'read_skill',
    description: 'Reads a Skill SOP (Standard Operating Procedure).',
    parameters: {
        type: 'object',
        properties: {
            name: { 
                type: 'string', 
                description: 'The name of the skill to read'
            }
        },
        required: ['name']
    },
    execute: async (args: { name: string }) => {
        const result = await readSkillContent(args.name);
        return result || `Skill not found: ${args.name}.`;
    }
};
