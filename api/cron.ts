import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getWorkingTasks, upsertAgentTask, claimAgentTask } from '../src/services/db.js';
import { runAgentLoop } from '../src/services/ai.js';
import { logger } from '../src/services/logger.js';
import { triggerSelf } from '../src/services/selfTrigger.js';

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
    // Supports:
    //   1. Standard:          Authorization: Bearer <token>
    //   2. cron-jobs.org key: Authorization: Bearer  (key), <token> (value)
    //   3. Custom header:     X-Cron-Secret: <token>
    //   4. Query param:       ?secret=<token>  (useful for debugging)
    const cronSecret = process.env.CRON_SECRET;

    // DEBUG: log all header keys (remove after confirming which key arrives)
    logger.info({ headerKeys: Object.keys(req.headers) }, 'Incoming cron headers');

    if (cronSecret) {
        const standardAuth = req.headers['authorization'];
        const quirkyAuth   = req.headers['authorization: bearer'];
        const simpleSecret = req.headers['x-cron-secret'];
        const querySecret  = typeof req.query?.secret === 'string' ? req.query.secret : undefined;

        let token: string | undefined;
        if (typeof standardAuth === 'string') {
            token = standardAuth.replace(/^Bearer\s+/i, '').trim();
        } else if (typeof quirkyAuth === 'string') {
            token = quirkyAuth.trim();
        } else if (typeof simpleSecret === 'string') {
            token = simpleSecret.trim();
        } else if (querySecret) {
            token = querySecret.trim();
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

        // Atomically claim the task (working → processing).
        // If this returns false, another cron invocation already claimed it — skip.
        const claimed = await claimAgentTask(chatId);
        if (!claimed) {
            logger.info({ chatId }, 'Task already claimed by another invocation — skipping');
            continue;
        }

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

            // If the agent wants to keep going, re-trigger the loop.
            // MUST be awaited so the HTTP request reaches Vercel before this
            // invocation returns (Vercel freezes the process on response,
            // killing any unawaited fetch).
            if (decision.decision === 'CONTINUE') {
                await triggerSelf();
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
