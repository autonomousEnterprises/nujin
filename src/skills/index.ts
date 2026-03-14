import { weatherSkill } from './weather.js';
import { timeSkill } from './time.js';
import { websearchSkill } from './websearch.js';
import { webvisitSkill } from './webvisit.js';
import type { BuiltinSkill } from './types.js';

export const builtinSkills: BuiltinSkill[] = [
    weatherSkill,
    timeSkill,
    // websearchSkill,
    webvisitSkill,
];
