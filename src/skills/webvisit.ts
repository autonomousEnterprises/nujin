import type { BuiltinSkill } from './types.js';
import * as cheerio from 'cheerio';

export const webvisitSkill: BuiltinSkill = {
    name: 'web_visit',
    description: 'Visit a website URL and extract its main text content',
    parameters: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The full URL to visit (e.g., https://example.com)' },
        },
        required: ['url'],
    },
    execute: async ({ url }) => {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-Agent/1.0',
                }
            });

            if (!response.ok) {
                return `Failed to load page. Status: ${response.status} ${response.statusText}`;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Remove script, style, and navigation tags to clean up the content
            $('script, style, noscript, nav, header, footer').remove();

            // Extract text and compress multiple spaces/newlines
            const text = $('body').text().replace(/\s+/g, ' ').trim();

            // Truncate text if it's too long to avoid token limits (approx 8000 chars)
            const maxLength = 8000;
            if (text.length > maxLength) {
                return text.substring(0, maxLength) + '... [TRUNCATED]';
            }

            return text || 'No visible text content found on the page.';
        } catch (e: any) {
            return `Failed to visit website: ${e.message}`;
        }
    },
};
