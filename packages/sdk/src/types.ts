export interface DecisionRequest {
    subject: Record<string, any>;
    action: string;
    resource: Record<string, any>;
    context?: Record<string, any>;
}

export interface DecisionResponse {
    allow: boolean;
    reason: string;
    matchedPolicyId?: string;
}
