import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { getDynamicSkills } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.join(__dirname, '../skills');

export interface SkillSOP {
    name: string;
    description: string;
    content: string;
}

export async function getAvailableSkills(): Promise<SkillSOP[]> {
    try {
        const builtin: SkillSOP[] = [];
        if (fs.existsSync(SKILLS_DIR)) {
            builtin.push(...fs.readdirSync(SKILLS_DIR)
                .filter(file => file.endsWith('.md'))
                .map(file => {
                    const content = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8');
                    const firstLine = content.split('\n')[0] || '';
                    return {
                        name: file.replace('.md', ''),
                        description: firstLine.replace('#', '').trim(),
                        content
                    };
                }));
        }

        const dynamic = await getDynamicSkills();
        const convertedDynamic = dynamic.map(s => ({
            name: s.name,
            description: s.description,
            content: s.content
        }));

        return [...builtin, ...convertedDynamic];
    } catch (error: any) {
        logger.error({ error: error.message }, 'Error loading skills');
        return [];
    }
}

export async function readSkillContent(name: string): Promise<string | null> {
    // Check built-in first
    const filePath = path.join(SKILLS_DIR, `${name}.md`);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }

    // Check dynamic
    const dynamic = await getDynamicSkills();
    const found = dynamic.find(s => s.name === name);
    return found ? found.content : null;
}
