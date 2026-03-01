# OpenClaw IoT Socket Skill

> 说明：该目录是单设备示例模板。生产场景建议优先使用通用版  
> `skills/openclaw-iot-generic-skill`（基于物模型，不绑定设备品类）。

本目录提供一个可直接集成到 OpenClaw 的 Skill 模板，用于控制 IoT 智能插座。

## 目录说明

- `SKILL.md`: 给模型看的技能指令
- `index.js`: Skill 执行入口
- `.env.example`: 环境变量模板
- `package.json`: 依赖配置

## 本地调试

1. 安装依赖

```bash
cd skills/openclaw-iot-socket-skill
npm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

3. 执行命令

```bash
node index.js --action status --deviceName your-device
node index.js --action on --deviceName your-device
node index.js --action off --deviceName your-device
```

## 集成到 OpenClaw

1. 创建技能目录

```bash
mkdir -p ~/.openclaw/skills/my-iot-tool
```

2. 拷贝文件到 OpenClaw Skill 目录（至少需要 `SKILL.md`、`index.js`、`package.json`、`.env`）

3. 在 Skill 目录安装依赖

```bash
cd ~/.openclaw/skills/my-iot-tool
npm install
```

4. 准备 `.env` 配置（参考 `.env.example`）

5. 在 OpenClaw 对话中触发技能，如“打开插座”“关闭插座”“查看插座状态”。

## 输出约定

脚本始终输出单行 JSON：

- 成功：`{"ok":true,...}`
- 失败：`{"ok":false,"errorCode":"...","message":"..."}`

这样 OpenClaw/Agent 可以稳定解析结果并组织对用户的自然语言回复。
