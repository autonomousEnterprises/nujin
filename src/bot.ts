import { Bot, GrammyError, HttpError } from 'grammy';
import * as dotenv from 'dotenv';
import { getAgentTask, upsertAgentTask, saveChatMessage } from './services/db.js';
import { runAgentLoop, SYSTEM_PROMPT } from './services/ai.js';
import { logger } from './services/logger.js';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing. Please set it in your environment variables.');
}

export const bot = new Bot(token);

// Global error handler for the bot
bot.catch((err) => {
    const ctx = err.ctx;
    logger.error({
        err: err.error,
        update_id: ctx.update.update_id,
        chat_id: ctx.chat?.id
    }, `Error while handling update ${ctx.update.update_id}:`);

    const e = err.error;
    if (e instanceof GrammyError) {
        logger.error({ description: e.description }, 'Error in request:');
    } else if (e instanceof HttpError) {
        logger.error({ error: e }, 'Could not contact Telegram:');
    } else {
        logger.error({ error: e }, 'Unknown error:');
    }
});

// Global process error handlers
process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (error) => {
    logger.error({ error: error.message, stack: error.stack }, 'Uncaught Exception thrown');
});

bot.command('start', (ctx) => {
    ctx.reply("Hi, I am Nujin, the world's first autonomous onchain AI dedicated to your sovereignty.\n\nI'm designed to generate your living while you enjoy yours. I can build my own tools, interact with the blockchain, and proactively pursue your financial goals.\n\nWhat's your financial goal?");
});

bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const userText = ctx.message.text;

    logger.info({ chatId, userText }, 'Received message');

    // Show typing indicator immediately
    await ctx.replyWithChatAction('typing');

    // Save the user's message to chat history
    await saveChatMessage({
        chat_id: chatId,
        role: 'user',
        content: userText
    });

    try {
        // Load the agent task for this chat
        let task = await getAgentTask(chatId);

        // Determine if there is an active autonomous process
        const isActive = task && (task.status === 'working' || task.status === 'awaiting_user');

        if (isActive) {
            // mode: AUTONOMOUS (resuming/responding to an active task)
            task.task_history.push({
                thought: `User replied: ${userText}`
            });
            task.status = 'working';
            
            // Persist state before running the loop
            await upsertAgentTask({
                chat_id: chatId,
                status: 'working',
                goal: task.goal ?? null,
                task_history: task.task_history
            });

            const isLocal = process.env.VERCEL !== '1';
            let currentStatus: 'working' | 'idle' | 'awaiting_user' | 'processing' = 'working';
            let currentTask = task;

            while (currentStatus === 'working') {
                // Run one iteration of the agent loop
                const decision = await runAgentLoop(chatId, currentTask);

                // Update task status and persist results
                currentStatus =
                    decision.decision === 'CONTINUE' ? 'working'
                        : decision.decision === 'WAIT_FOR_USER' ? 'awaiting_user'
                            : 'idle'; // FINISH

                await upsertAgentTask({
                    chat_id: chatId,
                    status: currentStatus,
                    goal: currentStatus === 'idle' ? null : (currentTask.goal ?? null),
                    task_history: currentStatus === 'idle' ? [] : currentTask.task_history
                });

                // Deliver response
                if (decision.message_to_telegram) {
                    await ctx.reply(decision.message_to_telegram);
                    await saveChatMessage({
                        chat_id: chatId,
                        role: 'assistant',
                        content: decision.message_to_telegram
                    });
                }

                if (!isLocal) {
                    // In Vercel, break the loop and let cron handle further steps to avoid webhook timeout
                    break;
                }
            }
        } else {
            // mode: CHAT (standard conversational mode)
            // The loop will handle any immediate tool calls internally and return a final synthesis
            const decision = await runAgentLoop(chatId, undefined);

            // Deliver response
            await ctx.reply(decision.message_to_telegram);
            if (decision.message_to_telegram) {
                await saveChatMessage({
                    chat_id: chatId,
                    role: 'assistant',
                    content: decision.message_to_telegram
                });
            }
        }

    } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, chatId }, 'Error in agent loop');
        await ctx.reply('Sorry, I encountered an error in my reasoning loop. Please try again.');
    }
});

// Re-export system prompt for legacy compatibility
export { SYSTEM_PROMPT };

// If not running on Vercel, start long-polling and process any working tasks
if (process.env.VERCEL !== '1') {
    bot.start({
        onStart: (botInfo) => {
            logger.info(`Bot @${botInfo.username} started in local long-polling mode.`);
        }
    });

    // On startup, check for any 'working' tasks and resume loop for them immediately
    import('./services/db.js').then(async ({ getWorkingTasks }) => {
        try {
            const workingTasks = await getWorkingTasks();
            for (const task of workingTasks) {
                const chatId = task.chat_id;
                let currentStatus: 'working' | 'idle' | 'awaiting_user' | 'processing' = task.status;
                let currentTask = task;
                
                while (currentStatus === 'working') {
                    const decision = await runAgentLoop(chatId, currentTask);
                    currentStatus =
                        decision.decision === 'CONTINUE' ? 'working'
                            : decision.decision === 'WAIT_FOR_USER' ? 'awaiting_user'
                                : 'idle';

                    await upsertAgentTask({
                        chat_id: chatId,
                        status: currentStatus,
                        goal: currentStatus === 'idle' ? null : (currentTask.goal ?? null),
                        task_history: currentStatus === 'idle' ? [] : currentTask.task_history
                    });

                    if (decision.message_to_telegram) {
                        await bot.api.sendMessage(chatId, decision.message_to_telegram);
                        await saveChatMessage({
                            chat_id: chatId,
                            role: 'assistant',
                            content: decision.message_to_telegram
                        });
                    }
                }
            }
        } catch (err) {
            logger.error({ err }, 'Error checking working tasks on startup');
        }
    });
}
