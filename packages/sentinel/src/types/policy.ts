/**
 * Sentinel Gate — Core authorization types
 *
 * This module defines the generic, domain-agnostic interfaces used by
 * Sentinel Gate for authorization decisions.
 *
 * The model combines:
 *  - RBAC  → role-based access control (simple role matching)
 *  - ABAC  → attribute-based access control using JSON Logic
 */

/**
 * Represents the actor performing the action.
 * Applications may extend this structure with any domain attributes
 * such as tenantId, teamIds, department, subscriptionLevel, etc.
 */
export interface Subject {
    /** Unique identifier of the subject (e.g., user ID, username) */
    sub: string;

    /** Roles assigned to the subject (e.g., ["admin", "editor", "player"]) */
    roles: string[];

    /** Additional arbitrary attributes */
    [key: string]: any;
}

/**
 * Represents the resource on which the action is being performed.
 * Consumers may attach domain-specific fields such as id, projectId, courtId, etc.
 */
export interface Resource {
    /** Type of the resource (e.g., "document", "court", "booking") */
    type: string;

    /** Additional attributes describing the resource */
    [key: string]: any;
}

/**
 * Provides contextual information about the request or environment.
 * Common uses: app identifier, tenant context, feature flags, or
 * computed conditions like "canCancel" or "isEligible".
 */
export interface Context {
    [key: string]: any;
}

/**
 * Standard request format evaluated by Sentinel Gate.
 */
export interface DecisionRequest {
    /** The subject (actor) attempting the action */
    subject: Subject;

    /** The action being attempted (e.g., "booking:create", "user:delete") */
    action: string;

    /** The target resource */
    resource: Resource;

    /** Optional contextual data available during evaluation */
    context?: Context;
}

/**
 * Response returned after evaluating policies.
 */
export interface DecisionResponse {
    /** True if access is granted, false if denied */
    allow: boolean;

    /** Human-readable reason for audit and debugging */
    reason: string;

    /** ID of the policy that matched, if any */
    matchedPolicyId?: string;
}

/**
 * Declarative policy definition used by Sentinel Gate.
 *
 * Policies are evaluated in order until one matches both the RBAC and ABAC conditions.
 *
 * RBAC: simple role matching
 * ABAC: attribute-based evaluation expressed with JSON Logic syntax
 *       https://jsonlogic.com/
 */
export interface Policy {
    /** Unique identifier of the policy */
    id: string;

    /** Description of the rule (for readability and logging) */
    description: string;

    /** List of actions covered by this policy, or ["*"] for wildcard */
    actions: string[];

    /**
     * Optional RBAC restriction: if present, the subject must satisfy
     * at least one of the declared roles to continue to ABAC evaluation.
     */
    rbac?: {
        /** Allow if subject has at least one of these roles */
        anyRole?: string[];

        /** (Reserved) Require all of these roles — not currently enforced */
        allRoles?: string[];
    };

    /**
     * ABAC: Attribute-Based Access Control rule expressed with JSON Logic.
     * The rule is evaluated against the complete DecisionRequest object.
     *
     * Example:
     * {
     *   "and": [
     *     { "==": [ { "var": "context.app" }, "core" ] },
     *     { "==": [ { "var": "resource.ownerId" }, { "var": "subject.sub" } ] }
     *   ]
     * }
     */
    abac?: Record<string, any>;
}
