import type { VercelRequest, VercelResponse } from '@vercel/node';
import { webhookCallback } from 'grammy';
import { bot } from '../src/bot.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log('Webhook received request:', req.method);
    
    // Allow a simple GET request to check if the endpoint is up
    if (req.method === 'GET') {
        return res.status(200).json({ 
            status: 'ok', 
            message: 'Webhook endpoint is active and reachable.',
            timestamp: new Date().toISOString()
        });
    }

    try {
        // Vercel Node.js functions sometimes don't have the 'header' function expected by the 'express' adapter.
        // We'll use the 'std/http' style or a manual check to ensure compatibility.
        // Grammy's 'express' adapter calls req.header(), but Vercel's req only has req.headers.
        
        const handleUpdate = webhookCallback(bot, 'express');
        
        // Mock the header function if it's missing to satisfy the grammy 'express' adapter
        if (typeof (req as any).header !== 'function') {
            (req as any).header = (name: string) => req.headers[name.toLowerCase()];
        }

        return await handleUpdate(req as any, res as any);
    } catch (error: any) {
        console.error('Error in webhook handler:', error);
        return res.status(500).json({ error: error.message });
    }
}
