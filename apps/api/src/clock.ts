/** Source of the current time. Injected so expiry and rate-limit windows can be tested deterministically. */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };
