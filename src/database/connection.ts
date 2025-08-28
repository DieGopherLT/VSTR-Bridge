import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';

export class DatabaseManager {
    private db: Database.Database | null = null;
    private readonly dbPath: string;

    constructor() {
        this.dbPath = this.getDatabasePath();
        const dbDir = path.dirname(this.dbPath);
    
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 });
        }
    
        fs.chmodSync(this.dbPath, 0o600);
        const db = new Database(this.dbPath, { fileMustExist: true });
        this.db = db;
    
        console.log('Database name: ', db.name);
    }

    getDatabasePath(): string {
        const configDir = path.join(os.homedir(), '.config', 'vstr');
        return path.join(configDir, 'messenger.db');
    }


    getConnection(): Database.Database {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        return this.db;
    }

    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}