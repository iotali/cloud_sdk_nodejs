# IoT 物模型通用技能

## 定位

- **Description**: 基于 IoT 物模型执行通用设备操作：发现能力、读写属性、调用服务、查询事件、查询告警。
- **核心原则**:
  - 不假设设备类型（灯/插座/空调等），始终以物模型 `identifier` 为准。
  - 默认低 token 路径：优先摘要、必要时再查明细。
  - 输出必须可解析：命令执行结果只使用脚本返回 JSON 做判断。

## 标准执行流程（必须遵守）

1. **先 discover，再执行**  
   新 `productKey` 或首次会话，先执行：
   `node {{SKILL_PATH}}/index.js --action discover --productKey <productKey>`

2. **意图映射 identifier（推荐）**  
   用户需求不明确时，先执行：
   `node {{SKILL_PATH}}/index.js --action resolve-intent --productKey <productKey> --query <text> --topK 8`

3. **查询类任务优先摘要**  
   时间序列优先：
   `query-history --aggregate ... --omitData true`  
   仅在用户要求“明细点位/原始数据”时再拉完整 `data`。

4. **写操作前强校验**  
   顺序固定：
   - `discover` / `resolve-intent`
   - `list-writable-identifiers --onlyAllowed true`
   - `set-props` / `call-service --dryRun true`
   - 用户确认后再真实执行（必要时 `--confirm true`）

5. **失败处理重试策略**  
   读操作默认已启用超时重试；若出现 `READ_TIMEOUT` / `network_error`：
   - 保留当前目标不变，缩小查询范围后重试（如 `last_24h` -> `last_6h`）。
   - 仍失败时输出明确失败原因和下一步建议。

## Commands

1. 发现产品物模型  
   `node {{SKILL_PATH}}/index.js --action discover --productKey <productKey> [--refreshModel true] [--fullModel true]`

2. 意图解析（自然语言 -> identifier）  
   `node {{SKILL_PATH}}/index.js --action resolve-intent --productKey <productKey> --query <text> [--topK 8] [--writableOnly true]`

3. 可写点位清单  
   `node {{SKILL_PATH}}/index.js --action list-writable-identifiers --productKey <productKey> [--onlyAllowed true]`

4. 设备列表  
   `node {{SKILL_PATH}}/index.js --action list-devices --productKey <productKey> [--page 1] [--pageSize 20] [--status ONLINE|OFFLINE|UNACTIVE] [--keyword <name>] [--brief true] [--fetchAll true]`

5. 设备状态  
   `node {{SKILL_PATH}}/index.js --action device-status --deviceName <deviceName>`

6. 统一历史查询（推荐）  
   `node {{SKILL_PATH}}/index.js --action query-history --deviceName <deviceName> [--identifier <id> | --identifiers '["id1","id2"]' | --identifiers id1,id2] [--range last_1h|last_6h|last_24h|last_7d] [--startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss"] [--downSampling 1s] [--limit 200] [--aggregate latest|min|max|avg|count|all] [--omitData true]`

7. 单点历史  
   `node {{SKILL_PATH}}/index.js --action query-prop --deviceName <deviceName> --identifier <id> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--downSampling 1s]`

8. 多点历史  
   `node {{SKILL_PATH}}/index.js --action query-props --deviceName <deviceName> --identifiers '["id1","id2"]' --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--downSampling 1s]`

9. 设置属性  
   `node {{SKILL_PATH}}/index.js --action set-props --deviceName <deviceName> --points '[{"identifier":"power_switch","value":"1"}]' [--dryRun true] [--confirm true]`

10. 调用服务  
    `node {{SKILL_PATH}}/index.js --action call-service --deviceName <deviceName> --servicePoint '{"identifier":"start_device"}' [--pointList '[{"identifier":"mode","value":"2"}]'] [--dryRun true] [--confirm true]`

11. 事件查询  
    `node {{SKILL_PATH}}/index.js --action query-events --deviceName <deviceName> --identifier <eventId> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss"`

12. 告警查询  
    `node {{SKILL_PATH}}/index.js --action alarms --deviceName <deviceName> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--status <status>]`

## 多轮任务模板（入口）

详细模板见：`TASK_TEMPLATES.md`

- 模板 A：设备离线排查
- 模板 B：指标波动诊断
- 模板 C：告警归因初筛

## Output Contract

- 成功：`{"ok":true,"requestId":"...","elapsedMs":123,"action":"...","data":{...}}`
- 失败：`{"ok":false,"requestId":"...","elapsedMs":123,"errorCode":"...","errorType":"...","message":"..."}`

`errorType`：
- `validation_error` 参数问题
- `auth_error` 认证问题
- `network_error` 网络/超时问题
- `platform_error` 平台返回失败
- `unknown_error` 未分类错误

常见 `errorCode`：
- `MISSING_ACTION` / `MISSING_ARG` / `INVALID_ARG` / `INVALID_JSON`
- `MISSING_ENV`
- `WRITE_GUARD_BLOCKED` / `WRITE_DISABLED` / `WRITE_NIGHT_BLOCKED`
- `SENSITIVE_ACTION_CONFIRM_REQUIRED`
- `API_FAILED` / `READ_TIMEOUT` / `UNEXPECTED_ERROR`

## Safety

- 绝不输出密钥字段（`token`、`appSecret`）。
- 写操作前必须先确认 `identifier` 合法且允许写入。
- 默认先 `--dryRun true`，得到用户确认后再真实执行。
