# IoT 物模型通用技能

- **Description**: 基于 IoT 物模型执行通用设备操作：发现能力、读写属性、调用服务、查询事件和告警。
- **Usage**:
  - 当用户请求“查看设备状态/属性/事件/告警”时使用读操作。
  - 当用户请求“设置设备参数/调用设备方法”时使用写操作。
  - 不要假设设备类型（灯/插座/空调），始终以物模型 `identifier` 为准。

## Commands

1. 发现产品物模型能力  
   `node {{SKILL_PATH}}/index.js --action discover --productKey <productKey>`
   - 默认返回压缩结果（identifier + 计数），减少 token 消耗
   - 如需完整模型：`--fullModel true`

2. 查询设备在线状态  
   `node {{SKILL_PATH}}/index.js --action device-status --deviceName <deviceName>`

3. 查询产品设备列表  
   `node {{SKILL_PATH}}/index.js --action list-devices --productKey <productKey> [--page 1] [--pageSize 20] [--status ONLINE|OFFLINE|UNACTIVE] [--keyword <name>] [--brief true] [--fetchAll true]`
   - `fetchAll=true`：先拉全量再分页过滤（准确，默认）
   - `fetchAll=false`：按服务端分页查询（更省流量，过滤仅当前页）
   - 若平台分页不生效，返回会标记 `paginationMode=server_page_incompatible_fallback`

4. 统一查询历史数据（推荐）  
   `node {{SKILL_PATH}}/index.js --action query-history --deviceName <deviceName> [--identifier <id> | --identifiers '["id1","id2"]' | --identifiers id1,id2] [--range last_1h|last_6h|last_24h|last_7d] [--downSampling 1s] [--limit 200] [--aggregate latest|min|max|avg|count|all] [--omitData true]`
   - 若不传 `startTime/endTime`，可用 `range` 快捷窗口
   - 默认会限制返回数据量，减少 token 开销
   - 优先使用 `--aggregate` 与 `--omitData true` 获取摘要，必要时再拉明细

5. 查询单个属性历史  
   `node {{SKILL_PATH}}/index.js --action query-prop --deviceName <deviceName> --identifier <id> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--downSampling 1s]`

6. 查询多个属性历史  
   `node {{SKILL_PATH}}/index.js --action query-props --deviceName <deviceName> --identifiers '["id1","id2"]' --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--downSampling 1s]`

7. 设置设备属性  
   `node {{SKILL_PATH}}/index.js --action set-props --deviceName <deviceName> --points '[{"identifier":"power_switch","value":"1"}]' [--dryRun true]`

8. 调用设备服务  
   `node {{SKILL_PATH}}/index.js --action call-service --deviceName <deviceName> --servicePoint '{"identifier":"start_device"}' [--pointList '[{"identifier":"mode","value":"2"}]'] [--dryRun true]`

9. 查询设备事件  
   `node {{SKILL_PATH}}/index.js --action query-events --deviceName <deviceName> --identifier <eventId> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss"`

10. 查询告警  
   `node {{SKILL_PATH}}/index.js --action alarms --deviceName <deviceName> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--status <status>]`

## Output Contract

- 成功：`{"ok":true,"requestId":"...","elapsedMs":123,"action":"...","data":{...}}`
- 失败：`{"ok":false,"requestId":"...","elapsedMs":123,"errorCode":"...","errorType":"...","message":"..."}`

`errorType` 取值：
- `validation_error` 参数校验失败
- `auth_error` 认证失败
- `network_error` 网络问题
- `platform_error` 平台接口返回失败
- `unknown_error` 未分类错误

常见 `errorCode`：
- `MISSING_ACTION` 缺少 action
- `MISSING_ARG` 缺少必要参数
- `INVALID_ARG` 参数值不合法
- `INVALID_JSON` JSON 参数格式错误
- `MISSING_ENV` 缺少环境变量配置
- `WRITE_GUARD_BLOCKED` 写点位不在白名单
- `API_FAILED` 平台返回失败
- `UNEXPECTED_ERROR` 未知异常

## Safety

- 写操作前优先根据物模型确认 `identifier` 合法。
- 允许先用 `--dryRun true` 进行预演。
- 绝不输出密钥字段（token、appSecret）。
