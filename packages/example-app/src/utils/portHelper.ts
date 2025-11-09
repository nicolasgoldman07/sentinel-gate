import { createServer } from "net";

/**
 * Check if a port is available
 */
export function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = createServer();

        server.once("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
                resolve(false);
            } else {
                resolve(false);
            }
        });

        server.once("listening", () => {
            server.close();
            resolve(true);
        });

        server.listen(port);
    });
}

/**
 * Find an available port starting from the preferred port
 */
export async function findAvailablePort(
    preferredPort: number,
    maxAttempts: number = 10
): Promise<number> {
    for (let i = 0; i < maxAttempts; i++) {
        const port = preferredPort + i;
        const available = await isPortAvailable(port);
        if (available) {
            return port;
        }
    }
    throw new Error(
        `No available port found after ${maxAttempts} attempts starting from ${preferredPort}`
    );
}
