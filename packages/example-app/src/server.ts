import express, { type Request, type Response } from "express";
import { sentinelMiddleware, protect, type SentinelRequest } from "@sentinel/sdk";
import dotenv from "dotenv";
import { findAvailablePort } from "./utils/portHelper.js";

dotenv.config();

const app = express();
app.use(express.json());

const PREFERRED_PORT = parseInt(process.env.PORT || "3001", 10);
const SENTINEL_URL = process.env.SENTINEL_URL || "http://localhost:3000";

// ============================================
// Middleware to decode JWT and extract user info
// In a real app, you might use passport-jwt or similar
// For this example, we'll decode the JWT (without validation)
// since Sentinel will validate it anyway
// ============================================
app.use((req: any, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);

        try {
            // Decode JWT (base64 decode the payload)
            const parts = token.split(".");
            if (parts.length === 3) {
                const payload = JSON.parse(
                    Buffer.from(parts[1], "base64").toString("utf8")
                );

                // Extract user info from Keycloak token
                req.user = {
                    sub: payload.sub,
                    email: payload.email || payload.preferred_username,
                    username: payload.preferred_username,
                    roles: payload.realm_access?.roles || [],
                    departmentIds: payload.departmentIds || ["dept-1"],
                };
            }
        } catch (error) {
            console.error("Failed to decode JWT:", error);
            // Continue without user info - Sentinel will reject if needed
        }
    }

    next();
});

// ============================================
// Add Sentinel authorization capabilities
// ============================================
app.use(
    sentinelMiddleware({
        sentinelUrl: SENTINEL_URL,
        getToken: (req) => {
            return req.headers.authorization?.replace("Bearer ", "");
        },
        getSubject: (req: any) => req.user || {},
    })
);

// ============================================
// Example Routes
// ============================================

app.get("/", (req, res) => {
    res.json({
        message: "Sentinel Example App",
        endpoints: {
            health: "GET /health",
            documents: {
                create: "POST /documents (requires user role)",
                read: "GET /documents/:id (requires owner or manager)",
                update: "PUT /documents/:id (requires owner or dept manager)",
                delete: "DELETE /documents/:id (requires owner or admin)",
                list: "GET /documents (list documents in user's department)",
            },
            resources: {
                view: "GET /resources/:id (requires appropriate visibility)",
                create: "POST /resources (requires manager role)",
            },
        },
    });
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// ============================================
// Document Management Routes
// ============================================

/**
 * Create a new document
 * Policy: policy-3 (users can create documents)
 */
app.post(
    "/documents",
    protect(
        "document:create",
        (req) => ({
            type: "document",
        })
    ),
    async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { title, content } = req.body;

        res.status(201).json({
            message: "Document created successfully",
            document: {
                id: `doc-${Date.now()}`,
                title,
                content,
                ownerId: user.sub,
                departmentId: user.departmentIds?.[0] || "dept-1",
                createdAt: new Date().toISOString(),
            },
        });
    }
);

/**
 * Read a document
 * Policy: policy-2 (users can read own documents), policy-6 (managers can read all)
 */
app.get("/documents/:id", async (req, res: Response) => {
    const sentinelReq = req as any as SentinelRequest;
    const user = (req as any).user;

    // Simulate fetching document from database
    const document = {
        id: req.params.id,
        title: "Sample Document",
        content: "Document content here",
        ownerId: "user-123", // Simulate different owner
        departmentId: "dept-1",
    };

    // Manual authorization check
    const decision = await sentinelReq.sentinel.authorize(
        "document:read",
        {
            type: "document",
            id: document.id,
            ownerId: document.ownerId,
            departmentId: document.departmentId,
        }
    );

    if (!decision.allow) {
        return res.status(403).json({
            error: "Forbidden",
            reason: decision.reason,
        });
    }

    res.json({
        document,
        viewedBy: user.email,
    });
});

/**
 * Update a document
 * Policy: policy-4 (users can update own), policy-7 (managers can update in department)
 */
app.put(
    "/documents/:id",
    protect(
        "document:update",
        (req) => ({
            type: "document",
            id: req.params.id,
            ownerId: (req as any).user.sub, // In real app, fetch from DB
            departmentId: (req as any).user.departmentIds?.[0] || "dept-1",
        })
    ),
    async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { title, content } = req.body;

        res.json({
            message: `Document ${req.params.id} updated successfully`,
            document: {
                id: req.params.id,
                title,
                content,
                updatedBy: user.email,
                updatedAt: new Date().toISOString(),
            },
        });
    }
);

/**
 * Delete a document
 * Policy: policy-5 (users can delete own), policy-1 (admins can delete any)
 */
app.delete("/documents/:id", async (req, res: Response) => {
    const sentinelReq = req as any as SentinelRequest;
    const user = (req as any).user;
    const documentId = req.params.id;

    // In a real app, fetch document from database
    const document = {
        id: documentId,
        ownerId: "user-123", // Simulate different owner
        departmentId: "dept-1",
    };

    const decision = await sentinelReq.sentinel.authorize(
        "document:delete",
        {
            type: "document",
            id: document.id,
            ownerId: document.ownerId,
            departmentId: document.departmentId,
        }
    );

    if (!decision.allow) {
        return res.status(403).json({
            error: "Forbidden",
            reason: decision.reason,
            matchedPolicy: decision.matchedPolicyId,
        });
    }

    res.json({
        message: `Document ${documentId} deleted successfully`,
        deletedBy: user.email,
    });
});

/**
 * List documents in user's department
 * Policy: policy-8 (users can list documents in department)
 */
app.get("/documents", async (req, res: Response) => {
    const user = (req as any).user;
    const departmentId = user.departmentIds?.[0] || "dept-1";

    // In a real app, query database for documents in department
    const documents = [
        {
            id: "doc-1",
            title: "Department Report",
            ownerId: user.sub,
            departmentId,
        },
        {
            id: "doc-2",
            title: "Team Notes",
            ownerId: "user-456",
            departmentId,
        },
    ];

    res.json({
        documents,
        department: departmentId,
        count: documents.length,
    });
});

// ============================================
// Resource Management Routes
// ============================================

/**
 * View a resource
 * Policy: policy-9 (users can view public resources)
 */
app.get(
    "/resources/:id",
    protect(
        "resource:view",
        (req) => ({
            type: "resource",
            id: req.params.id,
            visibility: "public", // In real app, fetch from DB
            departmentId: "dept-1",
        })
    ),
    async (req: Request, res: Response) => {
        const user = (req as any).user;

        res.json({
            resource: {
                id: req.params.id,
                name: "Public Resource",
                description: "This is a publicly accessible resource",
                visibility: "public",
                departmentId: "dept-1",
            },
            viewedBy: user.email,
        });
    }
);

/**
 * Create a resource
 * Policy: policy-10 (managers can create resources)
 */
app.post(
    "/resources",
    protect(
        "resource:create",
        (req) => ({
            type: "resource",
        })
    ),
    async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { name, description, visibility = "public" } = req.body;

        res.status(201).json({
            message: "Resource created successfully",
            resource: {
                id: `res-${Date.now()}`,
                name,
                description,
                visibility,
                departmentId: user.departmentIds?.[0] || "dept-1",
                createdBy: user.sub,
                createdAt: new Date().toISOString(),
            },
        });
    }
);

// ============================================
// Start Server
// ============================================

const startServer = async () => {
    try {
        // Try to find an available port starting from the preferred one
        const PORT = await findAvailablePort(PREFERRED_PORT);

        if (PORT !== PREFERRED_PORT) {
            console.log(`⚠️  Port ${PREFERRED_PORT} is in use, using port ${PORT} instead`);
        }

        app.listen(PORT, () => {
            console.log(`\n🚀 Example App running on http://localhost:${PORT}`);
            console.log(`📡 Connected to Sentinel at ${SENTINEL_URL}`);
            console.log(`\n📚 Available endpoints:`);
            console.log(`   GET  http://localhost:${PORT}/                - App info`);
            console.log(`   GET  http://localhost:${PORT}/health          - Health check`);
            console.log(`   POST http://localhost:${PORT}/documents       - Create document`);
            console.log(`   GET  http://localhost:${PORT}/documents/:id   - Read document`);
            console.log(`   PUT  http://localhost:${PORT}/documents/:id   - Update document`);
            console.log(`   DEL  http://localhost:${PORT}/documents/:id   - Delete document`);
            console.log(`   GET  http://localhost:${PORT}/documents       - List documents`);
            console.log(`   GET  http://localhost:${PORT}/resources/:id   - View resource`);
            console.log(`   POST http://localhost:${PORT}/resources       - Create resource`);
            console.log(`\n🔑 Get a Keycloak token:`);
            console.log(`   export TOKEN=$(curl -s -X POST http://localhost:8080/realms/sentinel/protocol/openid-connect/token \\`);
            console.log(`     -H "Content-Type: application/x-www-form-urlencoded" \\`);
            console.log(`     -d "grant_type=password" \\`);
            console.log(`     -d "client_id=sentinel-api" \\`);
            console.log(`     -d "username=admin" \\`);
            console.log(`     -d "password=admin123" | jq -r '.access_token')`);
            console.log(`\n🧪 Test with token:`);
            console.log(`   curl -X POST http://localhost:${PORT}/documents -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Test Doc","content":"Hello"}'`);
            console.log(`   curl -X GET http://localhost:${PORT}/documents/doc-123 -H "Authorization: Bearer $TOKEN"`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();
