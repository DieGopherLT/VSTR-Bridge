import * as crypto from 'crypto';
import * as os from 'os';
import * as process from 'process';

export function deriveSystemKey(): Buffer {
    const systemData = [
        process.env.USER || process.env.USERNAME,
        os.homedir(),
        process.getuid?.() || '0',
        os.platform()
    ].join(':');
    
    const salt = crypto.createHash('sha256')
        .update('vstr-messenger-salt-v1')
        .digest();
    
    return crypto.pbkdf2Sync(systemData, salt, 10000, 32, 'sha256');
}