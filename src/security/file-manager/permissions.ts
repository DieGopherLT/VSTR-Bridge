import * as fs from 'fs';

export const PERMISSION_MASK = 0o777;

export function extractPermissionBits(stats: fs.Stats): number {
  return stats.mode & PERMISSION_MASK;
}
