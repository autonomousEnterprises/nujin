import type { BuiltinSkill } from './types.js';

export const websearchSkill: BuiltinSkill = {
    name: 'web_search',
    description: 'Search the web for information using a search query',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The search query to search for' },
        },
        required: ['query'],
    },
    execute: async ({ query }) => {
        try {
            // Using DuckDuckGo Lite as a free, no-API-key search alternative for demo purposes.
            // In production, consider using a proper Search API like Google Custom Search, Bing, or SerpApi.
            const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                }
            });

            if (!response.ok) {
                return `Failed to fetch search results. Status: ${response.status}`;
            }

            const html = await response.text();

            // Simple regex extraction since we can't easily use cheerio here without importing it
            // but let's assume we can use cheerio if it's available, however, DDG HTML structure changes.
            // We will extract basic text from the result bodies
            const results: string[] = [];
            const resultRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gi;
            let match;
            let count = 0;

            while ((match = resultRegex.exec(html)) !== null && count < 5) {
                // Strip HTML tags from inner snippet
                const text = (match[1] || '').replace(/<[^>]*>?/gm, '');
                results.push(`- ${text.trim()}`);
                count++;
            }

            if (results.length === 0) {
                return "No results found or rate limited by search provider.";
            }

            return `Top search results for "${query}":\n` + results.join('\n');
        } catch (e: any) {
            return `Search failed: ${e.message}`;
        }
    },
};
