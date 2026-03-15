import { timeTool } from './time.js';
import { websearchTool } from './websearch.js';
import { webvisitTool } from './webvisit.js';
import type { BuiltinTool } from './types.js';

export const builtinTools: BuiltinTool[] = [
    timeTool,
    websearchTool,
    webvisitTool,
];
