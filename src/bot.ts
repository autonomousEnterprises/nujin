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

            // Run one iteration of the agent loop
            const decision = await runAgentLoop(chatId, task);

            // Update task status and persist results
            const newStatus =
                decision.decision === 'CONTINUE' ? 'working'
                    : decision.decision === 'WAIT_FOR_USER' ? 'awaiting_user'
                        : 'idle'; // FINISH

            await upsertAgentTask({
                chat_id: chatId,
                status: newStatus,
                goal: newStatus === 'idle' ? null : (task.goal ?? null),
                task_history: newStatus === 'idle' ? [] : task.task_history
            });

            // Deliver response
            await ctx.reply(decision.message_to_telegram);
            if (decision.message_to_telegram) {
                await saveChatMessage({
                    chat_id: chatId,
                    role: 'assistant',
                    content: decision.message_to_telegram
                });
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
