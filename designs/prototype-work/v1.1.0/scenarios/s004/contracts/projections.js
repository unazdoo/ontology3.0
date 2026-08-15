(function () {
  "use strict";

  function statusRank(status) {
    return {
      blocked: 5,
      running: 4,
      pending: 3,
      not_applicable: 2,
      verified: 1
    }[status] || 3;
  }

  function buildProjection(state, data) {
    const steps = {};
    data.workflow.forEach(function (step) {
      const saved = state.steps[step.id] || {};
      const status = saved.status || step.initialStatus || "pending";
      steps[step.id] = Object.freeze({
        id: step.id,
        moduleId: step.moduleId,
        title: step.title,
        status: status,
        satisfied: status === "verified" || status === "not_applicable",
        updatedAt: saved.updatedAt || null,
        detail: saved.detail || step.summary,
        evidenceRef: saved.evidenceRef || null
      });
    });

    const modules = {};
    data.modules.forEach(function (module) {
      const records = module.steps.map(function (stepId) { return steps[stepId]; }).filter(Boolean);
      const verified = records.filter(function (record) { return record.status === "verified"; }).length;
      const notApplicable = records.filter(function (record) { return record.status === "not_applicable"; }).length;
      const blocked = records.filter(function (record) { return record.status === "blocked"; }).length;
      const running = records.filter(function (record) { return record.status === "running"; }).length;
      const status = records.map(function (record) { return record.status; }).sort(function (left, right) {
        return statusRank(right) - statusRank(left);
      })[0] || "pending";
      modules[module.id] = Object.freeze({
        moduleId: module.id,
        verified: verified,
        notApplicable: notApplicable,
        satisfied: verified + notApplicable,
        total: records.length,
        blocked: blocked,
        running: running,
        status: status,
        complete: records.length > 0 && verified + notApplicable === records.length
      });
    });

    const satisfiedCount = Object.values(steps).filter(function (step) { return step.satisfied; }).length;
    const nextStep = data.workflow.find(function (step) {
      return !steps[step.id].satisfied && steps[step.id].status !== "blocked";
    }) || null;

    return Object.freeze({
      steps: Object.freeze(steps),
      modules: Object.freeze(modules),
      satisfiedCount: satisfiedCount,
      total: data.workflow.length,
      nextStepId: nextStep ? nextStep.id : null,
      hasPublishedReport: steps.publishReport && steps.publishReport.status === "verified",
      hasHumanDecision: Boolean(state.humanDecision && state.humanDecision.status === "confirmed"),
      external: state.external || {}
    });
  }

  window.S004Projections = Object.freeze({
    buildProjection: buildProjection
  });
})();
