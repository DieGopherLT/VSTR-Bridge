import * as crypto from 'crypto';

export interface EncryptionResult {
    ciphertext: Buffer;
    salt: Buffer;
    iv: Buffer;
}

export class CryptoManager {
    private readonly algorithm = 'aes-256-cbc';
    private readonly keyLength = 32;
    private readonly ivLength = 16;
    private readonly saltLength = 32;
    private readonly tagLength = 16;
    private readonly key: Buffer;

    constructor(key: Buffer) {
        if (key.length !== this.keyLength) {
            throw new Error(`Key must be ${this.keyLength} bytes long`);
        }
        this.key = key;
    }

    encrypt(plaintext: string): EncryptionResult {
        const salt = crypto.randomBytes(this.saltLength);
        const iv = crypto.randomBytes(this.ivLength);
        
        const derivedKey = crypto.pbkdf2Sync(this.key, salt, 100000, this.keyLength, 'sha256');
        
        const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);
        cipher.setAutoPadding(true);
        
        let ciphertext = cipher.update(plaintext, 'utf8');
        ciphertext = Buffer.concat([ciphertext, cipher.final()]);
        
        return {
            ciphertext,
            salt,
            iv
        };
    }
}