# @sentinel/sdk

Lightweight client SDK for Sentinel Gate — plug-and-play authorization and authentication service with support for Express, Fastify, and direct API calls.

## 🚀 Quick Start

### Installation

```bash
npm install @sentinel/sdk
```

### Basic Usage

#### Direct API Calls

```typescript
import { SentinelClient } from "@sentinel/sdk";

const client = new SentinelClient({
  baseUrl: "http://localhost:3000",
  token: "your-jwt-token",
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
  console.log("✅ Access granted:", decision.reason);
} else {
  console.log("❌ Access denied:", decision.reason);
}
```

#### Helper Function

```typescript
import { authorize } from "@sentinel/sdk";

const result = await authorize(
  {
    subject: { sub: "user123", roles: ["manager"], departmentIds: ["dept-1"] },
    action: "resource:create",
    resource: { type: "resource" },
  },
  {
    baseUrl: "http://localhost:3000",
    token: process.env.JWT_TOKEN,
  }
);
```

---

## 🔌 Framework Integrations

### Express Middleware

The SDK provides Express middleware that adds authorization capabilities to all routes.

#### Setup

```typescript
import express from "express";
import { sentinelMiddleware, protect, SentinelRequest } from "@sentinel/sdk";

const app = express();

// Add Sentinel middleware (makes req.sentinel available)
app.use(
  sentinelMiddleware({
    sentinelUrl: "http://localhost:3000",
    getToken: (req) => req.headers.authorization?.replace("Bearer ", ""),
    getSubject: (req) => req.user, // Assumes req.user is set by auth middleware
  })
);
```

#### Option 1: Using `protect()` Helper

Simplest way to protect routes:

```typescript
app.put(
  "/documents/:id",
  protect(
    "document:update", // action
    (req) => ({
      // resource builder
      type: "document",
      id: req.params.id,
      ownerId: req.user.sub,
      departmentId: req.user.departmentIds[0],
    })
  ),
  async (req, res) => {
    // This handler only runs if authorization passes
    res.json({ message: "Document updated" });
  }
);
```

#### Option 2: Manual Authorization

For more control over the authorization flow:

```typescript
app.get("/documents/:id", async (req, res) => {
  const sentinelReq = req as any as SentinelRequest;

  const decision = await sentinelReq.sentinel.authorize("document:read", {
    type: "document",
    id: req.params.id,
    ownerId: req.user.sub,
    departmentId: req.user.departmentIds[0],
  });

  if (!decision.allow) {
    return res.status(403).json({
      error: "Forbidden",
      reason: decision.reason,
    });
  }

  // Continue with business logic
  res.json({ document: { id: req.params.id } });
});
```

#### Configuration Options

```typescript
interface SentinelMiddlewareOptions {
  sentinelUrl?: string;

  // Custom token extraction
  getToken?: (req: Request) => string | undefined;

  // Custom subject builder
  getSubject?: (req: Request) => Record<string, any>;

  // What to do when authorization fails
  onUnauthorized?: "block" | "continue"; // default: "block"
}
```

---

### Fastify Plugin

Similar integration for Fastify applications.

#### Setup

```typescript
import Fastify from "fastify";
import {
  sentinelPlugin,
  protectRoute,
  SentinelFastifyRequest,
} from "@sentinel/sdk";

const fastify = Fastify();

// Register Sentinel plugin
await fastify.register(sentinelPlugin, {
  sentinelUrl: "http://localhost:3000",
  getToken: (req) => req.headers.authorization?.replace("Bearer ", ""),
  getSubject: (req) => req.user,
});
```

#### Option 1: Using `protectRoute()` PreHandler

```typescript
fastify.put(
  "/documents/:id",
  {
    preHandler: protectRoute("document:update", (req) => ({
      type: "document",
      id: (req.params as any).id,
      ownerId: req.user.sub,
      departmentId: req.user.departmentIds[0],
    })),
  },
  async (request, reply) => {
    return { message: "Document updated" };
  }
);
```

#### Option 2: Manual Authorization

```typescript
fastify.get("/documents/:id", async (request, reply) => {
  const sentinelReq = request as SentinelFastifyRequest;

  const decision = await sentinelReq.sentinel.authorize("document:read", {
    type: "document",
    id: (request.params as any).id,
    ownerId: request.user.sub,
    departmentId: request.user.departmentIds[0],
  });

  if (!decision.allow) {
    return reply.code(403).send({
      error: "Forbidden",
      reason: decision.reason,
    });
  }

  return { document: { id: (request.params as any).id } };
});
```

---

## 🏗️ Architecture

```
Your App → SDK Middleware → Sentinel PDP
                                ↓
                        Validates JWT with Keycloak
                                ↓
                        Evaluates Policies (json-logic)
                                ↓
                        Returns { allow, reason, policyId }
```

**Key Points:**

- SDK is a "thin" client - just HTTP calls
- All auth/authz logic lives in Sentinel
- Sentinel validates tokens with Keycloak
- Policies are evaluated server-side

---

## 📚 API Reference

### Types

```typescript
interface DecisionRequest {
  subject: Record<string, any>; // User info (roles, uaIds, etc.)
  action: string; // Action to perform (e.g., "padron:edit")
  resource: Record<string, any>; // Resource being accessed
  context?: Record<string, any>; // Additional context (e.g., { app: "unlp" })
}

interface DecisionResponse {
  allow: boolean;
  reason: string;
  matchedPolicyId?: string;
}
```

### Client Methods

#### `SentinelClient.authorize(request)`

Makes an authorization decision request.

#### `SentinelClient.health()`

Checks if Sentinel service is available.

---

## 🧪 Example App

Check out the complete example in [`packages/example-app/`](../example-app/) which demonstrates:

- Express integration
- UNLP and Hoops policy examples
- Keycloak token handling
- Both `protect()` and manual authorization patterns

---

## 🔧 Environment Variables

```bash
SENTINEL_URL=http://localhost:3000  # Sentinel PDP endpoint
SENTINEL_TOKEN=<jwt-token>          # Optional: default token for client
```

---

## 📖 Further Reading

- **Monorepo docs:** `../../README.monorepo.md`
- **Sentinel docs:** `../sentinel/README.md`
- **Example app:** `../example-app/README.md`
- **Policies:** `../sentinel/src/data/policies.json`
