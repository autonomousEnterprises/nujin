import type { BuiltinTool } from './types.js';

const SEARXNG_INSTANCES = [
    'https://searx.be',
    'https://baresearch.org',
    'https://search.mdl2.com'
];

export const websearchTool: BuiltinTool = {
    name: 'web_search',
    description: 'Search the web for information using a search query cross multiple search engines',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The search query to search for' },
        },
        required: ['query'],
    },
    execute: async ({ query }) => {
        let lastError;
        
        for (const instance of SEARXNG_INSTANCES) {
            try {
                const url = new URL(`${instance}/search`);
                url.searchParams.set('q', query);
                url.searchParams.set('format', 'json');
                url.searchParams.set('engines', 'google,bing,duckduckgo');

                const response = await fetch(url.toString(), {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NujinBot/1.0' }
                });

                if (!response.ok) continue;

                const data = await response.json();
                const results = (data.results || []).slice(0, 5).map((r: any) => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.content || r.snippet
                }));

                if (results.length === 0) continue;

                return `Search results for "${query}":\n\n` + 
                    results.map((r: any) => `**${r.title}**\nURL: ${r.url}\n${r.snippet}`).join('\n\n');
            } catch (e: any) {
                lastError = e;
                continue;
            }
        }
        return `Search failed. All instances failed. Last error: ${lastError?.message || 'Unknown error'}`;
    },
};
