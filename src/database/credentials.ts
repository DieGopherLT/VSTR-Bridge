import { DatabaseManager } from './connection';
import { CryptoManager, EncryptionResult } from '../cipher/crypto';
import { Credential } from './models';
import * as crypto from 'crypto';
import { Op } from 'sequelize';

export class CredentialsPublisher {
    private refillTimeouts = new Map<number, NodeJS.Timeout>();

    constructor(
        private databaseManager: DatabaseManager,
        private cryptoManager: CryptoManager
    ) {}

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
        const currentTimestamp = Math.floor(Date.now() / 1000);
        
        return await Credential.count({
            where: {
                instance_id: instanceId,
                expires_at: {
                    [Op.gt]: currentTimestamp
                }
            }
        });
    }

    private async storeEncryptedCredential(instanceId: number, encrypted: EncryptionResult, ttlSeconds: number): Promise<void> {
        const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
        
        await Credential.create({
            instance_id: instanceId,
            ciphertext: encrypted.ciphertext,
            salt: encrypted.salt,
            iv: encrypted.iv,
            expires_at: expiresAt
        });
    }

    private generateUniqueToken(): string {
        return crypto.randomUUID();
    }

    async getAvailableCredential(instanceId: number): Promise<{ ciphertext: Buffer; salt: Buffer; iv: Buffer } | null> {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        
        const credential = await Credential.findOne({
            where: {
                instance_id: instanceId,
                expires_at: {
                    [Op.gt]: currentTimestamp
                }
            },
            limit: 1
        });
        
        if (credential) {
            const result = {
                ciphertext: credential.ciphertext,
                salt: credential.salt,
                iv: credential.iv
            };
            
            await credential.destroy();
            
            return result;
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