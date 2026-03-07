import type { BuiltinSkill } from './types.js';

export const weatherSkill: BuiltinSkill = {
    name: 'get_weather',
    description: 'Get the current weather for a specific location',
    parameters: {
        type: 'object',
        properties: {
            location: { type: 'string', description: 'The city and state, e.g., San Francisco, CA' },
        },
        required: ['location'],
    },
    execute: async ({ location }) => {
        // In a production app, you would call a real weather API like OpenWeatherMap here.
        // For now, we return a mock response.
        return `The current weather in ${location} is 72°F and sunny.`;
    },
};
