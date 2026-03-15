import { weatherSkill as weatherTool } from './weather.js';
import { timeSkill as timeTool } from './time.js';
import { websearchSkill as websearchTool } from './websearch.js';
import { webvisitSkill as webvisitTool } from './webvisit.js';
import type { Tool } from './types.js';

export const builtinTools: Tool[] = [
    timeTool,
    websearchTool,
    webvisitTool,
];
