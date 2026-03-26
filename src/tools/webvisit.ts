import type { BuiltinTool } from './types.js';
import * as cheerio from 'cheerio';

export const webvisitTool: BuiltinTool = {
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

            // Remove non-content tags
            $('script, style, noscript').remove();

            // Convert links to Markdown-style [text](url) before extracting text
            $('a').each((_i, el) => {
                const $el = $(el);
                const href = $el.attr('href');
                const text = $el.text().replace(/\s+/g, ' ').trim();
                if (href && text) {
                    // Handle relative URLs
                    try {
                        const absoluteUrl = new URL(href, url).href;
                        $el.replaceWith(` [${text}](${absoluteUrl}) `);
                    } catch {
                        $el.replaceWith(` [${text}](${href}) `);
                    }
                }
            });

            // Extract text and compress multiple spaces/newlines
            const text = $('body').text().replace(/\s+/g, ' ').trim();

            // Truncate text if it's too long to avoid token limits (approx 12000 chars now)
            const maxLength = 12000;
            if (text.length > maxLength) {
                return text.substring(0, maxLength) + '... [TRUNCATED]';
            }

            return text || 'No visible content found on the page.';
        } catch (e: any) {
            return `Failed to visit website: ${e.message}`;
        }
    },
};
