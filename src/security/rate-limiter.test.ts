import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  let currentTime: number;
  let clock: () => number;

  beforeEach(() => {
    currentTime = 1000000;
    clock = () => currentTime;
  });

  it('allows the first request from a new client', () => {
    const rateLimiter = new RateLimiter({}, clock);

    const isAllowed = rateLimiter.checkRateLimit('client-a');

    expect(isAllowed).toBe(true);
  });

  it('allows requests up to the configured limit', () => {
    const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 3 }, clock);

    rateLimiter.checkRateLimit('client-b');
    rateLimiter.checkRateLimit('client-b');
    const thirdResult = rateLimiter.checkRateLimit('client-b');

    expect(thirdResult).toBe(true);
  });

  it('blocks a client after exceeding the rate limit', () => {
    const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 3 }, clock);

    rateLimiter.checkRateLimit('client-c');
    rateLimiter.checkRateLimit('client-c');
    rateLimiter.checkRateLimit('client-c');
    const fourthResult = rateLimiter.checkRateLimit('client-c');

    expect(fourthResult).toBe(false);
  });

  it('unblocks a client after the block duration and window size elapse', () => {
    const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 2, blockDurationMs: 5000, windowSizeMs: 60000 }, clock);

    rateLimiter.checkRateLimit('client-d');
    rateLimiter.checkRateLimit('client-d');
    rateLimiter.checkRateLimit('client-d');

    currentTime += 65001;

    const resultAfterBlock = rateLimiter.checkRateLimit('client-d');

    expect(resultAfterBlock).toBe(true);
  });

  it('allows requests again after manually unblocking a client', () => {
    const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 2 }, clock);

    rateLimiter.checkRateLimit('client-e');
    rateLimiter.checkRateLimit('client-e');
    rateLimiter.checkRateLimit('client-e');

    rateLimiter.unblockClient('client-e');

    const blockedClients = rateLimiter.getBlockedClients();

    expect(blockedClients).not.toContain('client-e');
  });

  it('returns the correct request count for a client', () => {
    const rateLimiter = new RateLimiter({}, clock);

    rateLimiter.checkRateLimit('client-f');
    rateLimiter.checkRateLimit('client-f');

    const count = rateLimiter.getRequestCount('client-f');

    expect(count).toBe(2);
  });

  it('returns zero request count for an unknown client', () => {
    const rateLimiter = new RateLimiter({}, clock);

    const count = rateLimiter.getRequestCount('client-unknown');

    expect(count).toBe(0);
  });

  it('returns the remaining block time for a blocked client', () => {
    const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 1, blockDurationMs: 10000 }, clock);

    rateLimiter.checkRateLimit('client-g');
    rateLimiter.checkRateLimit('client-g');

    const remaining = rateLimiter.getRemainingBlockTime('client-g');

    expect(remaining).toBe(10000);
  });

  it('returns zero remaining block time for a client that is not blocked', () => {
    const rateLimiter = new RateLimiter({}, clock);

    const remaining = rateLimiter.getRemainingBlockTime('client-h');

    expect(remaining).toBe(0);
  });

  it('removes expired request counts and block entries on cleanup', () => {
    const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 2, blockDurationMs: 5000, windowSizeMs: 60000 }, clock);

    rateLimiter.checkRateLimit('client-i');
    rateLimiter.checkRateLimit('client-i');
    rateLimiter.checkRateLimit('client-i');

    currentTime += 65001;

    rateLimiter.cleanup();

    expect(rateLimiter.getRequestCount('client-i')).toBe(0);
    expect(rateLimiter.getBlockedClients()).not.toContain('client-i');
  });
});
