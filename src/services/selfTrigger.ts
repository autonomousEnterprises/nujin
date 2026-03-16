import { logger } from './logger.js';

/**
 * Fire-and-forget self-trigger for the agent loop.
 *
 * Posts to /api/cron WITHOUT awaiting the response so the current
 * Vercel invocation can return immediately (staying within the 10 s
 * hobby-plan limit) while a fresh invocation picks up the next step.
 *
 * Uses Vercel's auto-injected VERCEL_URL env var to resolve the host.
 * In local dev, set VERCEL_URL=localhost:3000 or similar.
 */
export function triggerSelf(): void {
    const vercelUrl = process.env.VERCEL_URL;
    if (!vercelUrl) {
        logger.warn('triggerSelf: VERCEL_URL not set — cannot self-trigger');
        return;
    }

    // VERCEL_URL is the bare hostname (no protocol)
    const base = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
    const secret = process.env.CRON_SECRET ?? '';
    const url = `${base}/api/cron`;

    logger.info({ url }, 'triggerSelf: firing next agent loop iteration');

    // Intentionally NOT awaited — fire and forget
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`
        },
        body: '{}'
    }).catch((err: Error) => {
        logger.error({ err: err.message }, 'triggerSelf: fetch error');
    });
}
