import Fastify from "fastify";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { decisionRoutes } from "./routes/decision.js";
import { policyRoutes } from "./routes/policies.js";
import { findAvailablePort } from "./utils/portHelper.js";

const app = Fastify({ logger: true });
app.register(healthRoutes);
app.register(authRoutes);
app.register(decisionRoutes);
app.register(policyRoutes);

const start = async () => {
    try {
        const port = await findAvailablePort(env.port);

        if (port !== env.port) {
            app.log.warn(
                `⚠️  Port ${env.port} is in use, using port ${port} instead`
            );
        }

        await app.listen({ port, host: "0.0.0.0" });
        app.log.info(`✅ Sentinel Gate running on http://localhost:${port}`);
        app.log.info(`📡 Health check: http://localhost:${port}/health`);
        app.log.info(`🔐 Auth endpoint: http://localhost:${port}/auth/verify`);
        app.log.info(`⚖️  Decision endpoint: http://localhost:${port}/decision`);
        app.log.info(`📋 Policies endpoint: http://localhost:${port}/policies`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
