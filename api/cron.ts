import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getWorkingTasks, upsertAgentTask, claimAgentTask, saveChatMessage } from '../src/services/db.js';
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
    const cronSecret = process.env.CRON_SECRET;

    // 1. Robust Authentication Logic
    if (cronSecret) {
        const authHeader = req.headers['authorization'];

        // This regex handles:
        // "Bearer token"
        // "Bearer: token" (common with cron-job.org)
        // It's case-insensitive and trims whitespace.
        const token = typeof authHeader === 'string'
            ? authHeader.replace(/^Bearer:?\s+/i, '').trim()
            : null;

        if (!token || token !== cronSecret) {
            logger.warn({
                received: token ? '[redacted]' : 'missing',
                headerProvided: !!authHeader
            }, 'Unauthorized cron request');
            return res.status(401).json({ error: 'Unauthorized' });
        }
    } else {
        logger.warn('CRON_SECRET is not set — endpoint is unprotected!');
    }

    logger.info('Cron heartbeat triggered');

    try {
        // 2. Fetch all tasks currently in the 'working' state
        const workingTasks = await getWorkingTasks();
        logger.info({ count: workingTasks.length }, 'Found working tasks');

        const results: Array<{ chatId: number; decision: string; status: string }> = [];

        for (const task of workingTasks) {
            const chatId = task.chat_id;

            // Atomically claim the task (working → processing).
            const claimed = await claimAgentTask(chatId);
            if (!claimed) {
                logger.info({ chatId }, 'Task already claimed or busy — skipping');
                continue;
            }

            try {
                const decision = await runAgentLoop(chatId, task);

                const newStatus =
                    decision.decision === 'CONTINUE' ? 'working'
                        : decision.decision === 'WAIT_FOR_USER' ? 'awaiting_user'
                            : 'idle';

                // Persist updated state
                await upsertAgentTask({
                    chat_id: chatId,
                    status: newStatus,
                    goal: task.goal ?? null,
                    task_history: task.task_history
                });

                // Notify user via Telegram
                if (decision.message_to_telegram) {
                    await sendTelegramMessage(chatId, decision.message_to_telegram);
                    await saveChatMessage({
                        chat_id: chatId,
                        role: 'assistant',
                        content: decision.message_to_telegram
                    });
                }

                results.push({ chatId, decision: decision.decision, status: newStatus });
            } catch (err: any) {
                logger.error({ err: err.message, chatId }, 'Error processing task in cron');
                // Recovery: mark as awaiting_user so it doesn't loop endlessly on errors
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

    } catch (globalErr: any) {
        logger.error({ err: globalErr.message }, 'Fatal error in cron handler');
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}