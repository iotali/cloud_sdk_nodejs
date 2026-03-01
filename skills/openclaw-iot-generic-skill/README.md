# OpenClaw IoT Generic Skill

通用 IoT Skill：基于物模型执行设备读写与查询，不绑定具体设备类型。

## 适用场景

- 智能体需要根据用户意图操作任意 IoT 设备
- 设备由物模型定义属性、事件、服务（identifier）
- 希望统一输出 JSON，便于智能体稳定解析

## 支持的 Action

- `discover`: 查询产品物模型
- `list-devices`: 查询产品下设备列表（支持分页、过滤、分页策略）
- `device-status`: 查询设备在线状态
- `query-history`: 历史数据统一查询封装（推荐）
- `query-prop`: 查询单个属性历史
- `query-props`: 查询多个属性历史
- `set-props`: 设置设备属性
- `call-service`: 调用设备服务
- `query-events`: 查询事件记录
- `alarms`: 查询告警

## 本地调试

```bash
cd skills/openclaw-iot-generic-skill
npm install
cp .env.example .env
```

示例：

```bash
node index.js --action discover --productKey your-product-key
node index.js --action list-devices --productKey your-product-key --page 1 --pageSize 20 --status ONLINE --fetchAll true
node index.js --action device-status --deviceName your-device-name
node index.js --action query-history --deviceName your-device-name --identifiers temperature_1,temperature_2 --range last_24h --downSampling 10s --limit 300
node index.js --action query-history --deviceName your-device-name --identifier temperature_1 --range last_24h --aggregate latest,avg,max --omitData true
node index.js --action set-props --deviceName your-device-name --points '[{"identifier":"power_switch","value":"1"}]' --dryRun true
```

默认会静默 SDK 日志，仅输出一行 JSON 到 stdout（`IOT_SKILL_QUIET=true`）。
若需要排查问题，可临时加 `--quiet false` 查看详细日志。

`discover` 默认返回压缩模型（计数 + identifier 列表），避免一次返回超大模型占用 token。
如需完整物模型，使用 `--fullModel true`。

`query-history` 对历史数据做了统一封装：
- 支持 `identifier` 或 `identifiers`
- 支持快捷时间窗口 `range`（也支持显式 `startTime/endTime`）
- 支持 `limit` 对返回点位裁剪，减少 token 占用
- 支持 `aggregate` 直接返回摘要（`latest|min|max|avg|count|all`）
- 支持 `omitData=true` 仅返回摘要，不返回明细点位

`list-devices` 分页策略：
- `fetchAll=true`（默认）：先拉全量再进行过滤/分页，结果准确
- `fetchAll=false`：按服务端分页请求，网络成本更低；若同时传 `status/keyword`，过滤仅作用于当前页
- 若平台未按 `page/pageSize` 生效，技能会自动回退到本地分页，并在返回中标记 `paginationMode=server_page_incompatible_fallback`

## 与 OpenClaw 集成

1. 复制本目录到 OpenClaw:

```bash
mkdir -p ~/.openclaw/skills/my-iot-generic-tool
cp -r skills/openclaw-iot-generic-skill/* ~/.openclaw/skills/my-iot-generic-tool/
cp skills/openclaw-iot-generic-skill/.env.example ~/.openclaw/skills/my-iot-generic-tool/.env
```

2. 安装依赖并填写 `.env`:

```bash
cd ~/.openclaw/skills/my-iot-generic-tool
npm install
```

3. 在 OpenClaw 中通过 `SKILL.md` 规则触发命令调用。

## 输出约定

脚本始终输出单行 JSON：

- 成功：`{"ok":true,"requestId":"...","elapsedMs":123,"action":"...","data":{...}}`
- 失败：`{"ok":false,"requestId":"...","elapsedMs":123,"errorCode":"...","errorType":"...","message":"..."}`

`errorType`：
- `validation_error` / `auth_error` / `network_error` / `platform_error` / `unknown_error`

常见 `errorCode`：
- `MISSING_ACTION`
- `MISSING_ARG`
- `INVALID_ARG`
- `INVALID_JSON`
- `MISSING_ENV`
- `WRITE_GUARD_BLOCKED`
- `API_FAILED`
- `UNEXPECTED_ERROR`

## 安全建议

- 使用 `IOT_WRITABLE_IDENTIFIERS` 限制可写点位
- 对写操作先使用 `--dryRun true` 预演
- 不在日志或提示词中输出任何密钥
