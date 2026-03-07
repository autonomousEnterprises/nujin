import type { VercelRequest, VercelResponse } from '@vercel/node';
import { webhookCallback } from 'grammy';
import { bot } from '../src/bot.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Use 'express' style adapter for Vercel Node.js Serverless Functions
    const handleUpdate = webhookCallback(bot, 'express');
    return handleUpdate(req as any, res as any);
}
