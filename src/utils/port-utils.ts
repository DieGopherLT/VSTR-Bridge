import * as net from 'net';

export async function findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const address = server.address();
            const port = typeof address === 'string' ? undefined : address?.port;
            server.close(() => {
                if (port) {
                    resolve(port);
                } else {
                    reject(new Error('Could not determine port number'));
                }
            });
        });
    });
}