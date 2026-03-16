import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getWorkingTasks, upsertAgentTask } from '../src/services/db.js';
import { runAgentLoop } from '../src/services/ai.js';
import { logger } from '../src/services/logger.js';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
    try {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text })
        });
    } catch (err: any) {
        logger.error({ err: err.message, chatId }, 'Failed to send Telegram message from cron');
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    // Protect the endpoint with a shared secret.
    // Supports three formats:
    //   1. Standard:     Authorization: Bearer <token>
    //   2. cron-jobs.org quirk: key="Authorization: Bearer", value=<token>
    //   3. Simple header: X-Cron-Secret: <token>
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const standardAuth = req.headers['authorization'];
        const quirkyAuth   = req.headers['authorization: bearer']; // cron-jobs.org sends this
        const simpleSecret = req.headers['x-cron-secret'];

        let token: string | undefined;
        if (typeof standardAuth === 'string') {
            token = standardAuth.replace(/^Bearer\s+/i, '').trim();
        } else if (typeof quirkyAuth === 'string') {
            token = quirkyAuth.trim();
        } else if (typeof simpleSecret === 'string') {
            token = simpleSecret.trim();
        }

        if (token !== cronSecret) {
            logger.warn({ token: token ? '[redacted]' : 'missing' }, 'Unauthorized cron request');
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } else {
        logger.warn('CRON_SECRET is not set — cron endpoint is unprotected!');
    }

    logger.info('Cron heartbeat triggered');

    // Fetch all tasks currently in the 'working' state
    const workingTasks = await getWorkingTasks();
    logger.info({ count: workingTasks.length }, 'Found working tasks');

    const results: Array<{ chatId: number; decision: string; status: string }> = [];

    for (const task of workingTasks) {
        const chatId = task.chat_id;
        logger.info({ chatId, goal: task.goal }, 'Processing working task');

        try {
            const decision = await runAgentLoop(chatId, task);

            const newStatus =
                decision.decision === 'CONTINUE' ? 'working'
                    : decision.decision === 'WAIT_FOR_USER' ? 'awaiting_user'
                        : 'idle'; // FINISH

            // Persist updated state
            await upsertAgentTask({
                chat_id: chatId,
                status: newStatus,
                goal: task.goal ?? null,
                task_history: task.task_history
            });

            // Always notify the user via Telegram
            if (decision.message_to_telegram) {
                await sendTelegramMessage(chatId, decision.message_to_telegram);
            }

            results.push({ chatId, decision: decision.decision, status: newStatus });
        } catch (err: any) {
            logger.error({ err: err.message, chatId }, 'Error processing task in cron');
            // Mark as awaiting_user so it doesn't loop endlessly on errors
            await upsertAgentTask({ chat_id: chatId, status: 'awaiting_user', task_history: task.task_history });
            await sendTelegramMessage(chatId, '⚠️ An error occurred in my background loop. I\'ll need your input to continue.');
            results.push({ chatId, decision: 'ERROR', status: 'awaiting_user' });
        }
    }

    return res.status(200).json({
        status: 'ok',
        processed: results.length,
        results
    });
}
