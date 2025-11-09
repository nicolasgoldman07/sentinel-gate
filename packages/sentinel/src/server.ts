import Fastify from "fastify";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { decisionRoutes } from "./routes/decision.js";
import { policyRoutes } from "./routes/policies.js";

const app = Fastify({ logger: true });
app.register(healthRoutes);
app.register(authRoutes);
app.register(decisionRoutes);
app.register(policyRoutes);

const start = async () => {
    try {
        await app.listen({ port: env.port, host: "0.0.0.0" });
        app.log.info(`✅ Sentinel Gate running on port ${env.port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
