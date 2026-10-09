import type { FastifyBaseLogger } from 'fastify';

import type { OrderService } from './service.ts';

/**
 * The unpaid-order sweeper (guest-checkout design D5): runs `expireDue` on a timer. Started only by
 * server.ts, never by buildApp, so tests stay deterministic (they call `runOnce`). Logs counts only.
 */
export function createOrderSweeper({
  orders,
  log,
  intervalMs = 30_000,
}: {
  orders: OrderService;
  log: FastifyBaseLogger;
  intervalMs?: number;
}) {
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<number> | undefined;

  async function runOnce(): Promise<number> {
    // One sweep at a time per instance; other instances are kept apart by SKIP LOCKED.
    running ??= orders.expireDue().finally(() => {
      running = undefined;
    });
    return running;
  }

  return {
    runOnce,
    start() {
      if (timer) return;
      timer = setInterval(() => {
        runOnce()
          .then((expired) => {
            if (expired > 0) log.info({ expired }, 'expired unpaid orders');
          })
          .catch((err: unknown) => log.error({ err }, 'order sweep failed'));
      }, intervalMs);
      timer.unref();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      await running;
    },
    get started() {
      return timer !== undefined;
    },
  };
}

export type OrderSweeper = ReturnType<typeof createOrderSweeper>;
