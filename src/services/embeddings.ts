import OpenAI from 'openai';
import { logger } from './logger.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float",
        });
        return response.data[0]?.embedding || null;
    } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to generate embedding');
        return null;
    }
}
