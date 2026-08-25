(() => {
  "use strict";

  const { Icon } = window.IQComponents;

  function readScenarioContext() {
    const params = new URLSearchParams(window.location.search);
    return {
      scenarioId: params.get("scenarioId"),
      scenarioVersion: params.get("scenarioVersion"),
      scenarioRunId: params.get("scenarioRunId"),
      formedAt: params.get("scenarioContextFormedAt") || params.get("formedAt"),
      status: params.get("scenarioStatus") || params.get("status") || "unknown",
      baselineVersion: params.get("baselineVersion"),
      baselineSnapshotId: params.get("baselineSnapshotId"),
      prototypeVersion: params.get("prototypeVersion")
    };
  }

  function isActive() {
    return readScenarioContext().scenarioId === "S003";
  }

  function ContextBadge() {
    const context = React.useMemo(readScenarioContext, []);
    const ready = Boolean(context.scenarioId && context.scenarioVersion && context.scenarioRunId);
    return <span className={"s003-iq-context " + (ready ? "ready" : "blocked")} title={ready ? `${context.scenarioVersion} · ${context.scenarioRunId}` : "S003 场景运行身份不完整"}><Icon name={ready ? "shield-check" : "shield-alert"} size={14} /><strong>{context.scenarioId || "S003"}</strong><small>{context.scenarioRunId || "运行轮次缺失"}</small></span>;
  }

  const native = window.S003IQNativeBridge || {};
  window.S003IQAdapter = Object.freeze({
    isActive,
    ContextBadge,
    resolveQuestion: native.resolveQuestion,
    prepareQueryContext: native.prepareQueryContext,
    validateQuestion: native.validateQuestion,
    materializeResult: native.materializeResult,
    verifyFixedResult: native.verifyFixedResult,
    readRuntimeContext: native.readRuntimeContext
  });
})();
