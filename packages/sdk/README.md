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
    roles: ["admin"],
    uaIds: ["FCEyN"],
  },
  action: "padron:edit",
  resource: {
    type: "padron",
    id: "123",
    status: "OPEN",
  },
  context: {
    app: "unlp",
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
    subject: { sub: "user123", roles: ["player"] },
    action: "court:book",
    resource: { type: "court", id: "court-1" },
    context: { app: "hoops" },
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
  "/padron/:id",
  protect(
    "padron:edit", // action
    (req) => ({
      // resource builder
      type: "padron",
      id: req.params.id,
      status: "OPEN",
    }),
    { app: "unlp" } // context
  ),
  async (req, res) => {
    // This handler only runs if authorization passes
    res.json({ message: "Padron updated" });
  }
);
```

#### Option 2: Manual Authorization

For more control over the authorization flow:

```typescript
app.get("/mesa/:id", async (req, res) => {
  const sentinelReq = req as any as SentinelRequest;

  const decision = await sentinelReq.sentinel.authorize(
    "mesa:view",
    { type: "mesa", id: req.params.id },
    { app: "unlp" }
  );

  if (!decision.allow) {
    return res.status(403).json({
      error: "Forbidden",
      reason: decision.reason,
    });
  }

  // Continue with business logic
  res.json({ mesa: { id: req.params.id } });
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
  "/padron/:id",
  {
    preHandler: protectRoute(
      "padron:edit",
      (req) => ({
        type: "padron",
        id: (req.params as any).id,
        status: "OPEN",
      }),
      { app: "unlp" }
    ),
  },
  async (request, reply) => {
    return { message: "Padron updated" };
  }
);
```

#### Option 2: Manual Authorization

```typescript
fastify.get("/mesa/:id", async (request, reply) => {
  const sentinelReq = request as SentinelFastifyRequest;

  const decision = await sentinelReq.sentinel.authorize(
    "mesa:view",
    { type: "mesa", id: (request.params as any).id },
    { app: "unlp" }
  );

  if (!decision.allow) {
    return reply.code(403).send({
      error: "Forbidden",
      reason: decision.reason,
    });
  }

  return { mesa: { id: (request.params as any).id } };
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
