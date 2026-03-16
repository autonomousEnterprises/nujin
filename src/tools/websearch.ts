import type { BuiltinTool } from './types.js';

export const websearchTool: BuiltinTool = {
    name: 'web_search',
    description: 'Search the web for information using Langsearch API',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The search query to search for' },
        },
        required: ['query'],
    },
    execute: async ({ query }) => {
        const apiKey = process.env.LANGSEARCH_API_KEY;
        
        if (!apiKey) {
            return "Search failed: LANGSEARCH_API_KEY is not configured in environment variables.";
        }

        try {
            const response = await fetch('https://api.langsearch.com/v1/web-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    query,
                    count: 5,
                    summary: true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                return `Search failed with status ${response.status}: ${errorText}`;
            }

            const data = await response.json();
            // Langsearch response format is similar to Bing/Google Search
            // It typically has an array of results in `webPages.value` or similar.
            // Based on the research, it returns results with title, url, snippet, summary.
            
            const results = (data.data || data.results || []).slice(0, 5).map((r: any) => ({
                title: r.title,
                url: r.url,
                snippet: r.summary || r.snippet || r.content
            }));

            if (results.length === 0) {
                return `No results found for "${query}".`;
            }

            return `Search results for "${query}":\n\n` + 
                results.map((r: any) => `**${r.title}**\nURL: ${r.url}\n${r.snippet}`).join('\n\n');
        } catch (e: any) {
            return `Search failed: ${e.message || 'Unknown error'}`;
        }
    },
};
