import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Sequelize } from 'sequelize';
import { initializeModels } from './models';

export class DatabaseManager {
    private sequelize: Sequelize | null = null;
    private readonly dbPath: string;

    constructor() {
        this.dbPath = this.getDatabasePath();
        const dbDir = path.dirname(this.dbPath);
    
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 });
        }
    }

    async initialize(): Promise<void> {
        if (this.sequelize) {
            return;
        }

        this.sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: this.dbPath,
            logging: false,
        });

        initializeModels(this.sequelize);

        await this.sequelize.sync();
        
        fs.chmodSync(this.dbPath, 0o600);
        
        console.log('Database initialized:', this.dbPath);
    }

    getDatabasePath(): string {
        const configDir = path.join(os.homedir(), '.config', 'vstr');
        return path.join(configDir, 'messenger.db');
    }


    async getConnection(): Promise<Sequelize> {
        if (!this.sequelize) {
            await this.initialize();
        }
        return this.sequelize!;
    }

    async close(): Promise<void> {
        if (this.sequelize) {
            await this.sequelize.close();
            this.sequelize = null;
        }
    }
}