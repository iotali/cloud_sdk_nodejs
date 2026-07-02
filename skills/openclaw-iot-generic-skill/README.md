# OpenClaw IoT Generic Skill

通用 IoT Skill：基于物模型执行设备读写与查询，不绑定具体设备类型。

## 适用场景

- 智能体需要根据用户意图操作任意 IoT 设备
- 设备由物模型定义属性、事件、服务（identifier）
- 希望统一输出 JSON，便于智能体稳定解析

## 支持的 Action

- `discover`: 查询产品物模型
- `resolve-intent`: 输入自然语言返回候选 identifier
- `list-writable-identifiers`: 输出可写点位清单
- `list-devices`: 查询/搜索设备（`keyword` 服务端分页匹配设备编码和设备昵称）
- `device-status`: 查询设备在线状态
- `device-detail`: 查询设备详情（可返回 `productKey`）
- `query-history`: 历史数据统一查询封装（推荐）
- `query-prop`: 查询单个属性历史
- `query-props`: 查询多个属性历史
- `set-props`: 设置设备属性
- `call-service`: 调用设备服务
- `query-events`: 查询事件记录
- `alarms`: 查询告警；`deviceName` 可选，省略时查询时间窗口内全部设备告警

## 本地调试

```bash
cd skills/openclaw-iot-generic-skill
npm install
cp .env.example .env
```

示例：

```bash
node index.js --action discover --productKey your-product-key
node index.js --action resolve-intent --productKey your-product-key --query "设备状态"
node index.js --action list-writable-identifiers --productKey your-product-key
node index.js --action list-devices --productKey your-product-key --page 1 --pageSize 20 --status ONLINE --fetchAll true
node index.js --action list-devices --keyword "配电房" --page 1 --pageSize 20
node index.js --action device-status --deviceName your-device-code
node index.js --action device-detail --deviceName your-device-code
node index.js --action query-history --deviceName your-device-code --identifiers temperature_1,temperature_2 --range last_24h --downSampling 10s --limit 300
node index.js --action query-history --deviceName your-device-code --identifier temperature_1 --range last_24h --aggregate latest,avg,max --omitData true
node index.js --action set-props --deviceName your-device-code --points '[{"identifier":"power_switch","value":"1"}]' --dryRun true
node index.js --action call-service --deviceName your-device-code --servicePoint '{"identifier":"reboot"}' --pointList '[]' --confirm true
```

默认会静默 SDK 日志，仅输出一行 JSON 到 stdout（`IOT_SKILL_QUIET=true`）。
若需要排查问题，可临时加 `--quiet false` 查看详细日志。
同时会向 `stderr` 输出结构化日志（默认开启，`IOT_STRUCTURED_LOG_ENABLED=true`），包含 action、耗时、结果码、请求摘要、重试信息。

`discover` 默认返回压缩模型（计数 + identifier 列表），避免一次返回超大模型占用 token。
如需完整物模型，使用 `--fullModel true`。
默认启用物模型缓存（TTL 可配置），如需强制刷新可加 `--refreshModel true`。

`query-history` 对历史数据做了统一封装：
- 支持 `identifier` 或 `identifiers`
- 支持快捷时间窗口 `range`（也支持显式 `startTime/endTime`）
- 支持 `limit` 对返回点位裁剪，减少 token 占用
- 支持 `aggregate` 直接返回摘要（`latest|min|max|avg|count|all`）
- 支持 `omitData=true` 仅返回摘要，不返回明细点位

`list-devices` 分页策略：
- 传 `keyword` 或 `status` 时：优先使用服务端分页搜索，`keyword` 同时模糊匹配设备编码 `deviceName/deviceCode` 和设备昵称 `nickName`
- 不传搜索条件时，`fetchAll=true`（默认）：先拉产品下设备再进行本地分页
- 不传搜索条件且 `fetchAll=false`：按服务端分页请求，网络成本更低
- 若平台未按 `page/pageSize` 生效，技能会自动回退到本地分页，并在返回中标记 `paginationMode=server_page_incompatible_fallback`
- 精简返回（`brief=true`）会包含 `deviceName/deviceCode`、`nickName`、`productKey` 字段，便于后续联动设备级操作

M3 新增能力：
- 结构化日志：`stderr` 输出 JSON 单行日志（不污染 `stdout`）
- 读操作韧性：自动超时和指数退避重试（默认 `10000ms / 2 次 / 300ms`）
  - 读超时（`READ_TIMEOUT`）会按同样策略自动重试，并在结构化日志中记录 `retryCount/retries`
- 风险策略（基于 `.env`）：
  - `IOT_ALLOW_WRITE=false` 可全局禁写
  - 夜间限制：`IOT_WRITE_NIGHT_BLOCK_ENABLED=true` + `IOT_WRITE_NIGHT_START/END`
  - 敏感操作二次确认：`IOT_SENSITIVE_ACTIONS=call-service,set-props` 后需传 `--confirm true`

M2 新增能力：
- `resolve-intent`：将自然语言关键词映射到物模型候选点位/服务
- `list-writable-identifiers`：列出可写属性，支持 `--onlyAllowed true` 与白名单联动
- `model-cache`：按 `productKey` 缓存物模型，减少重复请求与 token 成本

## 与 OpenClaw 集成

### 方式一：一键远程安装（推荐）

```bash
bash <(curl -fsSL "https://raw.githubusercontent.com/iotali/cloud_sdk_nodejs/master/skills/openclaw-iot-generic-skill/install.sh") --tag v1.1.3
```

可选参数：
- `--tag <tag-or-branch>`：安装指定版本（默认 `master`）
- `--target <dir>`：安装目录（默认 `~/.openclaw/skills/my-iot-generic-tool`）
- `--force`：覆盖已有目录
- `--no-install`：跳过 `npm install`
- `--preserve-env`：与 `--force` 搭配，覆盖安装时自动保留旧 `.env`

示例：

```bash
bash <(curl -fsSL "https://raw.githubusercontent.com/iotali/cloud_sdk_nodejs/master/skills/openclaw-iot-generic-skill/install.sh") \
  --tag master \
  --target ~/.openclaw/skills/my-iot-generic-tool \
  --force \
  --preserve-env
```

### 方式二：手动复制安装

```bash
mkdir -p ~/.openclaw/skills/my-iot-generic-tool
cp -r skills/openclaw-iot-generic-skill/* ~/.openclaw/skills/my-iot-generic-tool/
cp skills/openclaw-iot-generic-skill/.env.example ~/.openclaw/skills/my-iot-generic-tool/.env
cd ~/.openclaw/skills/my-iot-generic-tool
npm install
```

安装后：
1. 填写 `.env`（`IOT_BASE_URL` / `IOT_TOKEN` 或 `IOT_APP_ID+IOT_APP_SECRET`）
2. 在 OpenClaw 中通过 `SKILL.md` 规则触发命令调用。
   诊断场景可直接复用 `TASK_TEMPLATES.md` 的多轮模板。

### 已安装实例如何升级

推荐按 tag 升级，使用 `--preserve-env` 自动保留配置：

```bash
SKILL_DIR=~/.openclaw/skills/my-iot-generic-tool

bash <(curl -fsSL "https://raw.githubusercontent.com/iotali/cloud_sdk_nodejs/master/skills/openclaw-iot-generic-skill/install.sh") \
  --tag v1.1.3 \
  --target "${SKILL_DIR}" \
  --force \
  --preserve-env
```

说明：
- `--tag` 用于固定版本，建议在生产环境使用 tag 而非 `master`
- `--preserve-env` 仅在 `--force` 时生效，用于自动保留已有 `.env`
- 回滚方式：将 `--tag` 改为旧版本后重新执行上述升级命令
- 批量部署时，建议统一维护一个版本号（同一批环境使用同一 tag）

注意：
- `IOT_BASE_URL` 请使用**不带尾部 `/`** 的形式（例如 `https://iot.know-act.com`）。
- 若写成 `https://iot.know-act.com/`，在部分环境下鉴权可能返回 `403`。
- 文档与命令示例中不要填写真实 `IOT_APP_ID`、`IOT_APP_SECRET`、`IOT_TOKEN`。
- 可复现命令示例：

```bash
IOT_BASE_URL=https://your-iot-domain.com \
IOT_APP_ID=your-app-id \
IOT_APP_SECRET=your-app-secret \
node index.js --action alarms --startTime "2025-12-01 00:00:00" --endTime "2025-12-31 23:59:59" --page 1 --pageSize 20

IOT_BASE_URL=https://your-iot-domain.com \
IOT_APP_ID=your-app-id \
IOT_APP_SECRET=your-app-secret \
node index.js --action alarms --deviceName 8AOE6Mwbhj --startTime "2025-12-01 00:00:00" --endTime "2025-12-31 23:59:59"
```

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
- 使用 `IOT_ALLOW_WRITE`、`IOT_WRITE_NIGHT_BLOCK_ENABLED`、`IOT_SENSITIVE_ACTIONS` 做分层风控
- 对写操作先使用 `--dryRun true` 预演
- 不在日志或提示词中输出任何密钥
