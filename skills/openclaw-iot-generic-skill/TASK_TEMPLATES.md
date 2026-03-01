# OpenClaw 多轮任务模板（M4）

以下模板用于让智能体在多轮对话里稳定完成 IoT 诊断任务。  
默认遵循：先 `discover`，再查询，最后给出可执行建议。

## 模板 A：设备离线排查

### 触发意图

- 用户说“设备离线了/掉线了/连不上平台”
- 用户问“为什么这个设备不在线”

### 执行步骤

1. 查询设备状态：
   - `device-status --deviceName <deviceName>`
2. 若设备离线，查询产品内同类设备状态分布：
   - `list-devices --productKey <productKey> --status OFFLINE --fetchAll true`
3. 拉取关键属性最近窗口（如通信/心跳相关）：
   - `query-history --deviceName <deviceName> --identifiers <ids> --range last_24h --aggregate latest,count --omitData true`
4. 查询最近告警：
   - `alarms --deviceName <deviceName> --startTime "<t1>" --endTime "<t2>"`
5. 输出结论：
   - 离线是否单点问题（仅该设备）还是批量问题（同产品多设备）
   - 最近一次在线时间、关键指标、相关告警
   - 给出下一步建议（现场断电/网络检查/网关检查/平台侧排查）

### 输出模板

- 当前状态：`ONLINE|OFFLINE|UNACTIVE`
- 影响范围：单设备 / 同产品多设备
- 关键证据：最近在线时间 + 指标摘要 + 告警摘要
- 建议动作：按优先级列 2-4 条

## 模板 B：指标波动诊断

### 触发意图

- 用户说“温度波动大/电流异常跳变/最近不稳定”
- 用户问“这个点位最近有没有异常”

### 执行步骤

1. discover + resolve-intent，确认目标 `identifier`
2. 先查摘要（避免大数据）：
   - `query-history --identifier <id> --range last_24h --aggregate latest,min,max,avg,count --omitData true`
3. 若确认存在异常，再扩大对比窗口：
   - `last_6h` 对比 `last_24h` / `last_7d`
4. 可选：关联其它点位做并行观察：
   - `query-history --identifiers id1,id2,... --range last_24h --aggregate latest,max,avg --omitData true`
5. 若波动与告警相关，补查告警窗口：
   - `alarms --deviceName <deviceName> --startTime "<t1>" --endTime "<t2>"`
6. 输出结论：
   - 是否异常（相对历史均值/最大值）
   - 异常可能类型（瞬时尖峰/持续偏高/周期波动）
   - 建议下一步验证动作

### 输出模板

- 诊断点位：`<identifier>`
- 摘要统计：latest/min/max/avg/count
- 结论：正常 / 可疑 / 明显异常
- 建议：继续观察 / 提升采样 / 联动告警阈值调整

## 模板 C：告警归因初筛

### 触发意图

- 用户说“最近告警很多，帮我看下原因”
- 用户问“这批告警是不是同一个问题引起的”

### 执行步骤

1. 查询目标时间窗口告警：
   - `alarms --deviceName <deviceName> --startTime "<t1>" --endTime "<t2>"`
2. 做轻量分类（按规则、级别、状态）：
   - `alarmRule.name` / `levelText` / `statusText`
3. 提取高频告警的关键字段：
   - `generateValue`、`restoreValue`、`createTime`、`restoreTime`
4. 对高频规则关联点位做摘要查询：
   - `query-history --identifier <id> --range <覆盖窗口> --aggregate latest,max,avg,count --omitData true`
5. 输出“初筛归因”：
   - Top 告警类型及占比
   - 是否集中在单一点位/单一阈值
   - 是否已自动恢复为主（`AutoRelieve`）或需要人工介入（`ManualRelieve`）

### 输出模板

- 告警总量与时间分布
- Top 规则（按次数）
- 解除方式分布（AutoRelieve/ManualRelieve）
- 初筛结论：阈值偏紧 / 设备波动 / 外部干扰 / 待进一步确认

## 通用注意事项

- 查询优先摘要，再明细，避免一次返回过多 token。
- 如果读查询超时，先缩小窗口重试（`last_24h -> last_6h`）。
- 写操作不在诊断流程中自动执行；必须先 `dryRun` 并获得用户确认。
