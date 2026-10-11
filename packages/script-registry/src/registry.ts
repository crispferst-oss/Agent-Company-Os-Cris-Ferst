import { JevScriptDefinition, JevScriptDefinitionSchema, JevTenantContext } from '@jev/shared-types';

export class ScriptRegistry {
  private scripts = new Map<string, JevScriptDefinition>();

  register(def: JevScriptDefinition): void {
    // Validate schema
    const validated = JevScriptDefinitionSchema.parse(def);
    this.scripts.set(def.id, validated);
    console.log(`[Registry] Registered script: ${def.id}`);
  }

  get(scriptId: string): JevScriptDefinition | undefined {
    return this.scripts.get(scriptId);
  }

  list(): JevScriptDefinition[] {
    return Array.from(this.scripts.values());
  }

  canExecute(scriptId: string, tenant: JevTenantContext): boolean {
    const script = this.get(scriptId);
    if (!script) return false;

    // Check permissions
    const hasPermission = script.permissions?.some(perm => {
      return tenant.roles.includes(perm.minRole);
    }) ?? true;

    return hasPermission;
  }

  delete(scriptId: string): boolean {
    return this.scripts.delete(scriptId);
  }
}

export const scriptRegistry = new ScriptRegistry();
