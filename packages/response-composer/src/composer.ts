import { JevResponse, JevEvidence } from '@jev/shared-types';

export class ResponseComposer {
  compose(options: {
    correlationId: string;
    status: 'success' | 'partial' | 'error';
    answer: string;
    summary?: Record<string, any>;
    evidence: JevEvidence[];
    sources: string[];
    durationMs: number;
    aiGenerated?: boolean;
  }): JevResponse {
    // Calculate confidence from evidence
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (options.evidence.length === 0) {
      confidence = 'low';
    } else {
      const avgConf = options.evidence.reduce((sum, ev) => sum + ev.source.confidence, 0) / options.evidence.length;
      if (avgConf < 0.6) confidence = 'low';
      else if (avgConf < 0.8) confidence = 'medium';
    }

    // Deduplicate sources
    const uniqueSources = Array.from(new Set(options.sources));

    return {
      correlationId: options.correlationId,
      status: options.status,
      answer: options.answer,
      summary: options.summary,
      evidence: options.evidence,
      sources: uniqueSources,
      executedAt: new Date(),
      durationMs: options.durationMs,
      aiGenerated: options.aiGenerated || false,
      confidenceLevel: confidence,
      warnings: this.generateWarnings(options.status, options.evidence),
      nextActions: this.generateNextActions(options.status, options.answer),
    };
  }

  private generateWarnings(status: string, evidence: JevEvidence[]): string[] {
    const warnings: string[] = [];

    if (status === 'partial') {
      warnings.push('Resposta parcial: alguns dados não puderam ser recuperados.');
    }

    if (evidence.length === 0) {
      warnings.push('Nenhuma evidência estruturada disponível. Resposta pode ser imprecisa.');
    }

    const staleEvidence = evidence.filter(ev => {
      if (!ev.source.ttl) return false;
      const age = Date.now() - ev.source.timestamp.getTime();
      return age > ev.source.ttl * 1000;
    });

    if (staleEvidence.length > 0) {
      warnings.push(`${staleEvidence.length} fonte(s) expirada(s). Dados podem estar desatualizados.`);
    }

    return warnings;
  }

  private generateNextActions(status: string, answer: string): string[] {
    const actions: string[] = [];

    if (status === 'partial' || status === 'error') {
      actions.push('Tentar novamente ou contactar suporte');
    }

    if (answer.includes('falha') || answer.includes('erro')) {
      actions.push('Verificar status das integrações');
    }

    if (answer.includes('crítico') || answer.includes('atrasado')) {
      actions.push('Escalar para operações');
    }

    return actions;
  }
}

export const responseComposer = new ResponseComposer();
