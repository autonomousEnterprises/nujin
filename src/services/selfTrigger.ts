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
 * URL resolution order (first non-empty wins):
 *   1. APP_URL env var  — stable production alias, e.g. https://nujin.vercel.app
 *   2. VERCEL_URL       — auto-injected deployment URL (bare hostname, no https://)
 */
export async function triggerSelf(): Promise<void> {
    // Prefer a stable production alias if one is configured
    const appUrl = process.env.APP_URL;
    const vercelUrl = process.env.VERCEL_URL;

    let base: string | undefined;
    if (appUrl) {
        base = appUrl; // already includes https://
    } else if (vercelUrl) {
        base = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
    }

    if (!base) {
        logger.warn('triggerSelf: neither APP_URL nor VERCEL_URL is set — cannot self-trigger');
        return;
    }

    const secret = process.env.CRON_SECRET ?? '';
    const url = `${base}/api/cron`;

    logger.info({ url }, 'triggerSelf: firing next agent loop iteration');

    // Abort OUR side of the connection after 800 ms.
    // The request will have already reached Vercel's edge by then, starting a
    // fresh /api/cron invocation. We intentionally ignore AbortError.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);

    try {
        const res = await fetch(url, {
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

        // Log status so we can diagnose auth failures or empty-task responses
        if (res.ok) {
            let body: any = {};
            try { body = await res.json(); } catch {}
            logger.info({ status: res.status, body }, 'triggerSelf: cron responded OK');
        } else {
            let text = '';
            try { text = await res.text(); } catch {}
            logger.warn({ status: res.status, body: text }, 'triggerSelf: cron responded with error');
        }
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
