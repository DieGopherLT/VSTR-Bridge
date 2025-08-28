import { DatabaseManager } from './connection';
import Database from 'better-sqlite3';

export class InstancePublisher {
    private db: Database.Database;

    constructor(private databaseManager: DatabaseManager) {
        this.db = databaseManager.getConnection();
    }

    async registerInstance(port: number, workspacePath: string, workspaceName: string): Promise<number> {
        const stmt = this.db.prepare(`
            INSERT INTO instances (port, workspace_path, workspace_name)
            VALUES (?, ?, ?)
        `);
        
        try {
            const result = stmt.run(port, workspacePath, workspaceName);
            return result.lastInsertRowid as number;
        } catch (error) {
            if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
                const existingStmt = this.db.prepare('SELECT id FROM instances WHERE port = ?');
                const existing = existingStmt.get(port) as { id: number } | undefined;
                
                if (existing) {
                    return existing.id;
                }
            }
            throw error;
        }
    }

    async cleanupInstance(instanceId: number): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM instances WHERE id = ?');
        stmt.run(instanceId);
    }

    async getInstance(instanceId: number): Promise<{ id: number; port: number; workspace_path: string; workspace_name: string } | null> {
        const stmt = this.db.prepare('SELECT * FROM instances WHERE id = ?');
        return stmt.get(instanceId) as any || null;
    }

    async getInstanceByPort(port: number): Promise<{ id: number; port: number; workspace_path: string; workspace_name: string } | null> {
        const stmt = this.db.prepare('SELECT * FROM instances WHERE port = ?');
        return stmt.get(port) as any || null;
    }
}