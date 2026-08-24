'use strict';

const { isRecord, clone, immutable, fail, findForbiddenKeys } = require('./util');

const INJECTION_PATTERNS = Object.freeze([
  { code: 'IGNORE_INSTRUCTIONS', regex: /\b(ignore|disregard|forget|override|bypass)\b.{0,80}\b(previous|prior|system|developer|safety|instructions?|rules?)\b/i },
  { code: 'IGNORE_INSTRUCTIONS_ZH', regex: /(?:忽略|无视|忘记|覆盖).{0,16}(?:之前|上面|系统|开发者).{0,16}(?:指令|提示|规则|消息)/i },
  { code: 'ROLE_SPOOFING', regex: /\b(system|developer|assistant)\s*(message|prompt|instruction)\b\s*[:=]/i },
  { code: 'PROMPT_EXTRACTION', regex: /\b(reveal|show|print|dump| disclose|repeat)\b.{0,80}\b(system prompt|hidden prompt|secret instructions|chain of thought)\b/i },
  { code: 'TOOL_ESCALATION', regex: /\b(call|invoke|use|run|execute)\b.{0,80}\b(tool|function|api|shell|sql|database|file|filesystem)\b/i },
  { code: 'DATA_EXFILTRATION', regex: /\b(read|fetch|send|upload|export|copy)\b.{0,80}\b(workbook|spreadsheet|xlsx|t002|t007|raw data|database|secret|credential)\b/i },
  { code: 'POLICY_OVERRIDE', regex: /\b(pretend|act as|roleplay|simulate)\b.{0,80}\b(admin|root|owner|authorized|unrestricted)\b/i },
  { code: 'ROLE_SPOOFING_ZH', regex: /(?:你现在是|请充当|扮演|新的系统消息|开发者消息)/i },
  { code: 'PROMPT_EXTRACTION_ZH', regex: /(?:泄露|输出|打印|展示|告诉我).{0,16}(?:系统提示|开发者提示|隐藏提示|秘密|密钥|内部指令)/i },
  { code: 'TOOL_ESCALATION_ZH', regex: /(?:执行|调用|运行).{0,10}(?:工具|函数|命令|脚本)/i },
  { code: 'DELIMITER_ESCAPE', regex: /```(?:system|developer|tool)|<\/?(?:system|developer|tool|instructions?)>|\[\[(?:system|tool)\]\]/i }
]);

const HIGH_RISK_TERMS = Object.freeze([
  'workbook', 'spreadsheet', 'xlsx', 'xls', 't002', 't007', 'sql', 'database', 'filesystem', 'shell',
  'execute action', 'create todo', 'publish report', 'switch t019', 'change ontology', 'ignore previous'
]);

function scanPromptInjection(value, options = {}) {
  let text;
  try { text = typeof value === 'string' ? value : JSON.stringify(value ?? ''); }
  catch (_) { return immutable({ detected: true, matches: [{ code: 'UNSERIALIZABLE_INPUT' }], risk: 'high' }); }
  const matches = [];
  INJECTION_PATTERNS.forEach((pattern) => {
    const match = pattern.regex.exec(text);
    if (match) matches.push({ code: pattern.code, ...(options.includeEvidence ? { excerpt: redactExcerpt(text, match.index, match[0].length) } : {}) });
  });
  const lower = text.toLowerCase();
  const highRisk = HIGH_RISK_TERMS.filter((term) => lower.includes(term));
  if (highRisk.length && options.allowEvidenceTerms !== true) {
    // Evidence metadata may legitimately contain a T008/data version label;
    // the caller can opt into evidence-only scanning. User instructions still
    // go through the pattern scan above.
    highRisk.forEach((term) => {
      if (!matches.some((entry) => entry.code === 'DATA_EXFILTRATION' && entry.excerpt.toLowerCase().includes(term))) {
        matches.push({ code: 'PROHIBITED_DATA_TERM', term });
      }
    });
  }
  return immutable({ detected: matches.length > 0, matches, risk: matches.length > 0 ? (matches.length > 1 ? 'high' : 'medium') : 'none' });
}

function redactExcerpt(text, index, length) {
  const start = Math.max(0, index - 32);
  const end = Math.min(text.length, index + length + 32);
  return text.slice(start, end).replace(/[\r\n\t]+/g, ' ').trim();
}

function assertSafePrompt(value, options = {}) {
  const scan = scanPromptInjection(value, options);
  if (scan.detected) fail('PROMPT_INJECTION', 'prompt or user instruction was rejected by the M05 safety boundary', scan);
  return true;
}

function sanitizePrompt(value, options = {}) {
  if (typeof value !== 'string') fail('PROMPT_INVALID', 'prompt must be a string');
  const normalized = value.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
  assertSafePrompt(normalized, options);
  return normalized;
}

function sanitizeUserQuestion(value) {
  return sanitizePrompt(value, { allowEvidenceTerms: false });
}

function sanitizeStructuredInput(value, options = {}) {
  if (typeof value === 'string') return sanitizePrompt(value, options);
  if (Array.isArray(value)) return value.map((item) => sanitizeStructuredInput(item, options));
  if (!isRecord(value)) return value;
  const forbidden = findForbiddenKeys(value);
  if (forbidden.length) fail('FORBIDDEN_INPUT', 'structured input contains prohibited business detail or side-effect fields', { fields: forbidden });
  const result = {};
  Object.keys(value).forEach((key) => {
    const item = value[key];
    // Fixed evidence strings can contain labels such as T007. They remain
    // opaque metadata; only free-form prompt/question fields are scanned.
    const scan = /prompt|question|instruction|message|text|content|request/i.test(key);
    result[key] = typeof item === 'string' && scan ? sanitizePrompt(item, options) : sanitizeStructuredInput(item, options);
  });
  return result;
}

function safeSystemPrompt(systemPrompt, releasePrompt) {
  if (!systemPrompt && !releasePrompt) fail('PROMPT_MISSING', 'a fixed system prompt reference/content is required');
  const value = systemPrompt || releasePrompt;
  assertSafePrompt(value, { allowEvidenceTerms: true });
  return sanitizePrompt(value, { allowEvidenceTerms: true });
}

module.exports = Object.freeze({
  INJECTION_PATTERNS, HIGH_RISK_TERMS, scanPromptInjection, detectPromptInjection: scanPromptInjection,
  assertSafePrompt, sanitizePrompt, sanitizeUserQuestion, sanitizeStructuredInput, safeSystemPrompt
});
