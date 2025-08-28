import { DatabaseManager } from './connection';
import { CryptoManager, EncryptionResult } from '../cipher/crypto';
import Database from 'better-sqlite3';
import * as crypto from 'crypto';

export class CredentialsPublisher {
    private db: Database.Database;
    private refillTimeouts = new Map<number, NodeJS.Timeout>();

    constructor(
        private databaseManager: DatabaseManager,
        private cryptoManager: CryptoManager
    ) {
        this.db = databaseManager.getConnection();
    }

    async initializeCredentialPool(instanceId: number, poolSize: number): Promise<void> {
        for (let i = 0; i < poolSize; i++) {
            const token = this.generateUniqueToken();
            const encrypted = this.cryptoManager.encrypt(token);
            await this.storeEncryptedCredential(instanceId, encrypted, 300);
        }
    }

    scheduleCredentialRefill(instanceId: number, delaySeconds: number): void {
        if (this.refillTimeouts.has(instanceId)) {
            clearTimeout(this.refillTimeouts.get(instanceId)!);
        }
        
        const timeout = setTimeout(async () => {
            const currentCount = await this.getCredentialCount(instanceId);
            const tokensToAdd = 3 - currentCount;
            
            for (let i = 0; i < tokensToAdd; i++) {
                const token = this.generateUniqueToken();
                const encrypted = this.cryptoManager.encrypt(token);
                await this.storeEncryptedCredential(instanceId, encrypted, 300);
            }
            
            this.refillTimeouts.delete(instanceId);
        }, delaySeconds * 1000);
        
        this.refillTimeouts.set(instanceId, timeout);
    }

    async getCredentialCount(instanceId: number): Promise<number> {
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM credentials 
            WHERE instance_id = ? AND expires_at > strftime('%s', 'now')
        `);
        
        const result = stmt.get(instanceId) as { count: number };
        return result.count;
    }

    private async storeEncryptedCredential(instanceId: number, encrypted: EncryptionResult, ttlSeconds: number): Promise<void> {
        const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
        
        const stmt = this.db.prepare(`
            INSERT INTO credentials (instance_id, ciphertext, salt, iv, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        stmt.run(instanceId, encrypted.ciphertext, encrypted.salt, encrypted.iv, expiresAt);
    }

    private generateUniqueToken(): string {
        return crypto.randomUUID();
    }

    async getAvailableCredential(instanceId: number): Promise<{ ciphertext: Buffer; salt: Buffer; iv: Buffer } | null> {
        const stmt = this.db.prepare(`
            SELECT id, ciphertext, salt, iv 
            FROM credentials 
            WHERE instance_id = ? AND expires_at > strftime('%s', 'now')
            LIMIT 1
        `);
        
        const credential = stmt.get(instanceId) as { id: number; ciphertext: Buffer; salt: Buffer; iv: Buffer } | undefined;
        
        if (credential) {
            const deleteStmt = this.db.prepare('DELETE FROM credentials WHERE id = ?');
            deleteStmt.run(credential.id);
            
            return {
                ciphertext: credential.ciphertext,
                salt: credential.salt,
                iv: credential.iv
            };
        }
        
        return null;
    }

    cleanup(): void {
        for (const timeout of this.refillTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.refillTimeouts.clear();
    }
}