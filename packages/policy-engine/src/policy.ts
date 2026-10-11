import { JevTenantContext } from '@jev/shared-types';

export interface AccessPolicy {
  id: string;
  tenantId: string;
  resource: string; // "tasks/*", "alerts/*", "integrations/*"
  action: 'read' | 'write' | 'admin';
  allowedRoles: JevTenantContext['roles'];
  conditions?: Record<string, any>;
}

export class PolicyEngine {
  private policies: Map<string, AccessPolicy[]> = new Map();

  addPolicy(policy: AccessPolicy): void {
    const key = `${policy.tenantId}:${policy.resource}`;
    if (!this.policies.has(key)) {
      this.policies.set(key, []);
    }
    this.policies.get(key)!.push(policy);
  }

  canAccess(
    tenant: JevTenantContext,
    resource: string,
    action: 'read' | 'write' | 'admin'
  ): boolean {
    // Tenant isolation: strict check
    if (resource.split('/').some(part => part === '..' || part === '.' || part === '')) return false;
    const policies = this.getTenantPolicies(tenant.tenantId).filter(policy =>
      policy.resource === resource ||
      (policy.resource.endsWith('/*') && resource.startsWith(policy.resource.slice(0, -1)))
    );

    // Check if any policy allows this action
    for (const policy of policies) {
      if (policy.conditions && Object.keys(policy.conditions).length > 0) continue;
      if (policy.action !== action && policy.action !== 'admin') continue;

      const hasRole = policy.allowedRoles.some(role => tenant.roles.includes(role));
      if (hasRole) return true;
    }

    // Deny by default
    return false;
  }

  assertAccess(
    tenant: JevTenantContext,
    resource: string,
    action: 'read' | 'write' | 'admin'
  ): void {
    if (!this.canAccess(tenant, resource, action)) {
      throw new Error(`Access denied: ${action} on ${resource} for tenant ${tenant.tenantId}`);
    }
  }

  getTenantPolicies(tenantId: string): AccessPolicy[] {
    const policies: AccessPolicy[] = [];
    for (const [key, policyList] of this.policies.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        policies.push(...policyList);
      }
    }
    return policies;
  }
}

export const policyEngine = new PolicyEngine();

// Default policies (per tenant)
export function setupDefaultPolicies(tenantId: string): void {
  const defaultPolicies: AccessPolicy[] = [
    // Read-only access for viewers
    { id: 'p1', tenantId, resource: 'tasks/*', action: 'read', allowedRoles: ['viewer', 'operator', 'admin'] },
    { id: 'p2', tenantId, resource: 'alerts/*', action: 'read', allowedRoles: ['viewer', 'operator', 'admin'] },
    { id: 'p3', tenantId, resource: 'integrations/*', action: 'read', allowedRoles: ['viewer', 'operator', 'admin'] },

    // Write access for operators
    { id: 'p4', tenantId, resource: 'tasks/*', action: 'write', allowedRoles: ['operator', 'admin'] },
    { id: 'p5', tenantId, resource: 'alerts/*', action: 'write', allowedRoles: ['operator', 'admin'] },

    // Admin only
    { id: 'p6', tenantId, resource: 'policies/*', action: 'admin', allowedRoles: ['admin'] },
  ];

  for (const policy of defaultPolicies) {
    policyEngine.addPolicy(policy);
  }
}
