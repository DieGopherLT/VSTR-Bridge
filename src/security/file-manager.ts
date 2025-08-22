import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

export class SecureFileManager {
    private bridgeDir: string;
    private readonly SECURE_DIR_MODE = 0o700; // Solo el usuario puede acceder
    private readonly SECURE_FILE_MODE = 0o600; // Solo el usuario puede leer/escribir

    constructor() {
        this.bridgeDir = this.initializeBridgeDirectory();
    }

    private initializeBridgeDirectory(): string {
        const tmpDir = path.join(os.tmpdir(), 'vstr-bridge');
        
        try {
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { 
                    recursive: true, 
                    mode: this.SECURE_DIR_MODE 
                });
            } else {
                // Verificar y corregir permisos existentes
                this.ensureSecurePermissions(tmpDir, this.SECURE_DIR_MODE, true);
            }
            
            return tmpDir;
        } catch (error) {
            throw new Error(`Failed to create secure bridge directory: ${error}`);
        }
    }

    public writeBridgeInfo(info: SecureBridgeInfo): string {
        const filePath = path.join(this.bridgeDir, `bridge-${info.port}.json`);
        
        try {
            // Escribir archivo con permisos seguros
            fs.writeFileSync(
                filePath, 
                JSON.stringify(info, null, 2),
                { mode: this.SECURE_FILE_MODE }
            );

            // Verificar que los permisos se aplicaron correctamente
            if (!this.validateFilePermissions(filePath)) {
                throw new Error('Failed to set secure file permissions');
            }

            return filePath;
        } catch (error) {
            throw new Error(`Failed to write secure bridge info: ${error}`);
        }
    }

    public readBridgeInfo(filePath: string): SecureBridgeInfo {
        if (!this.validateFilePermissions(filePath)) {
            throw new Error('Bridge info file has insecure permissions');
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const info = JSON.parse(content) as SecureBridgeInfo;
            
            // Validar estructura del archivo
            this.validateBridgeInfoStructure(info);
            
            return info;
        } catch (error) {
            throw new Error(`Failed to read bridge info: ${error}`);
        }
    }

    public validateFilePermissions(filePath: string): boolean {
        try {
            const stats = fs.statSync(filePath);
            
            if (process.platform === 'win32') {
                // En Windows, validación limitada - verificar que es un archivo válido
                return stats.isFile();
            }
            
            const mode = stats.mode & parseInt('777', 8);
            
            // CORREGIDO: Solo owner con permisos de lectura/escritura exclusivos
            return mode === 0o600 || mode === 0o400; // Solo lectura o lectura-escritura para owner
        } catch {
            return false;
        }
    }

    public ensureSecurePermissions(targetPath: string, mode: number, isDirectory = false): void {
        try {
            if (process.platform !== 'win32') {
                fs.chmodSync(targetPath, mode);
                
                if (isDirectory) {
                    // Para directorios, también asegurar que archivos existentes tengan permisos seguros
                    const files = fs.readdirSync(targetPath);
                    for (const file of files) {
                        const filePath = path.join(targetPath, file);
                        const stats = fs.statSync(filePath);
                        
                        if (stats.isFile()) {
                            fs.chmodSync(filePath, this.SECURE_FILE_MODE);
                        } else if (stats.isDirectory()) {
                            this.ensureSecurePermissions(filePath, this.SECURE_DIR_MODE, true);
                        }
                    }
                }
            }
        } catch (error) {
            throw new Error(`Failed to set secure permissions: ${error}`);
        }
    }

    public cleanupBridgeFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                // Verificar que el archivo pertenece al directorio seguro
                if (!filePath.startsWith(this.bridgeDir)) {
                    throw new Error('Attempting to delete file outside bridge directory');
                }
                
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            throw new Error(`Failed to cleanup bridge file: ${error}`);
        }
    }

    public listBridgeFiles(): string[] {
        try {
            const files = fs.readdirSync(this.bridgeDir);
            return files
                .filter(file => file.startsWith('bridge-') && file.endsWith('.json'))
                .map(file => path.join(this.bridgeDir, file));
        } catch {
            return [];
        }
    }

    public cleanupStaleFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): number { // 24 horas por defecto
        let cleanedCount = 0;
        const now = Date.now();
        
        try {
            const bridgeFiles = this.listBridgeFiles();
            
            for (const filePath of bridgeFiles) {
                try {
                    const stats = fs.statSync(filePath);
                    const age = now - stats.mtime.getTime();
                    
                    if (age > maxAgeMs) {
                        this.cleanupBridgeFile(filePath);
                        cleanedCount++;
                    }
                } catch {
                    // Ignorar errores de archivos individuales
                    continue;
                }
            }
        } catch {
            // Ignorar errores de directorio
        }
        
        return cleanedCount;
    }

    private validateBridgeInfoStructure(info: any): void {
        const requiredFields = ['port', 'pid', 'auth_token', 'secure'];
        
        for (const field of requiredFields) {
            if (!(field in info)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (typeof info.port !== 'number' || info.port <= 0) {
            throw new Error('Invalid port number');
        }

        if (typeof info.auth_token !== 'string' || info.auth_token.length < 32) {
            throw new Error('Invalid auth token');
        }

        if (info.secure !== true) {
            throw new Error('Bridge info indicates insecure configuration');
        }
    }

    public getBridgeDirectory(): string {
        return this.bridgeDir;
    }
}