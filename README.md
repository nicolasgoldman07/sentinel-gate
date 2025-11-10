# 🛡️ Sentinel Gate

**A modern, scalable authorization and authentication service with Policy Enforcement Point (PEP) and Policy Decision Point (PDP) architecture.**

Sentinel Gate is a production-ready authorization microservice that implements Attribute-Based Access Control (ABAC) using JSON Logic policies, integrated with Keycloak for authentication.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [How It Works](#-how-it-works)
- [Usage Examples](#-usage-examples)
- [Development](#-development)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🔐 Authentication & Authorization

- **Keycloak Integration**: Enterprise-grade OAuth2/OIDC authentication
- **JWT Validation**: Automatic token verification using JWKS
- **ABAC Policies**: Flexible attribute-based access control with JSON Logic
- **Multi-Tenancy**: Support for multiple applications and contexts

### 🏗️ Architecture

- **PDP (Policy Decision Point)**: Centralized decision-making service
- **PEP (Policy Enforcement Point)**: SDK with Express/Fastify middleware
- **Monorepo Structure**: Organized with npm workspaces and Turborepo
- **Type-Safe**: Full TypeScript coverage with strict typing

### 🚀 Developer Experience

- **Plug & Play SDK**: Easy integration with Express and Fastify
- **Example Application**: Complete reference implementation
- **Port Fallback**: Automatic port detection and fallback
- **Hot Reload**: Development mode with watch support
- **Comprehensive Docs**: Detailed documentation and examples

### 📊 Policy Engine

- **JSON Logic**: Powerful, declarative policy language
- **Dynamic Evaluation**: Real-time policy evaluation
- **Context-Aware**: Policies adapt to application context
- **Audit Trail**: Track all authorization decisions

---

## 🏛️ Architecture — concise flow

Below is a simple, step-by-step textual flow that shows how authentication and authorization work together
with Sentinel Gate, without diagrams.

1. Authentication — Keycloak (Identity Provider)

   - A client (browser/mobile) authenticates with Keycloak and obtains an access token (JWT).

2. Client request — your application (PEP)

   - The client sends an API request to your app including the JWT in the Authorization header.
   - The app runs the PEP middleware (`@sentinel/sdk`) which:
     - extracts the token,
     - optionally validates it locally (signature/expiry) for a fast-fail,
     - builds a DecisionRequest object describing the subject, action, resource and context,
     - forwards the DecisionRequest to the Sentinel PDP via POST /decision.

3. Policy decision — Sentinel PDP

   - The PDP is the authoritative evaluator. For each request it:
     - validates the JWT using Keycloak's JWKS (cached), checking signature, iss and exp,
     - normalizes token claims into the `subject` object used by policies,
     - loads and filters policies (by action/context), then evaluates RBAC rules and ABAC rules (json-logic) against the full DecisionRequest,
     - logs/audits the decision and returns a compact DecisionResponse: { allow, reason, matchedPolicyId }.

4. Enforcement — PEP inside your app
   - The PEP receives the DecisionResponse and enforces it:
     - if `allow` → continue processing the request;
     - if `deny` → return 403 (or follow configured `onUnauthorized` behavior);
     - optionally cache the decision for a short TTL and attach trace/audit headers to responses.

Where to run each component

- Keycloak: central identity provider (can be shared across apps/environments).
- Sentinel PDP: centralized policy service (or per-environment/service for isolation).
- PEP: embedded in each application (Express/Fastify middleware).

Short example (DecisionRequest / DecisionResponse)

DecisionRequest (PEP → PDP):

```json
{
  "subject": {
    "sub": "user-123",
    "roles": ["user"],
    "departmentIds": ["dept-1"]
  },
  "action": "document:read",
  "resource": { "type": "document", "id": "doc-123", "ownerId": "user-123" }
}
```

DecisionResponse (PDP → PEP):

```json
{
  "allow": true,
  "reason": "Matched policy: policy-2",
  "matchedPolicyId": "policy-2"
}
```

Quick best-practices

- PDP must validate JWTs via Keycloak JWKS; PEP can optionally validate locally to fail fast.
- Cache JWKS and use short, careful decision caching in the PEP (e.g., 30s–2m) with invalidation on policy updates.
- Audit decisions in the PDP (timestamp, subject, action, resource, policyId) and surface trace IDs to the PEP.
- Default to deny-if-PDP-unreachable unless you have a controlled degraded mode.
- Use stable action names like `resource:verb` (e.g., `document:read`, `court:book`) and clear policy IDs.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v20+ (tested with v20.19.3)
- **npm**: v9+
- **Docker**: For running Keycloak
- **jq**: For parsing JSON in terminal (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/nicolasgoldman07/sentinel-gate.git
cd sentinel-gate

# Install dependencies
npm install

# Build all packages
npm run build
```

### Start Services

**Terminal 1 - Start Keycloak:**

```bash
npm run keycloak:start
# Wait for: "Keycloak 23.0 ... started"
# Access at: http://localhost:8080
```

**Terminal 2 - Start Sentinel PDP:**

```bash
npm run dev
# Sentinel will start on http://localhost:3000
# Automatically finds available port if 3000 is busy
```

**Terminal 3 - Start Example App (optional):**

```bash
cd packages/example-app
npm run dev
# Example app will start on http://localhost:3001
```

### Test the System

```bash
# 1. Obtain a JWT token from Keycloak
export TOKEN=$(curl -s -X POST http://localhost:8080/realms/sentinel/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=sentinel-api" \
  -d "username=admin" \
  -d "password=admin123" | jq -r '.access_token')

# 2. Verify the token
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/auth/verify | jq

# 3. Make an authorization decision
curl -X POST http://localhost:3000/decision \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": { "sub": "admin", "roles": ["admin"] },
    "action": "padron:edit",
    "resource": { "type": "padron", "status": "OPEN" },
    "context": { "app": "unlp" }
  }' | jq

# Expected response:
# {
#   "allow": true,
#   "reason": "Matched Admins UNLP pueden todo en la app UNLP",
#   "matchedPolicyId": "unlp-900"
# }
```

---

## 📁 Project Structure

```
sentinel-gate/
├── packages/
│   ├── sentinel/              # PDP - Policy Decision Point
│   │   ├── src/
│   │   │   ├── config/        # Configuration (env, keycloak)
│   │   │   ├── data/          # Policy files (JSON)
│   │   │   ├── middleware/    # Keycloak auth middleware
│   │   │   ├── repositories/  # Policy storage (file, DynamoDB)
│   │   │   ├── routes/        # API routes (health, auth, decision, policies)
│   │   │   ├── services/      # Business logic (policy evaluation)
│   │   │   ├── types/         # TypeScript type definitions
│   │   │   ├── utils/         # Utilities (logger, JWT, port helper)
│   │   │   └── server.ts      # Main application entry
│   │   └── package.json
│   │
│   ├── sdk/                   # PEP - Policy Enforcement Point
│   │   ├── src/
│   │   │   ├── middleware/    # Express & Fastify integrations
│   │   │   │   ├── express.ts # Express middleware
│   │   │   │   └── fastify.ts # Fastify plugin
│   │   │   ├── client.ts      # HTTP client for Sentinel
│   │   │   ├── types.ts       # Request/response types
│   │   │   └── index.ts       # Public API exports
│   │   ├── README.md          # SDK documentation
│   │   └── package.json
│   │
│   ├── example-app/           # Reference implementation
│   │   ├── src/
│   │   │   ├── utils/         # Port helper
│   │   │   └── server.ts      # Express app with SDK
│   │   ├── README.md          # Usage examples
│   │   └── package.json
│   │
│   └── infra/                 # Infrastructure as Code
│       ├── docker-compose.yml # Keycloak + Postgres
│       ├── keycloak/
│       │   └── realm-export.json  # Keycloak realm config
│       └── package.json
│
├── test.sh                    # Automated test suite
├── turbo.json                 # Turborepo configuration
├── package.json               # Root package (workspace)
└── README.md                  # This file
```

### Package Descriptions

| Package         | Description                                                | Port |
| --------------- | ---------------------------------------------------------- | ---- |
| **sentinel**    | Core PDP service - validates tokens and evaluates policies | 3000 |
| **sdk**         | Client library with Express/Fastify middleware             | N/A  |
| **example-app** | Sample application demonstrating SDK usage                 | 3001 |
| **infra**       | Docker Compose setup for Keycloak                          | 8080 |

---

## 🔧 How It Works

### 1. Authentication Flow

```typescript
// Client obtains token from Keycloak
const response = await fetch(
  "http://localhost:8080/realms/sentinel/protocol/openid-connect/token",
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "sentinel-api",
      username: "admin",
      password: "admin123",
    }),
  }
);

const { access_token } = await response.json();
```

### 2. Authorization Request

```typescript
// Client app (using SDK) makes authorization request
import { SentinelClient } from "@sentinel/sdk";

const client = new SentinelClient({
  baseUrl: "http://localhost:3000",
  token: access_token,
});

const decision = await client.authorize({
  subject: {
    sub: "user123",
    roles: ["user"],
    email: "user@example.com",
    departmentIds: ["dept-1"],
  },
  action: "document:read",
  resource: {
    type: "document",
    id: "doc-123",
    ownerId: "user123",
    departmentId: "dept-1",
  },
});

if (decision.allow) {
  // Proceed with operation
} else {
  // Deny access
  throw new Error(decision.reason);
}
```

### 3. Policy Evaluation

Sentinel uses **JSON Logic** to evaluate policies. Example policy:

```json
{
  "id": "policy-2",
  "name": "Users can read their own documents",
  "effect": "allow",
  "condition": {
    "and": [
      { "in": ["user", { "var": "subject.roles" }] },
      { "===": [{ "var": "action" }, "document:read"] },
      { "===": [{ "var": "resource.type" }, "document"] },
      { "===": [{ "var": "resource.ownerId" }, { "var": "subject.userId" }] }
    ]
  }
}
```

**This policy allows** users to read documents where:

- They have the "user" role
- The resource is a document
- They are the owner of the document

---

## 💡 Usage Examples

### Express Integration

```typescript
import express from "express";
import { sentinelMiddleware, protect } from "@sentinel/sdk";

const app = express();

// Add Sentinel middleware
app.use(
  sentinelMiddleware({
    sentinelUrl: "http://localhost:3000",
    getToken: (req) => req.headers.authorization?.replace("Bearer ", ""),
    getSubject: (req) => req.user,
  })
);

// Protect a route
app.put(
  "/documents/:id",
  protect("document:update", (req) => ({
    type: "document",
    id: req.params.id,
    ownerId: req.user.sub,
    departmentId: req.user.departmentIds[0],
  })),
  (req, res) => {
    res.json({ message: "Document updated" });
  }
);
```

### Fastify Integration

```typescript
import Fastify from "fastify";
import { sentinelPlugin, protectRoute } from "@sentinel/sdk";

const fastify = Fastify();

// Register Sentinel plugin
await fastify.register(sentinelPlugin, {
  sentinelUrl: "http://localhost:3000",
});

// Protect a route
fastify.put(
  "/documents/:id",
  {
    preHandler: protectRoute("document:update", (req) => ({
      type: "document",
      id: req.params.id,
      ownerId: req.user.sub,
      departmentId: req.user.departmentIds[0],
    })),
  },
  async (request, reply) => {
    return { message: "Document updated" };
  }
);
```

### Manual Authorization

```typescript
import { SentinelRequest } from "@sentinel/sdk";

app.get("/documents/:id", async (req, res) => {
  const decision = await (req as SentinelRequest).sentinel.authorize(
    "document:read",
    {
      type: "document",
      id: req.params.id,
      ownerId: req.user.sub,
      departmentId: req.user.departmentIds[0],
    }
  );

  if (!decision.allow) {
    return res.status(403).json({ error: decision.reason });
  }

  // Continue with business logic...
});
```

---

## 🛠️ Development

### Available Scripts

```bash
# Development (runs all services in watch mode)
npm run dev

# Build all packages
npm run build

# Type checking
npm run typecheck

# Format code
npm run format

# Clean & reinstall
npm run clean
npm run clean:install

# Keycloak management
npm run keycloak:start    # Start Keycloak
npm run keycloak:stop     # Stop Keycloak
npm run keycloak:logs     # View logs
npm run keycloak:clean    # Remove volumes
```

### Adding a New Policy

1. Edit `packages/sentinel/src/data/policies.json`
2. Add your policy following the JSON Logic format:

```json
{
  "id": "my-policy-1",
  "name": "My Custom Policy",
  "effect": "allow",
  "condition": {
    "and": [
      { "===": [{ "var": "action" }, "resource:read"] },
      { "in": ["user", { "var": "subject.roles" }] }
    ]
  }
}
```

3. Restart Sentinel (hot reload not yet implemented for policies)

### Testing Policies

Use the provided test script:

```bash
./test.sh
```

Or test manually:

```bash
curl -X POST http://localhost:3000/decision \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": { "sub": "user-123", "roles": ["user"], "departmentIds": ["dept-1"] },
    "action": "document:read",
    "resource": { "type": "document", "id": "doc-123", "ownerId": "user-123" }
  }'
```

---

## ⚙️ Configuration

### Environment Variables

**Sentinel (PDP):**

```bash
# .env in packages/sentinel/
PORT=3000
NODE_ENV=development

# Keycloak configuration
KEYCLOAK_SERVER_URL=http://localhost:8080
KEYCLOAK_REALM=sentinel
KEYCLOAK_CLIENT_ID=sentinel-api
```

**Example App:**

```bash
# .env in packages/example-app/
PORT=3001
SENTINEL_URL=http://localhost:3000
```

### Keycloak Configuration

Default users in the included realm:

| Username | Password | Roles |
| -------- | -------- | ----- |
| admin    | admin123 | admin |
| testuser | user123  | user  |

To customize, edit `packages/infra/keycloak/realm-export.json`

---

## 📚 API Documentation

### Sentinel PDP Endpoints

#### `GET /health`

Health check endpoint.

**Response:**

```json
{ "status": "ok" }
```

#### `POST /auth/verify`

Verify and decode a JWT token.

**Headers:**

- `Authorization: Bearer <token>`

**Response:**

```json
{
  "valid": true,
  "user": {
    "sub": "237ceb18-11a5-4869-865e-69fd544fb2b3",
    "email": "admin@sentinel.local",
    "username": "admin",
    "roles": ["admin"]
  }
}
```

#### `POST /decision`

Make an authorization decision.

**Headers:**

- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Body:**

```json
{
  "subject": {
    "sub": "user-id",
    "roles": ["user"],
    "email": "user@example.com",
    "departmentIds": ["dept-1"]
  },
  "action": "document:read",
  "resource": {
    "type": "document",
    "id": "doc-123",
    "ownerId": "user-id",
    "departmentId": "dept-1"
  }
}
```

**Response:**

```json
{
  "allow": true,
  "reason": "Matched policy: policy-2",
  "matchedPolicyId": "policy-2"
}
```

#### `GET /policies`

List all policies (requires admin role).

**Response:**

```json
[
  {
    "id": "policy-2",
    "name": "Users can read their own documents",
    "effect": "allow",
    "condition": { ... }
  }
]
```

---

## 🧪 Testing

### Automated Tests

Run the comprehensive test suite:

```bash
./test.sh
```

This will test:

- ✅ Token acquisition from Keycloak
- ✅ Document policies (create, read, update, delete)
- ✅ Resource policies (view, create)
- ✅ Admin vs regular user vs manager permissions
- ✅ Owner-based and department-based access control

### Manual Testing

See the [Quick Start](#-quick-start) section for manual testing examples.

---

## 🚀 Deployment

### Production Checklist

- [ ] Use external Keycloak instance (not Docker)
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS settings
- [ ] Use PostgreSQL/DynamoDB for policy storage (not JSON file)
- [ ] Enable audit logging
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure HTTPS/TLS
- [ ] Review and harden security policies
- [ ] Set up backup strategy for policies

### Docker Deployment (Example)

```dockerfile
# Dockerfile for Sentinel
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY packages/sentinel/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Environment-Specific Configs

**Production:**

```bash
NODE_ENV=production
PORT=3000
KEYCLOAK_SERVER_URL=https://keycloak.yourcompany.com
LOG_LEVEL=info
```

**Staging:**

```bash
NODE_ENV=staging
PORT=3000
KEYCLOAK_SERVER_URL=https://keycloak-staging.yourcompany.com
LOG_LEVEL=debug
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Write tests for new features
- Follow existing code style (use `npm run format`)
- Update documentation for API changes
- Keep commits atomic and well-described

---

## 📄 License

This project is licensed under the ISC License.

---

## 🙏 Acknowledgments

- **Keycloak** - Identity and Access Management
- **JSON Logic** - Declarative policy engine
- **Fastify** - Fast and low overhead web framework
- **Turborepo** - High-performance monorepo build system

---

## 📞 Support

For questions and support:

- **Issues**: [GitHub Issues](https://github.com/nicolasgoldman07/sentinel-gate/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nicolasgoldman07/sentinel-gate/discussions)

---

## 🗺️ Roadmap

- [ ] **Policy Management UI** - Web dashboard for managing policies
- [ ] **Policy CRUD API** - REST API for policy management
- [ ] **Audit Logging** - Track all authorization decisions
- [ ] **Database Storage** - PostgreSQL/DynamoDB for policies
- [ ] **Caching Layer** - Redis for decision caching
- [ ] **Metrics & Analytics** - Prometheus metrics and dashboards
- [ ] **Policy Templates** - Pre-built policy templates (RBAC, ABAC, etc.)
- [ ] **Batch Operations** - Evaluate multiple decisions in one call
- [ ] **Webhooks** - Notify on policy changes
- [ ] **OpenAPI/Swagger** - Interactive API documentation

---

Made with ❤️ by [nicolasgoldman07](https://github.com/nicolasgoldman07)
