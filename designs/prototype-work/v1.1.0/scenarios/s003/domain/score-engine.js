(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.S003ScoreEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ENGINE_VERSION = "1.0.0";
  const C035_SCHEMA_VERSION = "ofw.s003.c035.assessment-result.v1";
  const REPORT_SCHEMA_VERSION = "ofw.s003.enterprise-report-data.v1";
  const PORTFOLIO_SCHEMA_VERSION = "ofw.s003.portfolio-assessment.v1";

  const SUPPORTED_INDUSTRIES = new Set(["新能源产业-风电", "核电", "环保", "在建企业"]);
  const INDUSTRY_ALIASES = Object.freeze({
    风电: "新能源产业-风电",
    新能源: "新能源产业-风电",
    新能源产业: "新能源产业-风电",
    环境保护: "环保",
    在建: "在建企业"
  });

  const FACTOR_NAME_ALIASES = Object.freeze({
    融资能力: "融资能力（已用授信余额/授信总额）",
    股东支持程度: "总部支持程度",
    获得担保情况: "担保情况",
    电价波动性: "电价波动率",
    "3个月内是否有资金缺口": "资金余缺预警"
  });

  // Workbook labels are business input values. The published package keeps stable tier IDs.
  const FACTOR_TIER_ALIASES = Object.freeze({
    "credit-utilization": Object.freeze({
      良好: "ZERO",
      一般: "MID",
      较差: "HIGH",
      极强: "ZERO",
      强: "ZERO",
      弱: "HIGH",
      极弱: "HIGH"
    }),
    guarantee: Object.freeze({
      未涉及担保: "ZERO",
      仅提供担保: "EXTERNAL",
      仅获得担保: "RECEIVED",
      仅接受担保: "RECEIVED",
      充分: "RECEIVED",
      一般: "ZERO",
      不足: "EXTERNAL"
    }),
    "headquarters-support": Object.freeze({
      高: "FULL",
      较高: "HIGH",
      中: "ZERO",
      较低: "LOW",
      低: "VERY_LOW",
      强: "FULL",
      一般: "ZERO",
      弱: "VERY_LOW"
    }),
    "electricity-price": Object.freeze({
      "电价变化率小于等于-15%": "LOW",
      "电价变化率大于-15%且小于等于0": "MID",
      "电价变化率小于等于0且大于-15%": "MID",
      电价变化率大于0: "ZERO",
      低: "ZERO",
      中: "MID",
      高: "LOW",
      极高: "LOW"
    }),
    litigation: Object.freeze({
      无重大诉讼: "ZERO",
      "诉讼标的小于净资产1%": "ZERO",
      一般性诉讼: "MID",
      "诉讼标的为净资产1%至5%": "MID",
      重大诉讼: "HIGH",
      "诉讼标的大于净资产5%": "HIGH"
    }),
    "fund-gap": Object.freeze({
      无资金缺口: "ZERO",
      无缺口: "ZERO",
      当月资金余缺预警: "CURRENT",
      未来第一个月资金余缺预警: "M1",
      未来第二个月资金余缺预警: "M2",
      未来第三个月资金余缺预警: "M3",
      小额缺口: "M2",
      较大缺口: "CURRENT"
    })
  });

  const MAJOR_FACTOR_TOKENS = Object.freeze({
    "litigation:HIGH": "重大诉讼",
    "fund-gap:CURRENT": "当月资金余缺预警"
  });

  const FINANCIAL_FIELDS = Object.freeze([
    "流动负债合计_年初余额",
    "流动负债合计_期末余额",
    "营业总收入_本年累计数",
    "营业利润_本年累计数",
    "净利润_本年累计数",
    "交易性金融资产_期末余额",
    "利润总额_上年同期累计数",
    "利润总额_本年累计数",
    "存货_期末余额",
    "存货_年初余额",
    "实收资本（股本）_期末余额",
    "应收账款_期末余额",
    "应收账款_年初余额",
    "所有者权益（或股东权益）合计_期末余额",
    "所有者权益（或股东权益）合计_年初余额",
    "流动资产合计_期末余额",
    "经营活动产生的现金流量净额_本年累计数",
    "经营活动现金流入小计_本年累计数",
    "营业成本_本年累计数",
    "负债合计_期末余额",
    "财务费用_本年累计数",
    "货币资金_期末余额",
    "资产总计_期末余额",
    "资产总计_年初余额(上年)",
    "利润总额_上年同期累计数(上年)",
    "利润总额_本年累计数(上年)"
  ]);

  class S003ScoringError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = "S003ScoringError";
      this.code = code;
      this.details = details || null;
    }
  }

  function fail(code, message, details) {
    throw new S003ScoringError(code, message, details);
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function stableToken(value, fallback) {
    const token = String(value == null ? "" : value).trim().replace(/[^A-Za-z0-9._-]+/g, "-");
    return token || fallback;
  }

  function normalizeIndustry(category) {
    const value = String(category == null ? "" : category).trim();
    const normalized = INDUSTRY_ALIASES[value] || value;
    if (!SUPPORTED_INDUSTRIES.has(normalized)) {
      fail("S003_UNSUPPORTED_INDUSTRY", `不支持的企业类别：${value || "（空）"}`, { category: value });
    }
    return normalized;
  }

  function asFiniteNumber(value, field, options) {
    const opts = options || {};
    if (value === null || value === undefined || value === "") {
      if (opts.required) fail("S003_MISSING_REQUIRED_VALUE", `${field}不能为空`, { field });
      return null;
    }
    if (typeof value === "boolean" || (typeof value !== "number" && typeof value !== "string")) {
      fail("S003_INVALID_NUMERIC_VALUE", `${field}必须是有限数值`, { field, value });
    }
    const number = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(number)) {
      fail("S003_INVALID_NUMERIC_VALUE", `${field}必须是有限数值`, { field, value });
    }
    if (opts.min !== undefined && number < opts.min) {
      fail("S003_VALUE_OUT_OF_RANGE", `${field}低于允许下限`, { field, value: number, min: opts.min });
    }
    if (opts.max !== undefined && number > opts.max) {
      fail("S003_VALUE_OUT_OF_RANGE", `${field}高于允许上限`, { field, value: number, max: opts.max });
    }
    return number;
  }

  function decomposePositiveDouble(value) {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, value, false);
    const high = view.getUint32(0, false);
    const low = view.getUint32(4, false);
    const exponentBits = (high >>> 20) & 0x7ff;
    const fraction = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
    if (exponentBits === 0) return { significand: fraction, exponent: -1074 };
    return {
      significand: (1n << 52n) | fraction,
      exponent: exponentBits - 1023 - 52
    };
  }

  function roundRationalHalfEven(numerator, denominator) {
    const quotient = numerator / denominator;
    const remainder = numerator % denominator;
    const doubled = remainder * 2n;
    if (doubled < denominator) return quotient;
    if (doubled > denominator) return quotient + 1n;
    return quotient % 2n === 0n ? quotient : quotient + 1n;
  }

  // Exact IEEE-754 rational rounding keeps parity with Python round for the
  // positive ndigits used by the legacy scoring pipeline (including 2.675).
  function roundHalfEven(value, digits) {
    const number = asFiniteNumber(value, "round(value)", { required: true });
    const places = digits === undefined ? 0 : asFiniteNumber(digits, "round(digits)", { required: true });
    if (!Number.isInteger(places) || places < -15 || places > 15) {
      fail("S003_ROUND_DIGITS_OUT_OF_RANGE", "舍入位数必须是 -15 至 15 的整数", { digits });
    }
    if (number === 0) return number;
    const sign = number < 0 ? -1 : 1;
    const parts = decomposePositiveDouble(Math.abs(number));
    let numerator = parts.significand;
    let denominator = 1n;
    if (places >= 0) {
      numerator *= 5n ** BigInt(places);
      const exponent = parts.exponent + places;
      if (exponent >= 0) numerator <<= BigInt(exponent);
      else denominator <<= BigInt(-exponent);
      const rounded = roundRationalHalfEven(numerator, denominator);
      return sign * (Number(rounded) / (10 ** places));
    }
    const magnitude = -places;
    denominator = 5n ** BigInt(magnitude);
    const exponent = parts.exponent - magnitude;
    if (exponent >= 0) numerator <<= BigInt(exponent);
    else denominator <<= BigInt(-exponent);
    const rounded = roundRationalHalfEven(numerator, denominator);
    return sign * (Number(rounded) * (10 ** magnitude));
  }

  function clamp(value, min, max) {
    const number = asFiniteNumber(value, "clamp(value)", { required: true });
    const lower = asFiniteNumber(min, "clamp(min)", { required: true });
    const upper = asFiniteNumber(max, "clamp(max)", { required: true });
    if (lower > upper) fail("S003_INVALID_CLAMP_RANGE", "clamp下限不能高于上限", { min, max });
    return Math.min(Math.max(number, lower), upper);
  }

  function safeDivide(numerator, denominator) {
    if (numerator === null || denominator === null || denominator === 0) return null;
    const result = numerator / denominator;
    if (!Number.isFinite(result)) {
      fail("S003_NON_FINITE_CALCULATION", "指标计算产生非有限数值", { numerator, denominator });
    }
    return result;
  }

  function validateModelPackage(modelPackage, options) {
    const opts = options || {};
    if (!isObject(modelPackage)) fail("S003_INVALID_MODEL_PACKAGE", "模型包必须是对象");
    if ((opts.requirePublished !== false) && modelPackage.lifecycleStatus !== "published") {
      fail("S003_MODEL_NOT_PUBLISHED", "只有 Published 模型包可执行评分", {
        lifecycleStatus: modelPackage.lifecycleStatus || null
      });
    }
    if (!Array.isArray(modelPackage.indicatorOrder) || modelPackage.indicatorOrder.length !== 15) {
      fail("S003_INVALID_INDICATOR_ORDER", "模型包必须定义且仅定义15项指标");
    }
    if (new Set(modelPackage.indicatorOrder).size !== 15) {
      fail("S003_INVALID_INDICATOR_ORDER", "15项指标不得重复");
    }

    const warnings = [];
    for (const industry of ["新能源产业-风电", "核电", "环保"]) {
      const weights = modelPackage.weights && modelPackage.weights[industry];
      if (!Array.isArray(weights) || weights.length !== 15) {
        fail("S003_INVALID_WEIGHT_CONFIG", `${industry}必须配置15项评分权重`, { industry });
      }
      const normalizedWeights = weights.map((weight, index) => asFiniteNumber(
        weight,
        `${industry}.${modelPackage.indicatorOrder[index]}.weight`,
        { required: true, min: 0, max: 100 }
      ));
      const weightSum = normalizedWeights.reduce((sum, value) => sum + value, 0);
      if (Math.abs(weightSum - 100) > 1e-8) {
        fail("S003_INVALID_WEIGHT_TOTAL", `${industry}评分权重合计必须为100`, { industry, weightSum });
      }

      const anchorsByIndicator = modelPackage.scoreAnchors && modelPackage.scoreAnchors[industry];
      if (!isObject(anchorsByIndicator)) {
        fail("S003_MISSING_SCORE_ANCHORS", `${industry}缺少评分锚点`, { industry });
      }
      for (const indicatorName of modelPackage.indicatorOrder) {
        if (indicatorName === "盈利稳定性") continue;
        const anchors = anchorsByIndicator[indicatorName];
        if (!Array.isArray(anchors) || anchors.length !== 6) {
          fail("S003_INVALID_SCORE_ANCHORS", `${industry}.${indicatorName}评分锚点必须含5个阈值和方向`, {
            industry,
            indicatorName
          });
        }
        anchors.slice(0, 5).forEach((anchor, index) => asFiniteNumber(
          anchor,
          `${industry}.${indicatorName}.anchor[${index}]`,
          { required: true }
        ));
        if (anchors[5] !== "positive" && anchors[5] !== "inverse") {
          fail("S003_INVALID_SCORE_DIRECTION", `${industry}.${indicatorName}评分方向无效`, {
            industry,
            indicatorName,
            direction: anchors[5]
          });
        }
        const numeric = anchors.slice(0, 5);
        const monotonic = anchors[5] === "positive"
          ? numeric.every((value, index) => index === 0 || numeric[index - 1] >= value)
          : numeric.every((value, index) => index === 0 || numeric[index - 1] <= value);
        if (!monotonic) {
          warnings.push({
            code: "S003_LEGACY_NON_MONOTONIC_ANCHORS",
            industry,
            indicatorName,
            message: "沿用原 Skill 非单调锚点及其原顺序，不自动改写业务口径"
          });
        }
      }
    }

    if (!Array.isArray(modelPackage.factors) || modelPackage.factors.length !== 6) {
      fail("S003_INVALID_FACTOR_CONFIG", "模型包必须配置6项调节因子");
    }
    if (new Set(modelPackage.factors.map((factor) => factor.factorId)).size !== 6) {
      fail("S003_INVALID_FACTOR_CONFIG", "调节因子ID不得重复");
    }
    for (const factor of modelPackage.factors) {
      if (!factor.factorId || !factor.name || !Array.isArray(factor.tiers) || factor.tiers.length === 0) {
        fail("S003_INVALID_FACTOR_CONFIG", "调节因子定义不完整", { factorId: factor.factorId || null });
      }
      if (!Array.isArray(factor.applicableCategories) || factor.applicableCategories.length === 0) {
        fail("S003_INVALID_FACTOR_APPLICABILITY", `${factor.name}缺少适用类别`);
      }
      for (const tier of factor.tiers) {
        if (!tier.tierId || !tier.label) fail("S003_INVALID_FACTOR_TIER", `${factor.name}存在无效档位`);
        asFiniteNumber(tier.coefficient, `${factor.name}.${tier.tierId}.coefficient`, {
          required: true,
          min: -1,
          max: 1
        });
      }
    }

    const expectedRiskTiers = [
      ["GREEN", "绿灯"],
      ["YELLOW", "黄灯"],
      ["RED", "红灯"],
      ["BLACK", "黑灯"]
    ];
    if (!Array.isArray(modelPackage.riskTiers) || modelPackage.riskTiers.length !== 4) {
      fail("S003_INVALID_RISK_TIER_CONFIG", "一期必须且仅能配置绿、黄、红、黑四档风险");
    }
    for (const [tierId, tierName] of expectedRiskTiers) {
      const tier = modelPackage.riskTiers.find((item) => item.tierId === tierId);
      if (!tier || tier.name !== tierName) {
        fail("S003_INVALID_RISK_TIER_CONFIG", `风险等级${tierId}/${tierName}不可删除或改名`);
      }
      asFiniteNumber(tier.minInclusive, `${tierId}.minInclusive`, { required: true, min: 0, max: 100 });
      if (tier.maxExclusive !== null) {
        asFiniteNumber(tier.maxExclusive, `${tierId}.maxExclusive`, { required: true, min: 0, max: 100 });
        if (tier.maxExclusive <= tier.minInclusive) {
          fail("S003_INVALID_RISK_TIER_CONFIG", `${tierName}上界必须大于下界`);
        }
      }
    }
    const ascending = modelPackage.riskTiers.slice().sort((a, b) => a.minInclusive - b.minInclusive);
    if (ascending[0].minInclusive !== 0 || ascending[ascending.length - 1].maxExclusive !== null) {
      fail("S003_INVALID_RISK_TIER_CONFIG", "风险分档必须覆盖0至100且最高档无上界");
    }
    for (let index = 0; index < ascending.length - 1; index += 1) {
      if (ascending[index].maxExclusive !== ascending[index + 1].minInclusive) {
        fail("S003_INVALID_RISK_TIER_CONFIG", "风险分档之间不得重叠或留空", {
          lowerTier: ascending[index].tierId,
          upperTier: ascending[index + 1].tierId
        });
      }
    }
    return { valid: true, warnings };
  }

  function validateEnterprise(enterprise) {
    if (!isObject(enterprise)) fail("S003_INVALID_ENTERPRISE", "企业输入必须是对象");
    if (!String(enterprise.enterpriseId || "").trim()) {
      fail("S003_MISSING_ENTERPRISE_ID", "企业必须使用稳定 enterpriseId，禁止以企业名称代替主键");
    }
    if (!String(enterprise.name || enterprise.financialData?.单位名称 || "").trim()) {
      fail("S003_MISSING_ENTERPRISE_NAME", "企业名称不能为空", { enterpriseId: enterprise.enterpriseId });
    }
    const industry = normalizeIndustry(enterprise.category);
    if (industry !== "在建企业" && !isObject(enterprise.financialData)) {
      fail("S003_MISSING_FINANCIAL_DATA", "非在建企业必须提供财务数据", { enterpriseId: enterprise.enterpriseId });
    }
    const financialData = enterprise.financialData || {};
    for (const field of FINANCIAL_FIELDS) {
      if (hasOwn(financialData, field)) asFiniteNumber(financialData[field], field);
    }
    if (enterprise.factorInputs !== undefined && !isObject(enterprise.factorInputs)) {
      fail("S003_INVALID_FACTOR_INPUTS", "企业因子输入必须是对象", { enterpriseId: enterprise.enterpriseId });
    }
    return industry;
  }

  function numericField(data, field) {
    return hasOwn(data, field) ? asFiniteNumber(data[field], field) : null;
  }

  function calculateProfitStability(current, last, beforeLast, modelPackage) {
    const insufficient = current === null || last === null || beforeLast === null;
    if (insufficient) {
      const configured = modelPackage.profitStability?.historyInsufficient || {};
      return {
        grade: configured.grade || modelPackage.assessment?.profitHistoryInsufficientGrade || "A",
        score: configured.score ?? modelPackage.assessment?.profitHistoryInsufficientScore ?? 100,
        marker: configured.marker || "HISTORY_INSUFFICIENT_DEFAULT_A",
        note: "盈利历史不足，按用户裁决默认A档"
      };
    }
    if (!(current > 0 && last > 0 && beforeLast > 0)) {
      return { grade: "E", score: 0, marker: null, note: "过去三年中存在非正利润总额" };
    }
    const currentGrowth = (current - last) / Math.abs(last);
    const previousGrowth = (last - beforeLast) / Math.abs(beforeLast);
    if (currentGrowth > 0.15 && previousGrowth > 0.15) {
      return { grade: "A", score: 100, marker: null, note: null, currentGrowth, previousGrowth };
    }
    if (currentGrowth > 0 && previousGrowth > 0) {
      return { grade: "B", score: 75, marker: null, note: null, currentGrowth, previousGrowth };
    }
    if (currentGrowth < 0 && previousGrowth < 0) {
      return { grade: "D", score: 25, marker: null, note: null, currentGrowth, previousGrowth };
    }
    return { grade: "C", score: 50, marker: null, note: null, currentGrowth, previousGrowth };
  }

  function calculateIndicators(financialData, modelPackage) {
    const data = financialData || {};
    const result = {};
    const totalAsset = numericField(data, "资产总计_期末余额");
    const assetBeginning = numericField(data, "资产总计_年初余额(上年)");
    const totalLiability = numericField(data, "负债合计_期末余额");
    const currentLiability = numericField(data, "流动负债合计_期末余额");
    const revenue = numericField(data, "营业总收入_本年累计数");
    const netProfit = numericField(data, "净利润_本年累计数");
    const cash = numericField(data, "货币资金_期末余额");
    const tradingAsset = numericField(data, "交易性金融资产_期末余额");
    const financeExpense = numericField(data, "财务费用_本年累计数");
    const totalProfit = numericField(data, "利润总额_本年累计数");
    const operatingCashFlow = numericField(data, "经营活动产生的现金流量净额_本年累计数");
    const receivableEnd = numericField(data, "应收账款_期末余额");
    const receivableBeginning = numericField(data, "应收账款_年初余额");
    const equityEnd = numericField(data, "所有者权益（或股东权益）合计_期末余额");
    const equityBeginning = numericField(data, "所有者权益（或股东权益）合计_年初余额");
    const cost = numericField(data, "营业成本_本年累计数");
    const operatingProfit = numericField(data, "营业利润_本年累计数");

    const averageReceivable = receivableEnd !== null && receivableBeginning !== null
      ? (receivableEnd + receivableBeginning) / 2
      : receivableEnd;
    const averageAsset = totalAsset !== null && assetBeginning !== null
      ? (totalAsset + assetBeginning) / 2
      : totalAsset;
    const averageEquity = equityEnd !== null && equityBeginning !== null
      ? (equityEnd + equityBeginning) / 2
      : equityEnd;

    function put(name, value, note, marker) {
      result[name] = { name, value, note: note || null, marker: marker || null };
    }

    put("总资产", totalAsset);
    put("净利润", netProfit);
    put("经营活动产生的现金流入", numericField(data, "经营活动现金流入小计_本年累计数"));
    put(
      "现金比率",
      safeDivide((cash || 0) + (tradingAsset || 0), currentLiability),
      currentLiability ? null : "流动负债为零或缺失，无法计算"
    );
    put("资产负债率", safeDivide(totalLiability, totalAsset), totalAsset ? null : "资产总计为零或缺失，无法计算");
    if (financeExpense !== null && financeExpense > 0) {
      put("利息保障倍数", safeDivide((totalProfit || 0) + financeExpense, financeExpense));
    } else if (financeExpense !== null) {
      put("利息保障倍数", 100, "财务费用为零或负数，按原Skill视为极高");
    } else {
      put("利息保障倍数", null, "财务费用数据缺失");
    }
    put(
      "现金流动负债比率",
      safeDivide(operatingCashFlow, currentLiability),
      currentLiability ? null : "流动负债为零或缺失，无法计算"
    );
    put(
      "应收账款周转率",
      safeDivide(revenue, averageReceivable),
      averageReceivable ? null : "应收账款数据缺失或均值为零，无法计算"
    );
    put("总资产周转率", safeDivide(revenue, averageAsset), averageAsset ? null : "资产数据缺失或均值为零，无法计算");
    put("总资产收益率", safeDivide(netProfit, averageAsset), averageAsset ? null : "平均资产数据缺失或为零，无法计算");
    put("净资产收益率", safeDivide(netProfit, averageEquity), averageEquity ? null : "所有者权益数据缺失或均值为零，无法计算");
    put(
      "销售毛利率",
      safeDivide((revenue || 0) - (cost || 0), revenue),
      revenue ? null : "营业收入为零或缺失，无法计算"
    );
    put("营业利润率", safeDivide(operatingProfit, revenue), revenue ? null : "营业收入为零或缺失，无法计算");

    const stability = calculateProfitStability(
      totalProfit,
      numericField(data, "利润总额_上年同期累计数"),
      numericField(data, "利润总额_上年同期累计数(上年)"),
      modelPackage
    );
    put("盈利稳定性", stability.grade, stability.note, stability.marker);
    result["盈利稳定性"].stability = stability;

    put(
      "股东权益同比增长率",
      equityEnd !== null && equityBeginning !== null && equityBeginning !== 0
        ? (equityEnd - equityBeginning) / Math.abs(equityBeginning)
        : null,
      equityEnd !== null && equityBeginning !== null && equityBeginning !== 0
        ? null
        : "所有者权益数据缺失或年初为零，无法计算"
    );
    return result;
  }

  function scorePositive(value, anchors) {
    const [t100, t75, t50, t25, t0] = anchors;
    if (value === null) return { score: 50, marker: "MISSING_NEUTRAL_50", note: "数据不足或分母为零，按原Skill给予中性分" };
    if (value >= t100) return { score: 100, marker: null, note: null };
    if (value < t0) return { score: 0, marker: null, note: null };
    const pairs = [[t100, 100], [t75, 75], [t50, 50], [t25, 25], [t0, 0]];
    for (let index = 0; index < pairs.length - 1; index += 1) {
      const [highThreshold, highScore] = pairs[index];
      const [lowThreshold, lowScore] = pairs[index + 1];
      if (lowThreshold <= value && value < highThreshold) {
        if (highThreshold === lowThreshold) return { score: lowScore, marker: null, note: null };
        const interpolated = lowScore
          + ((value - lowThreshold) / (highThreshold - lowThreshold)) * (highScore - lowScore);
        return { score: roundHalfEven(interpolated, 2), marker: null, note: null };
      }
    }
    // This fall-through is intentional legacy parity for published non-monotonic anchors.
    return {
      score: 0,
      marker: "LEGACY_NON_MONOTONIC_FALLTHROUGH",
      note: "按原Skill锚点顺序计算；当前值未命中任何分段"
    };
  }

  function scoreInverse(value, anchors) {
    const [t100, t75, t50, t25, t0] = anchors;
    if (value === null) return { score: 50, marker: "MISSING_NEUTRAL_50", note: "数据不足或分母为零，按原Skill给予中性分" };
    if (value <= t100) return { score: 100, marker: null, note: null };
    if (value > t0) return { score: 0, marker: null, note: null };
    const pairs = [[t100, 100], [t75, 75], [t50, 50], [t25, 25], [t0, 0]];
    for (let index = 0; index < pairs.length - 1; index += 1) {
      const [lowThreshold, lowScore] = pairs[index];
      const [highThreshold, highScore] = pairs[index + 1];
      if (lowThreshold < value && value <= highThreshold) {
        if (highThreshold === lowThreshold) return { score: lowScore, marker: null, note: null };
        const interpolated = highScore
          + ((highThreshold - value) / (highThreshold - lowThreshold)) * (lowScore - highScore);
        return { score: roundHalfEven(interpolated, 2), marker: null, note: null };
      }
    }
    return { score: 0, marker: null, note: null };
  }

  function scoreIndicatorValue(indicatorName, value, industry, modelPackage, indicatorMeta) {
    if (indicatorName === "盈利稳定性") {
      const gradeMap = modelPackage.profitStability?.grades || { A: 100, B: 75, C: 50, D: 25, E: 0 };
      const score = asFiniteNumber(gradeMap[value], `盈利稳定性.${value}`, { required: true, min: 0, max: 100 });
      return {
        score,
        marker: indicatorMeta?.marker || null,
        note: indicatorMeta?.note || null
      };
    }
    const anchors = modelPackage.scoreAnchors[industry]?.[indicatorName];
    if (!anchors) fail("S003_MISSING_SCORE_ANCHORS", `${industry}.${indicatorName}缺少评分锚点`);
    return anchors[5] === "inverse" ? scoreInverse(value, anchors) : scorePositive(value, anchors);
  }

  function findFactorInput(factorInputs, factor) {
    if (hasOwn(factorInputs, factor.factorId)) return factorInputs[factor.factorId];
    if (hasOwn(factorInputs, factor.name)) return factorInputs[factor.name];
    for (const [alias, canonical] of Object.entries(FACTOR_NAME_ALIASES)) {
      if (canonical === factor.name && hasOwn(factorInputs, alias)) return factorInputs[alias];
    }
    return null;
  }

  function unpackFactorInput(rawInput) {
    if (!isObject(rawInput)) return { state: null, value: rawInput };
    return {
      state: rawInput.state || rawInput.status || null,
      value: rawInput.tierId ?? rawInput.value ?? rawInput.selected ?? rawInput.label ?? null
    };
  }

  function resolveFactorTier(factor, inputValue) {
    const token = String(inputValue).trim();
    let tier = factor.tiers.find((item) => item.tierId === token || item.label === token);
    if (tier) return tier;
    const aliasTierId = FACTOR_TIER_ALIASES[factor.factorId]?.[token];
    if (aliasTierId) tier = factor.tiers.find((item) => item.tierId === aliasTierId);
    if (!tier) {
      fail("S003_INVALID_FACTOR_VALUE", `${factor.name}取值不属于 Published 配置`, {
        factorId: factor.factorId,
        inputValue
      });
    }
    return tier;
  }

  function evaluateFactors(factorInputs, industry, modelPackage) {
    const inputs = factorInputs || {};
    const details = [];
    let factorSum = 0;
    const majorFactorHits = [];
    for (const factor of modelPackage.factors) {
      const applicable = factor.applicableCategories.includes("ALL")
        || factor.applicableCategories.includes(industry);
      const unpacked = unpackFactorInput(findFactorInput(inputs, factor));
      const missing = unpacked.value === null || unpacked.value === undefined || String(unpacked.value).trim() === "";
      if (!applicable) {
        details.push({
          factorId: factor.factorId,
          name: factor.name,
          state: "NOT_APPLICABLE",
          marker: "NOT_APPLICABLE",
          applicable: false,
          inputValue: missing ? null : unpacked.value,
          tierId: null,
          tierLabel: "不适用",
          coefficient: 0
        });
        continue;
      }
      if (unpacked.state === "NOT_APPLICABLE") {
        fail("S003_INVALID_FACTOR_APPLICABILITY", `${factor.name}对${industry}适用，不能标记为不适用`, {
          factorId: factor.factorId,
          industry
        });
      }
      if (missing || unpacked.state === "DEFAULTED_ZERO") {
        details.push({
          factorId: factor.factorId,
          name: factor.name,
          state: "DEFAULTED_ZERO",
          marker: "DEFAULTED_ZERO",
          applicable: true,
          inputValue: null,
          tierId: null,
          tierLabel: "缺失因子按0档",
          coefficient: 0
        });
        continue;
      }
      const tier = resolveFactorTier(factor, unpacked.value);
      const coefficient = asFiniteNumber(tier.coefficient, `${factor.name}.${tier.tierId}.coefficient`, {
        required: true,
        min: -1,
        max: 1
      });
      factorSum += coefficient;
      const majorToken = MAJOR_FACTOR_TOKENS[`${factor.factorId}:${tier.tierId}`] || null;
      if (majorToken) majorFactorHits.push(majorToken);
      details.push({
        factorId: factor.factorId,
        name: factor.name,
        state: "APPLIED",
        marker: null,
        applicable: true,
        inputValue: unpacked.value,
        tierId: tier.tierId,
        tierLabel: tier.label,
        coefficient,
        majorRiskHit: majorToken
      });
    }
    return {
      factorSum: roundHalfEven(factorSum, 4),
      compositeAdjustment: roundHalfEven(1 + factorSum, 4),
      details,
      majorFactorHits
    };
  }

  function classifyRisk(score, modelPackage) {
    const finalScore = asFiniteNumber(score, "finalScore", { required: true, min: 0, max: 100 });
    const tier = modelPackage.riskTiers.find((item) => (
      finalScore >= item.minInclusive
      && (item.maxExclusive === null || finalScore < item.maxExclusive)
    ));
    if (!tier) fail("S003_RISK_TIER_NOT_FOUND", "最终得分未命中任何风险分档", { finalScore });
    return {
      tierId: tier.tierId,
      name: tier.name,
      color: tier.color,
      minInclusive: tier.minInclusive,
      maxExclusive: tier.maxExclusive
    };
  }

  function buildDispositionCandidates(result, modelPackage) {
    const candidates = [];
    const triggerTokens = new Set(result.majorFactorHits || []);
    for (const actionType of modelPackage.actionTypes || []) {
      const tierTriggered = actionType.triggerTier === result.riskTier.tierId;
      const matchedFactors = (actionType.triggerFactors || []).filter((token) => triggerTokens.has(token));
      if (!tierTriggered && matchedFactors.length === 0) continue;
      const actionTypeId = actionType.actionTypeId;
      const keyParts = [
        result.scenarioIdentity.scenarioRunId || "UNBOUND-RUN",
        result.enterprise.enterpriseId,
        actionTypeId,
        result.assessmentAt || "UNBOUND-ASSESSMENT",
        result.resultVersion
      ];
      candidates.push({
        schemaVersion: "ofw.s003.disposition-candidate.v1",
        candidateId: `S003-CAND-${keyParts.map((part) => stableToken(part, "NA")).join("-")}`,
        actionTypeId,
        status: "CANDIDATE_AWAITING_HUMAN_CONFIRMATION",
        requiresHumanConfirmation: actionType.requiresHumanConfirmation !== false,
        trigger: tierTriggered
          ? { type: "RISK_TIER", tierId: result.riskTier.tierId, tierName: result.riskTier.name }
          : { type: "MAJOR_FACTOR", factors: matchedFactors },
        idempotencyKey: keyParts.join("|"),
        actionRequestId: null,
        todoId: null,
        autoCreateActionRequest: false,
        autoCreateTodo: false
      });
    }
    return candidates;
  }

  function buildReportData(result, context) {
    const ctx = context || {};
    const runToken = stableToken(result.scenarioIdentity.scenarioRunId, "UNBOUND-RUN");
    const enterpriseToken = stableToken(result.enterprise.enterpriseId, "UNBOUND-ENTERPRISE");
    return {
      schemaVersion: REPORT_SCHEMA_VERSION,
      reportId: ctx.reportId || `S003-RPT-${runToken}-${enterpriseToken}`,
      reportType: "S003_ENTERPRISE_DEBT_RISK_REPORT",
      scenarioIdentity: { ...result.scenarioIdentity },
      enterprise: { ...result.enterprise },
      assessmentAt: result.assessmentAt,
      modelVersion: result.modelIdentity.packageVersion,
      publishedVersion: result.modelIdentity.publishedVersion,
      contentVersion: ctx.contentVersion || "1.0.0",
      artifactVersion: ctx.artifactVersion || "1.0.0",
      sections: {
        overallRisk: {
          rawScore: result.rawScore,
          factorSum: result.factorSum,
          compositeAdjustment: result.compositeAdjustment,
          finalScore: result.finalScore,
          riskTier: { ...result.riskTier }
        },
        conclusion: `${result.enterprise.name}本轮债务风险评分为${result.finalScore.toFixed(2)}分，风险等级为${result.riskTier.name}。`,
        factorDetails: result.factorResults.map((item) => ({ ...item })),
        indicatorDetails: result.indicatorResults.map((item) => ({ ...item })),
        keyRisks: result.keyRisks.map((item) => ({ ...item })),
        dispositionCandidates: result.dispositionCandidates.map((item) => ({
          candidateId: item.candidateId,
          actionTypeId: item.actionTypeId,
          status: item.status,
          actionRequestId: null,
          todoId: null
        })),
        provenance: {
          contractId: "C035",
          resultId: result.resultId,
          resultVersion: result.resultVersion,
          dataVersion: result.dataIdentity.dataVersion,
          modelPackageId: result.modelIdentity.packageId,
          modelPackageVersion: result.modelIdentity.packageVersion,
          defaultSemantics: result.defaultSemantics.slice()
        }
      },
      formats: ["html", "print-to-pdf"],
      sameIdentityAcrossFormats: true
    };
  }

  function normalizeScoreArguments(enterpriseOrOptions, modelPackage, context) {
    if (isObject(enterpriseOrOptions) && enterpriseOrOptions.enterprise && enterpriseOrOptions.modelPackage) {
      return {
        enterprise: enterpriseOrOptions.enterprise,
        modelPackage: enterpriseOrOptions.modelPackage,
        context: enterpriseOrOptions.context || {}
      };
    }
    return { enterprise: enterpriseOrOptions, modelPackage, context: context || {} };
  }

  function scoreEnterprise(enterpriseOrOptions, modelPackageArg, contextArg) {
    const args = normalizeScoreArguments(enterpriseOrOptions, modelPackageArg, contextArg);
    const modelValidation = validateModelPackage(args.modelPackage);
    const industry = validateEnterprise(args.enterprise);
    const modelPackage = args.modelPackage;
    const context = args.context;
    const enterpriseName = String(args.enterprise.name || args.enterprise.financialData?.单位名称).trim();

    let rawScore;
    let indicatorResults;
    if (industry === "在建企业") {
      rawScore = asFiniteNumber(modelPackage.assessment?.underConstructionRawScore, "underConstructionRawScore", {
        required: true,
        min: 0,
        max: 100
      });
      indicatorResults = modelPackage.indicatorOrder.map((name) => ({
        indicatorId: stableToken(name, "INDICATOR"),
        name,
        actualValue: null,
        score: rawScore,
        weight: 0,
        weightedScore: 0,
        formula: modelPackage.formulas?.[name] || "",
        status: "NOT_EVALUATED_UNDER_CONSTRUCTION",
        marker: "UNDER_CONSTRUCTION_FIXED_60",
        note: "在建企业基础分固定为60分，财务指标不参与加权"
      }));
    } else {
      const indicators = calculateIndicators(args.enterprise.financialData, modelPackage);
      const weights = modelPackage.weights[industry];
      let total = 0;
      indicatorResults = modelPackage.indicatorOrder.map((name, index) => {
        const calculated = indicators[name];
        const scored = scoreIndicatorValue(name, calculated.value, industry, modelPackage, calculated);
        const score = roundHalfEven(scored.score, 2);
        const weight = weights[index] / 100;
        const weightedScore = score * weight;
        total += weightedScore;
        return {
          indicatorId: stableToken(name, `IND-${index + 1}`),
          name,
          actualValue: calculated.value,
          score,
          weight,
          weightPercent: weights[index],
          weightedScore: roundHalfEven(weightedScore, 2),
          formula: modelPackage.formulas?.[name] || "",
          status: "EVALUATED",
          marker: scored.marker || calculated.marker || null,
          note: scored.note || calculated.note || null
        };
      });
      rawScore = roundHalfEven(total, 1);
    }

    const factorEvaluation = evaluateFactors(args.enterprise.factorInputs || {}, industry, modelPackage);
    const finalScore = roundHalfEven(clamp(rawScore * factorEvaluation.compositeAdjustment, 0, 100), 2);
    const riskTier = classifyRisk(finalScore, modelPackage);
    const scenarioIdentity = {
      scenarioId: context.scenarioId || modelPackage.scenarioIdentity?.scenarioId || "S003",
      scenarioVersion: context.scenarioVersion || modelPackage.scenarioIdentity?.scenarioVersion || "S003-v1",
      scenarioRunId: context.scenarioRunId || null
    };
    if (scenarioIdentity.scenarioId !== "S003") {
      fail("S003_SCENARIO_IDENTITY_MISMATCH", "S003评分结果不得写入其他场景身份", { scenarioIdentity });
    }
    const resultVersion = context.resultVersion || "1.0.0";
    const result = {
      schemaVersion: C035_SCHEMA_VERSION,
      contractId: "C035",
      resultId: context.resultId || `S003-C035-${stableToken(scenarioIdentity.scenarioRunId, "UNBOUND-RUN")}-${stableToken(args.enterprise.enterpriseId, "UNBOUND-ENTERPRISE")}`,
      resultVersion,
      status: "SUCCEEDED",
      engineVersion: ENGINE_VERSION,
      scenarioIdentity,
      enterprise: {
        enterpriseId: args.enterprise.enterpriseId,
        name: enterpriseName,
        sector: args.enterprise.sector || null,
        category: industry
      },
      assessmentAt: context.assessmentAt || args.enterprise.assessmentAt || null,
      currency: context.currency || "CNY",
      amountUnit: context.amountUnit || "元",
      modelIdentity: {
        packageId: modelPackage.packageId,
        packageVersion: modelPackage.packageVersion,
        publishedVersion: context.publishedVersion || modelPackage.packageVersion,
        lifecycleStatus: modelPackage.lifecycleStatus
      },
      dataIdentity: {
        dataVersion: context.dataVersion || null,
        manualInputVersion: context.manualInputVersion || null
      },
      rawScore,
      factorSum: factorEvaluation.factorSum,
      compositeAdjustment: factorEvaluation.compositeAdjustment,
      finalScore,
      adjustedScore: finalScore,
      riskTier,
      riskLevel: riskTier.name,
      indicatorResults,
      factorResults: factorEvaluation.details,
      majorFactorHits: factorEvaluation.majorFactorHits,
      keyRisks: industry === "在建企业"
        ? []
        : indicatorResults
          .slice()
          .sort((left, right) => left.score - right.score || left.name.localeCompare(right.name, "zh-CN"))
          .slice(0, 3)
          .map((item) => ({ indicatorId: item.indicatorId, name: item.name, score: item.score })),
      isUnderConstruction: industry === "在建企业",
      defaultSemantics: [
        ...indicatorResults.filter((item) => item.marker).map((item) => ({
          scope: "INDICATOR",
          resourceId: item.indicatorId,
          marker: item.marker
        })),
        ...factorEvaluation.details.filter((item) => item.marker).map((item) => ({
          scope: "FACTOR",
          resourceId: item.factorId,
          marker: item.marker
        }))
      ],
      modelWarnings: modelValidation.warnings,
      publishedFact: null,
      dispositionCandidates: [],
      reportData: null
    };
    result.factorStates = Object.fromEntries(result.factorResults.map((item) => [item.factorId, item.state]));
    result.lowestThree = result.keyRisks;
    result.markers = result.defaultSemantics;
    result.dispositionCandidates = buildDispositionCandidates(result, modelPackage);
    result.publishedFact = {
      schemaVersion: "ofw.s003.published-debt-risk-fact.v1",
      factId: `S003-FACT-${stableToken(scenarioIdentity.scenarioRunId, "UNBOUND-RUN")}-${stableToken(args.enterprise.enterpriseId, "UNBOUND-ENTERPRISE")}`,
      subjectId: args.enterprise.enterpriseId,
      predicate: "debtRiskAssessment",
      object: {
        rawScore,
        factorSum: result.factorSum,
        finalScore,
        riskTierId: riskTier.tierId,
        riskTierName: riskTier.name
      },
      validAt: result.assessmentAt,
      scenarioIdentity: { ...scenarioIdentity },
      sourceResultId: result.resultId,
      sourceResultVersion: result.resultVersion
    };
    result.reportData = buildReportData(result, context);
    return result;
  }

  function normalizePortfolioArguments(fixtureOrOptions, modelPackage, context) {
    if (isObject(fixtureOrOptions) && fixtureOrOptions.fixture && fixtureOrOptions.modelPackage) {
      return {
        fixture: fixtureOrOptions.fixture,
        modelPackage: fixtureOrOptions.modelPackage,
        context: fixtureOrOptions.context || {}
      };
    }
    return { fixture: fixtureOrOptions, modelPackage, context: context || {} };
  }

  function scorePortfolio(fixtureOrOptions, modelPackageArg, contextArg) {
    const args = normalizePortfolioArguments(fixtureOrOptions, modelPackageArg, contextArg);
    if (!isObject(args.fixture) || !Array.isArray(args.fixture.enterprises)) {
      fail("S003_INVALID_PORTFOLIO_INPUT", "组合评分输入必须包含 enterprises 数组");
    }
    validateModelPackage(args.modelPackage);
    const ids = args.fixture.enterprises.map((enterprise) => String(enterprise.enterpriseId || "").trim());
    if (new Set(ids).size !== ids.length) fail("S003_DUPLICATE_ENTERPRISE_ID", "企业稳定ID不得重复");
    const context = {
      assessmentAt: args.context.assessmentAt || args.fixture.assessmentAt || null,
      currency: args.context.currency || args.fixture.currency || "CNY",
      amountUnit: args.context.amountUnit || args.fixture.amountUnit || "元",
      dataVersion: args.context.dataVersion || args.fixture.fixtureId || null,
      ...args.context
    };
    const results = args.fixture.enterprises.map((enterprise) => scoreEnterprise(enterprise, args.modelPackage, context));
    const riskTierCounts = Object.fromEntries(args.modelPackage.riskTiers.map((tier) => [tier.tierId, 0]));
    const categoryCounts = {};
    for (const result of results) {
      riskTierCounts[result.riskTier.tierId] += 1;
      categoryCounts[result.enterprise.category] = (categoryCounts[result.enterprise.category] || 0) + 1;
    }
    return {
      schemaVersion: PORTFOLIO_SCHEMA_VERSION,
      status: "SUCCEEDED",
      scenarioIdentity: {
        scenarioId: context.scenarioId || args.modelPackage.scenarioIdentity?.scenarioId || "S003",
        scenarioVersion: context.scenarioVersion || args.modelPackage.scenarioIdentity?.scenarioVersion || "S003-v1",
        scenarioRunId: context.scenarioRunId || null
      },
      assessmentAt: context.assessmentAt,
      modelIdentity: {
        packageId: args.modelPackage.packageId,
        packageVersion: args.modelPackage.packageVersion,
        publishedVersion: context.publishedVersion || args.modelPackage.packageVersion
      },
      dataIdentity: {
        dataVersion: context.dataVersion,
        manualInputVersion: context.manualInputVersion || null
      },
      enterpriseCount: results.length,
      summary: {
        riskTierCounts,
        categoryCounts,
        averageFinalScore: results.length
          ? roundHalfEven(results.reduce((sum, result) => sum + result.finalScore, 0) / results.length, 2)
          : null
      },
      results,
      publishedFacts: results.map((result) => result.publishedFact),
      reports: results.map((result) => result.reportData),
      dispositionCandidates: results.flatMap((result) => result.dispositionCandidates)
    };
  }

  return Object.freeze({
    ENGINE_VERSION,
    C035_SCHEMA_VERSION,
    REPORT_SCHEMA_VERSION,
    PORTFOLIO_SCHEMA_VERSION,
    S003ScoringError,
    roundHalfEven,
    clamp,
    normalizeIndustry,
    validateModelPackage,
    validateEnterprise,
    calculateProfitStability,
    calculateIndicators,
    scorePositive,
    scoreInverse,
    scoreIndicatorValue,
    evaluateFactors,
    classifyRisk,
    buildDispositionCandidates,
    buildReportData,
    roundLegacyParity: roundHalfEven,
    evaluateEnterprise: scoreEnterprise,
    evaluatePortfolio: scorePortfolio,
    scoreEnterprise,
    scorePortfolio
  });
});
