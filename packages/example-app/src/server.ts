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
                    // Add any custom claims your app needs
                    uaIds: payload.uaIds || [], // For UNLP example
                    tenantId: payload.tenantId || "clubA", // For Hoops example
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
            unlp: {
                editPadron: "PUT /unlp/padron/:id (requires admin or ua role)",
                viewMesa: "GET /unlp/mesa/:id (requires fiscal role)",
            },
            hoops: {
                bookCourt: "POST /hoops/courts/:id/book (requires player role)",
                cancelBooking: "DELETE /hoops/bookings/:id (requires owner or admin)",
            },
        },
    });
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// ============================================
// UNLP Example Routes
// ============================================

/**
 * Edit a padron - requires authorization check
 * Uses the protect() helper for simple authorization
 */
app.put(
    "/unlp/padron/:id",
    protect(
        "padron:edit",
        (req) => ({
            type: "padron",
            id: req.params.id,
            uaId: "FCEyN",
            status: "OPEN",
        }),
        { app: "unlp" }
    ),
    async (req: Request, res: Response) => {
        res.json({
            message: `Padron ${req.params.id} updated successfully`,
            updatedBy: (req as any).user.email,
        });
    }
);

/**
 * View a mesa - uses manual authorization for more control
 */
app.get("/unlp/mesa/:id", async (req, res: Response) => {
    const sentinelReq = req as any as SentinelRequest;
    const user = (req as any).user;

    // Manual authorization check
    const decision = await sentinelReq.sentinel.authorize(
        "mesa:view",
        {
            type: "mesa",
            id: req.params.id,
            uaId: "FCEyN",
        },
        { app: "unlp" }
    );

    if (!decision.allow) {
        return res.status(403).json({
            error: "Forbidden",
            reason: decision.reason,
        });
    }

    res.json({
        message: `Mesa ${req.params.id} details`,
        mesa: {
            id: req.params.id,
            uaId: "FCEyN",
            voters: 150,
        },
        viewedBy: user.email,
    });
});

// ============================================
// Hoops Example Routes
// ============================================

/**
 * Book a court - requires player role and eligibility
 */
app.post(
    "/hoops/courts/:id/book",
    protect(
        "court:book",
        (req) => ({
            type: "court",
            id: req.params.id,
            tenantId: (req as any).user.tenantId,
            clubId: "CAB",
        }),
        (req) => ({
            app: "hoops",
            isEligibleToBook: true, // In real app, check player's eligibility
        })
    ),
    async (req: Request, res: Response) => {
        const user = (req as any).user;
        res.json({
            message: `Court ${req.params.id} booked successfully`,
            booking: {
                id: `B${Date.now()}`,
                courtId: req.params.id,
                playerId: user.sub,
                time: new Date().toISOString(),
            },
        });
    }
);

/**
 * Cancel a booking - can be done by owner or club admin
 */
app.delete("/hoops/bookings/:id", async (req, res: Response) => {
    const sentinelReq = req as any as SentinelRequest;
    const user = (req as any).user;
    const bookingId = req.params.id;

    // In a real app, you'd fetch the booking from DB
    const booking = {
        id: bookingId,
        playerId: "player1", // Simulate different owner
        clubId: "CAB",
    };

    const decision = await sentinelReq.sentinel.authorize(
        "booking:cancel",
        {
            type: "booking",
            bookingId: booking.id,
            playerId: booking.playerId,
            clubId: booking.clubId,
        },
        {
            app: "hoops",
            canCancel: true, // In real app, check if within cancellation window
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
        message: `Booking ${bookingId} cancelled successfully`,
        cancelledBy: user.email,
    });
});

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
            console.log(`   GET  http://localhost:${PORT}/              - App info`);
            console.log(`   GET  http://localhost:${PORT}/health         - Health check`);
            console.log(`   PUT  http://localhost:${PORT}/unlp/padron/:id - Edit padron (UNLP)`);
            console.log(`   GET  http://localhost:${PORT}/unlp/mesa/:id   - View mesa (UNLP)`);
            console.log(`   POST http://localhost:${PORT}/hoops/courts/:id/book - Book court (Hoops)`);
            console.log(`   DEL  http://localhost:${PORT}/hoops/bookings/:id    - Cancel booking (Hoops)`);
            console.log(`\n🔑 Get a Keycloak token:`);
            console.log(`   export TOKEN=$(curl -s -X POST http://localhost:8080/realms/sentinel/protocol/openid-connect/token \\`);
            console.log(`     -H "Content-Type: application/x-www-form-urlencoded" \\`);
            console.log(`     -d "grant_type=password" \\`);
            console.log(`     -d "client_id=sentinel-api" \\`);
            console.log(`     -d "username=admin" \\`);
            console.log(`     -d "password=admin123" | jq -r '.access_token')`);
            console.log(`\n🧪 Test with token:`);
            console.log(`   curl -X PUT http://localhost:${PORT}/unlp/padron/123 -H "Authorization: Bearer $TOKEN"`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
};

startServer();
