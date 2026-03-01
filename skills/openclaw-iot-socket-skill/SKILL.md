# IoT 插座控制技能

- **Description**: 控制 IoT 智能插座开关状态，并查询在线状态。
- **Usage**:
  - 用户说“打开插座/关闭插座”时，执行 `on` 或 `off`。
  - 用户说“查看插座状态”时，执行 `status`。
- **Instructions**:
  1. 使用命令调用本地脚本：
     - `node {{SKILL_PATH}}/index.js --action on --deviceName <deviceName>`
     - `node {{SKILL_PATH}}/index.js --action off --deviceName <deviceName>`
     - `node {{SKILL_PATH}}/index.js --action status --deviceName <deviceName>`
  2. 必须解析脚本输出 JSON：
     - 成功：`{"ok":true,...}`
     - 失败：`{"ok":false,"errorCode":"...","message":"..."}`
  3. 如用户未提供设备名，先尝试使用环境变量 `IOT_DEVICE_NAME`，仍缺失则询问用户。
  4. 写操作（`on/off`）成功后，优先返回执行结果与设备在线状态。

- **Safety**:
  - 不输出任何密钥字段（token、appSecret）。
  - 当脚本返回失败 JSON 时，将 `message` 转述给用户并建议重试。
