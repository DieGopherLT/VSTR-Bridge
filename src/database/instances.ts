import { DatabaseManager } from './connection';
import { Instance } from './models';

export class InstancePublisher {
    constructor(private databaseManager: DatabaseManager) {}

    async registerInstance(port: number, workspacePath: string, workspaceName: string): Promise<number> {
        try {
            const [instance, created] = await Instance.findOrCreate({
                where: { port },
                defaults: {
                    port,
                    workspace_path: workspacePath,
                    workspace_name: workspaceName,
                },
            });
            
            return instance.id;
        } catch (error) {
            throw error;
        }
    }

    async cleanupInstance(instanceId: number): Promise<void> {
        await Instance.destroy({
            where: { id: instanceId }
        });
    }

    async getInstance(instanceId: number): Promise<{ id: number; port: number; workspace_path: string; workspace_name: string } | null> {
        const instance = await Instance.findByPk(instanceId);
        return instance ? instance.toJSON() : null;
    }

    async getInstanceByPort(port: number): Promise<{ id: number; port: number; workspace_path: string; workspace_name: string } | null> {
        const instance = await Instance.findOne({
            where: { port }
        });
        return instance ? instance.toJSON() : null;
    }
}