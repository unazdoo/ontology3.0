(function () {
  "use strict";

  const moduleOwners = Object.freeze({
    M01: Object.freeze({
      moduleId: "M01",
      key: "ontology",
      name: "本体管理",
      owner: "本体管理",
      owns: ["业务对象", "关系", "Metric", "Rule", "必要 Action Type", "Published 生命周期", "T019", "C008"],
      consumes: ["M02 数据资产与质量证据"],
      boundaries: ["不得由场景壳修改 Published", "不得根据报告章节创建对象类型", "不得自动形成授信结论"]
    }),
    M02: Object.freeze({
      moduleId: "M02",
      key: "data",
      name: "数据工程",
      owner: "数据工程",
      owns: ["数据源", "快照", "管道", "质量", "数据资产版本", "C017 可信度摘要"],
      consumes: ["公开年报", "受控合成演示材料", "人工确认的时点与口径"],
      boundaries: ["年报已有事实不得重复造数", "合成数据必须标 synthetic-demo", "不得让 Agent 直接读取工作簿"]
    }),
    M03: Object.freeze({
      moduleId: "M03",
      key: "query",
      name: "智能问数",
      owner: "智能问数",
      owns: ["独立交互问数配置与运行"],
      consumes: ["Published 本体与 C008"],
      boundaries: ["S004 一期默认 NOT_APPLICABLE", "不得为凑齐六模块而预置问数结果"]
    }),
    M04: Object.freeze({
      moduleId: "M04",
      key: "decision",
      name: "决策中心",
      owner: "决策中心",
      owns: ["标准 Action Request 后的提醒", "人工确认", "待办", "C019"],
      consumes: ["用户显式提交的标准 Action Request"],
      boundaries: ["没有 Action Request 时保持 NOT_APPLICABLE", "报告助手不得创建行动申请或待办"]
    }),
    M05: Object.freeze({
      moduleId: "M05",
      key: "agent",
      name: "Agent 应用",
      owner: "Agent 应用",
      owns: ["Agent Definition", "Prompt", "Skill", "工具白名单", "Session", "Run", "Result"],
      consumes: ["M06 固定证据包", "Published 本体事实"],
      boundaries: ["LLM 不作为数据源或计算层", "不得修改报告事实", "不得发布报告"]
    }),
    M06: Object.freeze({
      moduleId: "M06",
      key: "report",
      name: "报告中心",
      owner: "报告中心",
      owns: ["报告定义", "模板", "证据包", "草稿复核", "确定性核验", "HTML/PDF 发布", "伴读交接"],
      consumes: ["M01 Published 语义", "M02 C017", "M05 Agent 结果"],
      boundaries: ["Agent 草稿不是正式报告", "HTML/PDF 同源且不可原地更新", "授信结论必须人工确认"]
    })
  });

  const contracts = Object.freeze({
    C003: Object.freeze({ name: "数据资产交付", producer: "M02", consumer: "M01" }),
    C008: Object.freeze({ name: "权威业务事实投影", producer: "M01", consumer: "M05/M06" }),
    C017: Object.freeze({ name: "数据可信度摘要", producer: "M02", consumer: "M01/M05/M06" }),
    C022: Object.freeze({ name: "报告生成固定上下文", producer: "M06", consumer: "M05" }),
    C023: Object.freeze({ name: "报告生成结果", producer: "M05", consumer: "M06" }),
    C024: Object.freeze({ name: "报告伴读固定上下文", producer: "M06", consumer: "M05" }),
    C025: Object.freeze({ name: "报告伴读结果", producer: "M05", consumer: "M06" }),
    C033: Object.freeze({ name: "场景身份与定向重置", producer: "平台公共层", consumer: "M01—M06" }),
    C034: Object.freeze({ name: "场景快照、恢复与迁移", producer: "平台公共层＋模块 Owner", consumer: "平台总控与场景恢复编排" })
  });

  const responsibilityLabels = Object.freeze([
    Object.freeze({ role: "调查经办人", holder: "财务公司客户经理或调查岗", responsibility: "补充调查事实并提交调查意见" }),
    Object.freeze({ role: "数据及口径批准人", holder: "信贷政策或风险负责人", responsibility: "确认数据时点、币种、单位及指标口径" }),
    Object.freeze({ role: "报告复核与发布人", holder: "风险审查或报告复核岗", responsibility: "复核事实、核验结果和正式产物" }),
    Object.freeze({ role: "最终授信决定人", holder: "有权审批人", responsibility: "仅由人工确认最终授信结论" })
  ]);

  window.S004Contracts = Object.freeze({
    moduleOwners: moduleOwners,
    contracts: contracts,
    responsibilityLabels: responsibilityLabels
  });
})();
