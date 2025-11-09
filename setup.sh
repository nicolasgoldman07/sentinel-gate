#!/usr/bin/env bash
set -e

PROJECT_NAME="sentinel-gate"

echo "🚧 Creating project $PROJECT_NAME ..."
npm init -y >/dev/null

echo "📦 Installing dependencies..."
npm install fastify dotenv
npm install --save-dev typescript ts-node @types/node

echo "⚙️  Setting up TypeScript config..."
npx tsc --init --rootDir src --outDir dist --esModuleInterop --resolveJsonModule --strict --target ES2020 --module CommonJS >/dev/null

mkdir -p src/{routes,config}
touch .env .gitignore
echo "PORT=3000" > .env
echo "node_modules\ndist\n.env" > .gitignore

cat <<'EOF' > src/config/env.ts
import dotenv from "dotenv";
dotenv.config();
export const env = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
};
EOF

cat <<'EOF' > src/routes/health.ts
import { FastifyInstance } from "fastify";
export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "sentinel-gate" }));
}
EOF

cat <<'EOF' > src/server.ts
import Fastify from "fastify";
import { env } from "./config/env";
import { healthRoutes } from "./routes/health";

const app = Fastify({ logger: true });
app.register(healthRoutes);

const start = async () => {
  try {
    await app.listen({ port: env.port, host: "0.0.0.0" });
    app.log.info(\`✅ Sentinel Gate running on port \${env.port}\`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
EOF

# Add scripts to package.json
echo "🧾 Adding npm script..."
tmpfile=$(mktemp)
jq '.scripts.dev = "ts-node src/server.ts"' package.json > "$tmpfile" && mv "$tmpfile" package.json

echo "✅ Project $PROJECT_NAME ready!"
echo "👉 Run it with: npm run dev"

