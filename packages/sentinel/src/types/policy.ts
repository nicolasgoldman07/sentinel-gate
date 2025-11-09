export interface Subject {
    sub: string;
    roles: string[];
    uaIds?: string[];
    ucIds?: string[];
    [key: string]: any;
}

export interface Resource {
    type: string;
    uaId?: string;
    ucId?: string;
    status?: string;
    [key: string]: any;
}

export interface Context {
    [key: string]: any;
}

export interface DecisionRequest {
    subject: Subject;
    action: string;
    resource: Resource;
    context?: Context;
}

export interface DecisionResponse {
    allow: boolean;
    reason: string;
    matchedPolicyId?: string;
}

export interface Policy {
    id: string;
    description: string;
    actions: string[];
    rbac?: {
        anyRole?: string[];
        allRoles?: string[];
    };
    logic?: Record<string, any>;
}


export type Condition =
    | { eq: [string, string] }
    | { includes: [string, string] }
    | { ne: [string, string] }
    | { in: [string, string[]] };
