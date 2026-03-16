import { logger } from './logger.js';

/**
 * Awaited self-trigger for the agent loop.
 *
 * Posts to /api/cron and aborts OUR side of the connection after ~800 ms.
 * By that point the request headers have reached Vercel's edge and a new
 * function invocation has already started — we just don't need to wait for
 * its response.
 *
 * Key reason this must be awaited (not fire-and-forget):
 * Vercel freezes the Node.js process the moment a serverless function sends
 * its HTTP response, so any un-awaited fetch() would be suspended and never
 * actually transmitted.
 *
 * Uses Vercel's auto-injected VERCEL_URL env var — no manual config needed.
 */
export async function triggerSelf(): Promise<void> {
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

    // Abort OUR side of the connection after 800 ms.
    // The request will have already reached Vercel's edge by then, starting a
    // fresh /api/cron invocation. We intentionally ignore AbortError.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Vercel strips the Authorization header on internal requests;
                // use the custom X-Cron-Secret header which passes through cleanly.
                'X-Cron-Secret': secret
            },
            body: '{}',
            signal: controller.signal
        });
        logger.info('triggerSelf: response received (faster than abort)');
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            // Expected — we cancelled our side; Vercel's new invocation is running
            logger.info('triggerSelf: aborted after sending (expected)');
        } else {
            logger.error({ err: err.message }, 'triggerSelf: unexpected fetch error');
        }
    } finally {
        clearTimeout(timer);
    }
}
