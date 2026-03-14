import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

const options: any = {
    level: process.env.LOG_LEVEL || 'info',
};

if (!isProduction) {
    options.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
        },
    };
}

export const logger = pino(options);

export default logger;
