import * as fs from 'fs';
import type { FileSystem } from './types';

export const defaultFileSystem: FileSystem = {
  existsSync: fs.existsSync,
  mkdirSync: (p, opts) => {
    fs.mkdirSync(p, opts);
  },
  writeFileSync: (p, data, opts) => {
    fs.writeFileSync(p, data, opts as fs.WriteFileOptions);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readFileSync: (p, enc) => fs.readFileSync(p, enc as any) as unknown as string,
  statSync: fs.statSync,
  chmodSync: fs.chmodSync,
  readdirSync: (p) => fs.readdirSync(p) as string[],
  unlinkSync: fs.unlinkSync,
  appendFileSync: (p, data, opts) => {
    fs.appendFileSync(p, data, opts as fs.WriteFileOptions);
  },
  renameSync: fs.renameSync,
};
