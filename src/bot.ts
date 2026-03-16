import { Bot, GrammyError, HttpError } from 'grammy';
import * as dotenv from 'dotenv';
import { getChatHistory, saveChatMessage } from './services/db.js';
import { processChat, SYSTEM_PROMPT } from './services/ai.js';
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
    // For Vercel, it's often better to let it crash and restart, but we log first
    // process.exit(1); 
});

bot.command('start', (ctx) => {
    ctx.reply("Hi, I am Nujin, the world's first autonomous onchain AI dedicated to your sovereignty.\n\nI'm designed to generate your living while you enjoy yours. I can build my own tools, interact with the blockchain, and proactively pursue your financial goals.\n\nWhat's your financial goal?");
});

bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const userText = ctx.message.text;

    logger.info({ chatId, userText }, 'Received message');

    // Save user's message
    await saveChatMessage({
        chat_id: chatId,
        role: 'user',
        content: userText
    });

    // Load chat history
    const history = await getChatHistory(chatId);
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map((msg: any) => ({
            role: msg.role,
            content: msg.content
        }))
    ];

    try {
        const aiResponse = await processChat(messages, chatId);

        // Indicate typing
        await ctx.replyWithChatAction('typing');

        // Save AI response
        await saveChatMessage({
            chat_id: chatId,
            role: 'assistant',
            content: aiResponse
        });

        await ctx.reply(aiResponse);
    } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack, chatId }, 'Error generating AI response');
        await ctx.reply('Sorry, I encountered an error computing your request.');
    }
});
