export * from './read-only-scripts';
export * from './write-scripts';

export const SCRIPT_REGISTRY = {
  // Read-only
  'tasks.get_overdue': { category: 'read', cacheTTL: 30000 },
  'tasks.get_by_owner': { category: 'read', cacheTTL: 30000 },
  'alerts.get_active': { category: 'read', cacheTTL: 15000 },
  'alerts.get_by_severity': { category: 'read', cacheTTL: 15000 },
  'integrations.get_health': { category: 'read', cacheTTL: 60000 },
  'integrations.get_failed_deliveries': { category: 'read', cacheTTL: 30000 },
  'flows.get_health': { category: 'read', cacheTTL: 45000 },
  'flows.get_failed_runs': { category: 'read', cacheTTL: 45000 },
  'graph.get_entity_neighbors': { category: 'read', cacheTTL: 120000 },
  'graph.get_dependencies': { category: 'read', cacheTTL: 120000 },
  'graph.find_bottlenecks': { category: 'read', cacheTTL: 300000 },
  'analytics.get_sla_summary': { category: 'read', cacheTTL: 60000 },
  'analytics.get_kpis': { category: 'read', cacheTTL: 60000 },
  'knowledge.search_approved': { category: 'read', cacheTTL: 300000 },
  'events.get_recent': { category: 'read', cacheTTL: 10000 },

  // Write
  'tasks.create': { category: 'write', requiresApproval: true },
  'alerts.create': { category: 'write', requiresApproval: true },
  'flows.trigger': { category: 'write', requiresApproval: true },
  'integrations.retry_webhook': { category: 'write', requiresApproval: true },
  'notifications.send': { category: 'write', requiresApproval: true },
};
