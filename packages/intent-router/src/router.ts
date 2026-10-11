import { JevIntent } from '@jev/shared-types';

export interface RouterRule {
  id: string;
  keywords: string[];
  regex?: RegExp;
  scripts: string[];
  requiresAI: boolean;
  priority: number;
}

export class IntentRouter {
  private rules: RouterRule[] = [];

  addRule(rule: RouterRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  route(question: string): JevIntent {
    const lowerQ = question.toLowerCase();
    const matched: { rule: RouterRule; matchedKeywords: string[]; matchedRegex?: string }[] = [];

    for (const rule of this.rules) {
      // Check keywords
      const matchedKeywords = rule.keywords.filter(kw => lowerQ.includes(kw.toLowerCase()));
      if (matchedKeywords.length > 0) {
        matched.push({ rule, matchedKeywords });
      }

      // Check regex
      if (rule.regex) {
        const regexMatch = question.match(rule.regex);
        if (regexMatch) {
          matched.push({ rule, matchedKeywords: [], matchedRegex: rule.regex.toString() });
        }
      }
    }

    if (matched.length > 0) {
      // Sort by rule priority
      matched.sort((a, b) => a.rule.priority - b.rule.priority);
      const top = matched[0];

      return {
        type: top.rule.requiresAI ? 'requires_synthesis' : 'deterministic',
        confidence: 0.95,
        scripts: top.rule.scripts,
        aiGatewayNeeded: top.rule.requiresAI,
        matchedKeywords: top.matchedKeywords,
      };
    }

    // Fallback: ambiguous, might need semantic routing
    return {
      type: 'ambiguous',
      confidence: 0.3,
      scripts: [],
      aiGatewayNeeded: true,
      reason: 'No deterministic route found',
    };
  }
}

export const intentRouter = new IntentRouter();
