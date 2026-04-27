const SECURITY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bignore\s+(all\s+)?previous\s+instructions\b/i, reason: "instruction_override_attempt" },
  { pattern: /\bdisregard\s+(the\s+)?system\s+prompt\b/i, reason: "system_prompt_override_attempt" },
  { pattern: /\breveal\s+(the\s+)?system\s+prompt\b/i, reason: "system_prompt_exfiltration_attempt" },
  { pattern: /\bdeveloper\s+message\b/i, reason: "developer_prompt_reference" },
  { pattern: /\btool\s*:\s*[a-z0-9_-]+\b/i, reason: "tool_call_shaping_attempt" },
  { pattern: /\bgrant\s+(me\s+)?admin\b/i, reason: "privilege_escalation_attempt" },
  { pattern: /\bdisable\s+(security|guardrails|verification)\b/i, reason: "guardrail_bypass_attempt" },
  { pattern: /\boverride\s+(approval|permission|policy)\b/i, reason: "policy_override_attempt" }
];

export type SecurityAssessment = {
  flagged: boolean;
  reasons: string[];
};

export function detectTextSecuritySignals(text: string): SecurityAssessment {
  const normalized = text.trim();
  if (!normalized) {
    return { flagged: false, reasons: [] };
  }

  const reasons = SECURITY_PATTERNS.filter(item => item.pattern.test(normalized)).map(item => item.reason);
  return {
    flagged: reasons.length > 0,
    reasons
  };
}

export function detectObjectSecuritySignals(value: unknown): SecurityAssessment {
  const reasons = new Set<string>();

  const visit = (input: unknown) => {
    if (typeof input === "string") {
      for (const reason of detectTextSecuritySignals(input).reasons) {
        reasons.add(reason);
      }
      return;
    }
    if (Array.isArray(input)) {
      for (const item of input) visit(item);
      return;
    }
    if (input && typeof input === "object") {
      for (const nested of Object.values(input as Record<string, unknown>)) {
        visit(nested);
      }
    }
  };

  visit(value);
  return {
    flagged: reasons.size > 0,
    reasons: [...reasons]
  };
}

export function sanitizeMethodologyText(text: string): { sanitized: string; reasons: string[] } {
  const assessment = detectTextSecuritySignals(text);
  if (!assessment.flagged) {
    return { sanitized: text, reasons: [] };
  }

  let sanitized = text;
  for (const item of SECURITY_PATTERNS) {
    sanitized = sanitized.replace(item.pattern, `[filtered:${item.reason}]`);
  }

  return {
    sanitized,
    reasons: assessment.reasons
  };
}
