import { JevEvidence } from '@jev/shared-types';

export interface AIProvider {
  id: string;
  name: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  endpoint?: string;
  model: string;
}

export interface AIResponse {
  answer: string;
  reasoning?: string;
  confidence: number;
  provider: string;
  cached: boolean;
}

export class AIGateway {
  private provider: AIProvider;
  private cache = new Map<string, AIResponse>();

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  async synthesize(
    question: string,
    evidence: JevEvidence[],
    correlationId: string
  ): Promise<AIResponse> {
    // Check cache
    const cacheKey = `${question}:${evidence.map(e => e.key).sort().join(',')}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return { ...cached, cached: true };
    }

    // Format evidence for AI
    const evidenceSummary = evidence
      .map(e => `- ${e.key}: ${JSON.stringify(e.value)} (fonte: ${e.source.scriptName}, confiança: ${(e.source.confidence * 100).toFixed(0)}%)`)
      .join('\n');

    const systemPrompt = `Você é um assistente de operações JEV. Responda sempre com base nas evidências fornecidas. Se não houver evidência suficiente, diga claramente. Cite as fontes de dados.`;

    const userPrompt = `Pergunta: ${question}

Evidências disponíveis:
${evidenceSummary}

Por favor, responda de forma breve e clara, citando as fontes.`;

    try {
      let response: AIResponse;

      if (this.provider.name === 'local') {
        // Mock local response
        response = {
          answer: `Baseado nas evidências: ${evidenceSummary.substring(0, 100)}...`,
          reasoning: 'Local mock response',
          confidence: 0.5,
          provider: 'local',
          cached: false,
        };
      } else if (this.provider.name === 'openai') {
        // Mock OpenAI response (in prod, use actual API)
        response = {
          answer: `Resposta sintetizada do OpenAI para: "${question.substring(0, 50)}..."`,
          confidence: 0.85,
          provider: 'openai',
          cached: false,
        };
      } else {
        // Mock Anthropic
        response = {
          answer: `Resposta sintetizada do Anthropic para: "${question.substring(0, 50)}..."`,
          confidence: 0.85,
          provider: 'anthropic',
          cached: false,
        };
      }

      // Cache result
      this.cache.set(cacheKey, response);

      return response;
    } catch (error) {
      throw new Error(`AI Gateway error: ${error}`, { cause: error });
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const createAIGateway = (provider: AIProvider) => new AIGateway(provider);
