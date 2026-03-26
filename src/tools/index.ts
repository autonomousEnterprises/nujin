import { timeTool } from './time.js';
import { websearchTool } from './websearch.js';
import { webvisitTool } from './webvisit.js';
import { web3Tool } from './web3/index.js';
import { createTool, createSkill, readSkill } from './system.js';
import { manageTaskTool } from './task_management.js';
import { storeMemoryTool, searchMemoryTool } from './memory.js';
import type { BuiltinTool } from './types.js';

export const builtinTools: BuiltinTool[] = [
    timeTool,
    websearchTool,
    webvisitTool,
    web3Tool,
    createTool,
    createSkill,
    readSkill,
    manageTaskTool,
    storeMemoryTool,
    searchMemoryTool
];
