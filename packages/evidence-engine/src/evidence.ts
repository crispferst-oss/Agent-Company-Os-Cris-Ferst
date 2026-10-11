import { JevEvidence, JevSource, JevEvidenceSchema } from '@jev/shared-types';

export class EvidenceEngine {
  private evidence: Map<string, JevEvidence[]> = new Map();

  addEvidence(correlationId: string, ev: Omit<JevEvidence, 'id'>): JevEvidence {
    const evidence: JevEvidence = {
      ...ev,
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    };

    const validated = JevEvidenceSchema.parse(evidence);

    if (!this.evidence.has(correlationId)) {
      this.evidence.set(correlationId, []);
    }
    this.evidence.get(correlationId)!.push(validated);

    return validated;
  }

  getEvidence(correlationId: string): JevEvidence[] {
    return this.evidence.get(correlationId) || [];
  }

  getSummary(correlationId: string): Record<string, any> {
    const evidence = this.getEvidence(correlationId);
    const summary: Record<string, any> = {};

    for (const ev of evidence) {
      if (ev.type === 'metric') {
        summary[ev.key] = ev.value;
      }
    }

    return summary;
  }

  getSources(correlationId: string): string[] {
    const evidence = this.getEvidence(correlationId);
    const sources = new Set<string>();

    for (const ev of evidence) {
      if (ev.source.scriptName) {
        sources.add(ev.source.scriptName);
      }
      if (ev.source.type) {
        sources.add(ev.source.type);
      }
    }

    return Array.from(sources);
  }

  getConfidence(correlationId: string): number {
    const evidence = this.getEvidence(correlationId);
    if (evidence.length === 0) return 0;

    const avgConfidence = evidence.reduce((sum, ev) => sum + ev.source.confidence, 0) / evidence.length;
    return Math.min(1, avgConfidence);
  }

  clear(correlationId: string): void {
    this.evidence.delete(correlationId);
  }
}

export const evidenceEngine = new EvidenceEngine();
