import type { BuiltinTool } from './types.js';
import * as cheerio from 'cheerio';

export const websearchTool: BuiltinTool = {
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
            // Using DuckDuckGo Lite as a free, no-API-key search alternative.
            const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                }
            });

            if (!response.ok) {
                return `Failed to fetch search results. Status: ${response.status} ${response.statusText}`;
            }

            const html = await response.text();
            const $ = cheerio.load(html);
            
            const results: string[] = [];
            
            // DuckDuckGo Lite HTML structure usually has results in .result-body or similar
            // We search for snippets within the results
            $('.result__snippet').each((i, el) => {
                if (i < 5) {
                    const text = $(el).text().trim();
                    if (text) {
                        results.push(`- ${text}`);
                    }
                }
            });

            // Fallback if the above selector fails (DDG sometimes changes classes)
            if (results.length === 0) {
                 $('.web-result').each((i, el) => {
                    if (i < 5) {
                        const snippet = $(el).find('.result__snippet').text().trim() || $(el).text().trim();
                        if (snippet) {
                            results.push(`- ${snippet}`);
                        }
                    }
                });
            }

            if (results.length === 0) {
                // If we still have no results, it might be rate limiting or a major layout change
                if (html.includes('ddg-laptcha')) {
                    return "Search blocked by bot detection (Captcha encountered).";
                }
                return "No results found. The search provider might be rate-limiting or has changed its layout.";
            }

            return `Top search results for "${query}":\n` + results.join('\n');
        } catch (e: any) {
            return `Search failed: ${e.message}`;
        }
    },
};
