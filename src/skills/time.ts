import type { BuiltinSkill } from './types.js';

export const timeSkill: BuiltinSkill = {
    name: 'get_time',
    description: 'Get the current server time',
    parameters: {
        type: 'object',
        properties: {},
    },
    execute: () => {
        return `The current server time is ${new Date().toISOString()}`;
    },
};
