import { SCENARIO_MODEL_REGISTRATIONS } from '../../v1.3.0/composite/runtime/scenario-model-registrations.mjs';
import { createModelPortfolioRuntime, digest } from '../../v1.3.0/composite/runtime/model-portfolio-engine.mjs';
import { createServer } from '../../v1.3.0/composite/runtime/server.mjs';

// The inherited generic portfolios use ordinal sample scores, not calculated facts.
export function identifySynthetic(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(identifySynthetic);
  const next = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, identifySynthetic(entry)]));
  if (next.schemaVersion === 'ofw.modeling.result-envelope.v2') {
    next.dataOrigin = 'SYNTHETIC';
    next.provenance = { kind: 'DEMONSTRATION_FIXTURE', source: 'v1.3.0/scenario-model-registrations.mjs#resultSubjects', method: 'ordinal sample scores; not business evaluation', actualCalculation: false };
    if (next.resultKind === 'FACT') {
      next.resultKind = 'DEMO_BASELINE';
      next.resultId = next.resultId.replace(/^FACT-/, 'DEMO-');
      next.useKind = 'DEMONSTRATION_REFERENCE';
      next.subjects = next.subjects.map((row) => ({ ...row, score: null, confidence: null, resultStatus: 'NOT_EVALUATED', missingReasons: ['没有可追溯的实际评分，演示基准不代表正式评价。'] }));
    }
    next.actionSourceAllowed = false;
    next.factWriteAllowed = false;
    const { digest: previousDigest, ...core } = next;
    next.digest = digest(core);
  }
  return next;
}

export function createV14ModelServer() {
  const runtimes = new Map();
  for (const [id, original] of Object.entries(SCENARIO_MODEL_REGISTRATIONS)) {
    const registration = id === 'S003' ? original : Object.fromEntries(Object.entries(original).map(([key, value]) => [key, typeof value === 'function' ? (...args) => identifySynthetic(value(...args)) : identifySynthetic(value)]));
    const runtime = createModelPortfolioRuntime(registration);
    for (const action of registration.seedActions || []) runtime.action(action);
    runtimes.set(id, runtime);
  }
  return createServer({ runtimes });
}
