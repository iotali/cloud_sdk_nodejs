# OpenClaw IoT Generic Skill Plan

## 目标

打造一个可在 OpenClaw 中稳定运行的 IoT 通用技能，基于物模型完成“发现、查询、控制、诊断”闭环，且对大模型友好（低 token、强约束、可观测）。

## 当前能力（已完成）

- 认证：支持 `token` / `appId+appSecret`
- 发现：`discover`（支持压缩返回与完整模型）
- 查询：`list-devices`、`device-status`、`query-history`、`query-prop`、`query-props`、`query-events`、`alarms`
- 控制：`set-props`、`call-service`（支持 `dryRun`）
- 安全：写点位白名单 `IOT_WRITABLE_IDENTIFIERS`
- 输出：统一单行 JSON，适合 OpenClaw 解析

## 里程碑规划

### M1（1-2 天）稳定性增强

- 增加 `requestId` 与统一错误分级（参数错误/认证错误/平台错误/网络错误）（已完成）
- `list-devices` 增加更明确的服务端分页兼容策略说明（已完成）
- 增加 `--full false` 风格开关到高体量 action（默认精简字段）
- 为 `query-history` 增加聚合视图（latest/min/max/avg）选项（已完成）
- M1 当前状态：已完成，可进入 M2

### M2（2-3 天）可用性增强

- 增加 `model-cache`（按 `productKey` 缓存物模型，TTL 可配置）（已完成）
- 增加 `resolve-intent` 辅助动作：输入自然语言关键词，返回候选 `identifier`（已完成）
- 增加 `list-writable-identifiers`，帮助模型安全执行写操作（已完成）
- M2 当前状态：核心能力已完成，可进入 M3

### M3（2-4 天）生产化能力

- 结构化日志（action、耗时、结果码、请求摘要）（已完成）
- 失败重试与超时策略（仅读操作自动重试）（已完成）
- 基于 `.env` 的风险策略：
  - 是否允许写操作（已完成）
  - 夜间写操作限制（已完成）
  - 敏感 action 二次确认（已完成）
- M3 当前状态：核心能力已完成，可进入 M4
- M3 checkpoint（2026-03-01）：
  - 已在真实环境完成 discover/list-devices/device-status/query-history 验证
  - 已验证敏感操作二次确认与 `READ_TIMEOUT` 自动重试行为

### M4（1-2 天）OpenClaw 体验优化

- 提供专用 `SKILL.md` prompt 模板（先 discover 再执行）（已完成）
- 增加“多轮任务模板”：
  - 设备离线排查（已完成）
  - 指标波动诊断（已完成）
  - 告警归因初筛（已完成）
- M4 当前状态：核心能力已完成
- M4 checkpoint（2026-03-01）：
  - 已重构 `SKILL.md` 执行策略，强制“先 discover 再执行”
  - 已新增 `TASK_TEMPLATES.md`，覆盖 3 类多轮诊断流程

## 验收标准

- 任意新产品接入后，10 分钟内可完成 discover + list + status + set/call 验证
- `stdout` 100% 可被 JSON 解析（无杂日志污染）
- 常见失败场景均返回明确 `errorCode`
- 真实环境端到端成功率 >= 99%（读操作）
