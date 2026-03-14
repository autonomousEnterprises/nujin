import { Bot } from 'grammy';
import * as dotenv from 'dotenv';
import { getChatHistory, saveChatMessage } from './services/db.js';
import { processChat, SYSTEM_PROMPT } from './services/ai.js';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing. Please set it in your environment variables.');
}

export const bot = new Bot(token);

bot.command('start', (ctx) => {
    ctx.reply('Hello! I am an AI Telegram bot. I act like an autonomous agent capable of writing and executing my own Javascript skills dynamically. Ask me anything, or ask me to build a skill for you!');
});

bot.on('message:text', async (ctx) => {
    const chatId = ctx.chat.id;
    const userText = ctx.message.text;

    // Save user's message
    await saveChatMessage({
        chat_id: chatId,
        role: 'user',
        content: userText
    });

    // Indicate typing
    await ctx.replyWithChatAction('typing');

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

        // Save AI response
        await saveChatMessage({
            chat_id: chatId,
            role: 'assistant',
            content: aiResponse
        });

        await ctx.reply(aiResponse);
    } catch (error: any) {
        console.error('Error generating AI response:', error);
        await ctx.reply('Sorry, I encountered an error computing your request.');
    }
});
