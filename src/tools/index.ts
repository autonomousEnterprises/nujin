import { timeTool } from './time.js';
import { websearchTool } from './websearch.js';
import { webvisitTool } from './webvisit.js';
import { web3Tool } from './web3/index.js';
import type { BuiltinTool } from './types.js';

export const builtinTools: BuiltinTool[] = [
    timeTool,
    websearchTool,
    webvisitTool,
    web3Tool,
];
