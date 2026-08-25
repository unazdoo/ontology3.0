(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.S003ConfigService = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATEGORY_IDS = Object.freeze(["新能源产业-风电", "核电", "环保"]);
  const RISK_TIER_IDS = Object.freeze(["GREEN", "YELLOW", "RED", "BLACK"]);
  const LIFECYCLE_STATUSES = Object.freeze(["draft", "validated", "published"]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function addError(errors, code, path, message) {
    errors.push({code, path, message});
  }

  function nextPatch(version) {
    const match = String(version || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) throw new Error("模型版本必须为 SemVer");
    return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
  }

  function createDraft(modelPackage, options) {
    if (!modelPackage || modelPackage.lifecycleStatus !== "published") {
      throw new Error("只能从 Published 模型包创建配置草稿");
    }
    const config = options || {};
    const draft = {
      schemaVersion: "ofw.s003.m01.config-draft.v1",
      draftId: config.draftId || `S003-MODEL-DRAFT-${Date.now()}`,
      lifecycleStatus: "draft",
      basedOnPackageId: modelPackage.packageId,
      basedOnVersion: modelPackage.packageVersion,
      proposedVersion: config.proposedVersion || nextPatch(modelPackage.packageVersion),
      owner: modelPackage.businessOwner,
      createdAt: config.createdAt || new Date().toISOString(),
      editable: {
        weights: clone(modelPackage.weights),
        factors: clone(modelPackage.factors),
        riskTiers: clone(modelPackage.riskTiers)
      },
      locked: {
        resourceType: modelPackage.resourceType,
        indicatorOrder: clone(modelPackage.indicatorOrder),
        formulas: clone(modelPackage.formulas),
        scoreAnchors: clone(modelPackage.scoreAnchors),
        profitStability: clone(modelPackage.profitStability),
        actionTypes: clone(modelPackage.actionTypes),
        assessment: clone(modelPackage.assessment)
      }
    };
    return draft;
  }

  function validateWeights(weights, indicatorCount, errors) {
    CATEGORY_IDS.forEach((category) => {
      const values = weights && weights[category];
      if (!Array.isArray(values) || values.length !== indicatorCount) {
        addError(errors, "INVALID_WEIGHT_SHAPE", `editable.weights.${category}`, `必须包含 ${indicatorCount} 项权重`);
        return;
      }
      values.forEach((value, index) => {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
          addError(errors, "INVALID_WEIGHT", `editable.weights.${category}[${index}]`, "权重必须是 0—100 的有限数值");
        }
      });
      const sum = values.reduce((total, value) => total + Number(value || 0), 0);
      if (Math.abs(sum - 100) > 1e-9) {
        addError(errors, "WEIGHT_SUM_NOT_100", `editable.weights.${category}`, `权重合计必须为100，当前为 ${sum}`);
      }
    });
    Object.keys(weights || {}).forEach((category) => {
      if (!CATEGORY_IDS.includes(category)) {
        addError(errors, "UNKNOWN_WEIGHT_CATEGORY", `editable.weights.${category}`, "一期不允许新增行业权重组");
      }
    });
  }

  function validateFactors(factors, errors) {
    if (!Array.isArray(factors) || factors.length !== 6) {
      addError(errors, "INVALID_FACTOR_COUNT", "editable.factors", "一期固定为6项调节因子，不允许新增或删除");
      return;
    }
    const factorIds = new Set();
    factors.forEach((factor, factorIndex) => {
      const path = `editable.factors[${factorIndex}]`;
      if (!factor || typeof factor.factorId !== "string" || factorIds.has(factor.factorId)) {
        addError(errors, "INVALID_FACTOR_ID", `${path}.factorId`, "因子 ID 必须非空且唯一");
      }
      factorIds.add(factor && factor.factorId);
      if (!Array.isArray(factor.tiers) || factor.tiers.length === 0) {
        addError(errors, "EMPTY_FACTOR_TIERS", `${path}.tiers`, "因子至少保留一个固定档位");
        return;
      }
      const tierIds = new Set();
      factor.tiers.forEach((tier, tierIndex) => {
        const tierPath = `${path}.tiers[${tierIndex}]`;
        if (!tier || typeof tier.tierId !== "string" || tierIds.has(tier.tierId)) {
          addError(errors, "INVALID_FACTOR_TIER_ID", `${tierPath}.tierId`, "档位 ID 必须非空且唯一");
        }
        tierIds.add(tier && tier.tierId);
        if (typeof tier.coefficient !== "number" || !Number.isFinite(tier.coefficient) || tier.coefficient < -1 || tier.coefficient > 1) {
          addError(errors, "INVALID_FACTOR_COEFFICIENT", `${tierPath}.coefficient`, "系数必须是 -1—1 的有限数值");
        }
      });
    });
  }

  function validateRiskTiers(riskTiers, errors) {
    if (!Array.isArray(riskTiers) || riskTiers.length !== 4) {
      addError(errors, "INVALID_RISK_TIER_COUNT", "editable.riskTiers", "一期固定为绿、黄、红、黑四档");
      return;
    }
    const byId = Object.fromEntries(riskTiers.map((tier) => [tier.tierId, tier]));
    RISK_TIER_IDS.forEach((tierId) => {
      if (!byId[tierId]) addError(errors, "MISSING_RISK_TIER", `editable.riskTiers.${tierId}`, "不得删除固定风险档");
    });
    if (errors.some((error) => error.code === "MISSING_RISK_TIER")) return;
    const blackMin = byId.BLACK.minInclusive;
    const redMin = byId.RED.minInclusive;
    const yellowMin = byId.YELLOW.minInclusive;
    const greenMin = byId.GREEN.minInclusive;
    [blackMin, redMin, yellowMin, greenMin].forEach((value, index) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        addError(errors, "INVALID_RISK_BOUNDARY", `editable.riskTiers[${index}].minInclusive`, "风险边界必须是有限数值");
      }
    });
    if (blackMin !== 0) addError(errors, "BLACK_MIN_NOT_ZERO", "editable.riskTiers.BLACK.minInclusive", "黑档下界必须固定为0");
    if (!(0 < redMin && redMin < yellowMin && yellowMin < greenMin && greenMin <= 100)) {
      addError(errors, "RISK_BOUNDARY_ORDER", "editable.riskTiers", "必须满足 0 < 红 < 黄 < 绿 <= 100");
    }
    const expectedMax = {BLACK: redMin, RED: yellowMin, YELLOW: greenMin, GREEN: null};
    RISK_TIER_IDS.forEach((tierId) => {
      if (byId[tierId].maxExclusive !== expectedMax[tierId]) {
        addError(errors, "RISK_BOUNDARY_GAP_OR_OVERLAP", `editable.riskTiers.${tierId}.maxExclusive`, "相邻风险档必须无空档、无重叠");
      }
    });
  }

  function validateDraft(draft) {
    const errors = [];
    if (!draft || !LIFECYCLE_STATUSES.includes(draft.lifecycleStatus) || draft.lifecycleStatus === "published") {
      addError(errors, "INVALID_DRAFT_STATUS", "lifecycleStatus", "只接受 draft 或 validated 配置草稿");
      return {ok: false, errors};
    }
    const indicatorCount = draft.locked && Array.isArray(draft.locked.indicatorOrder) ? draft.locked.indicatorOrder.length : 0;
    if (indicatorCount !== 15) addError(errors, "INVALID_INDICATOR_COUNT", "locked.indicatorOrder", "一期必须锁定15项指标");
    validateWeights(draft.editable && draft.editable.weights, indicatorCount, errors);
    validateFactors(draft.editable && draft.editable.factors, errors);
    validateRiskTiers(draft.editable && draft.editable.riskTiers, errors);
    return {
      ok: errors.length === 0,
      errors,
      validationStatus: errors.length === 0 ? "validated" : "rejected"
    };
  }

  function markValidated(draft, options) {
    const validation = validateDraft(draft);
    if (!validation.ok) return {draft: clone(draft), validation};
    const value = clone(draft);
    value.lifecycleStatus = "validated";
    value.validatedAt = (options && options.validatedAt) || new Date().toISOString();
    return {draft: value, validation};
  }

  function publishDraft(validatedDraft, basePackage, options) {
    if (!validatedDraft || validatedDraft.lifecycleStatus !== "validated") {
      throw new Error("Draft 未通过校验，不能发布");
    }
    if (!basePackage || validatedDraft.basedOnPackageId !== basePackage.packageId || validatedDraft.basedOnVersion !== basePackage.packageVersion) {
      throw new Error("Draft 与基础 Published 模型包不匹配");
    }
    const validation = validateDraft(validatedDraft);
    if (!validation.ok) throw new Error(`Draft 校验失败: ${validation.errors.map((error) => error.code).join(",")}`);
    const config = options || {};
    const published = clone(basePackage);
    published.packageVersion = validatedDraft.proposedVersion;
    published.lifecycleStatus = "published";
    published.weights = clone(validatedDraft.editable.weights);
    published.factors = clone(validatedDraft.editable.factors);
    published.riskTiers = clone(validatedDraft.editable.riskTiers);
    published.provenance = {
      ...(published.provenance || {}),
      basedOnVersion: basePackage.packageVersion,
      sourceDraftId: validatedDraft.draftId,
      publishedAt: config.publishedAt || new Date().toISOString(),
      publishedByOwner: basePackage.businessOwner
    };
    return deepFreeze(published);
  }

  return Object.freeze({
    CATEGORY_IDS,
    RISK_TIER_IDS,
    createDraft,
    validateDraft,
    markValidated,
    publishDraft
  });
});
