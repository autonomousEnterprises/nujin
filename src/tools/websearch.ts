import type { BuiltinTool } from './types.js';
import { logger } from '../services/logger.js';

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
            logger.warn('web_search: LANGSEARCH_API_KEY is missing');
            return "Search failed: LANGSEARCH_API_KEY is not configured in environment variables.";
        }

        try {
            logger.info({ query }, 'web_search: Calling Langsearch API');
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
                logger.error({ status: response.status, errorText }, 'web_search: API call failed');
                return `Search failed with status ${response.status}: ${errorText}`;
            }

            const data = await response.json();
            logger.info({ data }, 'web_search: API response received');
            
            // Langsearch response format is compatible with Bing Search API
            // Results are in data.webPages.value
            const resultsValue = data.webPages?.value || data.data || data.results || [];
            
            const results = (resultsValue as any[]).slice(0, 5).map((r: any) => ({
                title: r.name || r.title,
                url: r.url,
                snippet: r.summary || r.snippet || r.content
            }));

            if (results.length === 0) {
                logger.info({ query }, 'web_search: No results found');
                return `No results found for "${query}".`;
            }

            return `Search results for "${query}":\n\n` + 
                results.map((r: any) => `**${r.title}**\nURL: ${r.url}\n${r.snippet}`).join('\n\n');
        } catch (e: any) {
            logger.error({ error: e.message }, 'web_search: Unexpected error');
            return `Search failed: ${e.message || 'Unknown error'}`;
        }
    },
};
