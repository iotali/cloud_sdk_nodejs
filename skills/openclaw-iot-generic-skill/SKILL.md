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

3. 查询单个属性历史  
   `node {{SKILL_PATH}}/index.js --action query-prop --deviceName <deviceName> --identifier <id> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--downSampling 1s]`

4. 查询多个属性历史  
   `node {{SKILL_PATH}}/index.js --action query-props --deviceName <deviceName> --identifiers '["id1","id2"]' --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--downSampling 1s]`

5. 设置设备属性  
   `node {{SKILL_PATH}}/index.js --action set-props --deviceName <deviceName> --points '[{"identifier":"power_switch","value":"1"}]' [--dryRun true]`

6. 调用设备服务  
   `node {{SKILL_PATH}}/index.js --action call-service --deviceName <deviceName> --servicePoint '{"identifier":"start_device"}' [--pointList '[{"identifier":"mode","value":"2"}]'] [--dryRun true]`

7. 查询设备事件  
   `node {{SKILL_PATH}}/index.js --action query-events --deviceName <deviceName> --identifier <eventId> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss"`

8. 查询告警  
   `node {{SKILL_PATH}}/index.js --action alarms --deviceName <deviceName> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--status <status>]`

## Output Contract

- 成功：`{"ok":true,"action":"...","data":{...}}`
- 失败：`{"ok":false,"errorCode":"...","message":"..."}`

## Safety

- 写操作前优先根据物模型确认 `identifier` 合法。
- 允许先用 `--dryRun true` 进行预演。
- 绝不输出密钥字段（token、appSecret）。
