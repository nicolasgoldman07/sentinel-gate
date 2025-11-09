# Example App - Sentinel Gate Integration

This is a sample Express application demonstrating how to integrate Sentinel Gate authorization using the `@sentinel/sdk`.

## 🎯 What This Demonstrates

- ✅ Using `sentinelMiddleware()` to add authorization capabilities to Express
- ✅ Using `protect()` helper for simple route protection
- ✅ Manual authorization checks with `req.sentinel.authorize()` for more control
- ✅ Generic RBAC policies (documents, resources, roles)
- ✅ Owner-based and department-based access control
- ✅ Integration with Keycloak authentication

## 🚀 Quick Start

### 1. Start Keycloak and Sentinel

```bash
# From the monorepo root
npm run keycloak:start   # Start Keycloak in Docker
npm run dev              # Start Sentinel PDP (in another terminal)
```

### 2. Start the Example App

```bash
# From the monorepo root
cd packages/example-app
cp .env.example .env
npm run dev
```

The app will run on `http://localhost:3001`

### 3. Test the Endpoints

#### Get a Keycloak Token

```bash
export TOKEN=$(curl -s -X POST http://localhost:8080/realms/sentinel/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=sentinel-api" \
  -d "username=admin" \
  -d "password=admin123" | jq -r '.access_token')
```

#### Test Document Routes

```bash
# Create a document (users can do this)
curl -X POST http://localhost:3001/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Document","content":"Hello world"}'

# Read a document (owner or manager can do this)
curl http://localhost:3001/documents/doc-123 \
  -H "Authorization: Bearer $TOKEN"

# Update a document (owner or dept manager can do this)
curl -X PUT http://localhost:3001/documents/doc-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title","content":"New content"}'

# Delete a document (owner or admin can do this)
curl -X DELETE http://localhost:3001/documents/doc-123 \
  -H "Authorization: Bearer $TOKEN"

# List documents in your department
curl http://localhost:3001/documents \
  -H "Authorization: Bearer $TOKEN"
```

#### Test Resource Routes

```bash
# View a public resource (users can do this)
curl http://localhost:3001/resources/res-1 \
  -H "Authorization: Bearer $TOKEN"

# Create a resource (managers can do this)
curl -X POST http://localhost:3001/resources \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Resource","description":"A public resource","visibility":"public"}'
```

## 📝 Code Examples

### Using the `protect()` Helper

The simplest way to protect a route:

```typescript
import { protect } from "@sentinel/sdk";

app.put(
  "/documents/:id",
  protect("document:update", (req) => ({
    type: "document",
    id: req.params.id,
    ownerId: req.user.sub,
    departmentId: req.user.departmentIds[0],
  })),
  async (req, res) => {
    // This handler only runs if authorization passes
  }
);
```

### Manual Authorization Checks

For more control over the authorization flow:

```typescript
import { SentinelRequest } from "@sentinel/sdk";

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
});
```

## 🏗️ Architecture

```
Client Request → Express App → Sentinel Middleware
                                    ↓
                            Extract token & user
                                    ↓
                            Call Sentinel PDP (/decision)
                                    ↓
                            Sentinel validates token with Keycloak
                                    ↓
                            Sentinel evaluates policies
                                    ↓
                            Return allow/deny decision
```

## 🔧 Configuration

Environment variables (`.env`):

```bash
SENTINEL_URL=http://localhost:3000  # Sentinel PDP endpoint
KEYCLOAK_URL=http://localhost:8080   # Keycloak server
PORT=3001                             # App port
```

## 📚 Learn More

- Main documentation: `../../README.md`
- SDK documentation: `../sdk/README.md`
- Policies: `../sentinel/src/data/policies.json`
