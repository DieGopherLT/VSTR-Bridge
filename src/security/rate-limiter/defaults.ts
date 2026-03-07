import { RateLimitConfig } from '../types';

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 30,
  windowSizeMs: 60000,
  blockDurationMs: 300000,
};
