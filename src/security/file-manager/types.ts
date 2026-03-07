import * as fs from 'fs';

export interface SecureBridgeInfo {
  port: number;
  pid: number;
  instance_id: number;
  workspace_path: string;
  workspace_name: string;
  timestamp: string;
  auth_token: string;
  secure: boolean;
}

export interface FileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): void;
  writeFileSync(path: string, data: string, options?: { mode?: number }): void;
  readFileSync(path: string, encoding: string): string;
  statSync(path: string): fs.Stats;
  chmodSync(path: string, mode: number): void;
  readdirSync(path: string): string[];
  unlinkSync(path: string): void;
  appendFileSync(path: string, data: string, options?: { mode?: number }): void;
  renameSync(oldPath: string, newPath: string): void;
}
