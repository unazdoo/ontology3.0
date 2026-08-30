export const NAMESPACE = "ofw.m08.research.v1";
export const DEFAULT_PORT = 4357;

export const RESULT_KINDS = Object.freeze({
  FACT: "FACT",
  PREDICTION: "PREDICTION",
  SIMULATION: "SIMULATION"
});

export const FORBIDDEN_CAPABILITIES = Object.freeze([
  "actionRequest",
  "notification",
  "approval",
  "todo",
  "transaction",
  "webhook",
  "schedule",
  "extendedFunction"
]);

export const SIMULATION_CAPABILITIES = Object.freeze(
  Object.fromEntries(FORBIDDEN_CAPABILITIES.map((name) => [name, false]))
);
