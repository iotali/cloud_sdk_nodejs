# Changelog

## v1.1.0

- 将包名调整为 `@iotali/cloud-sdk-nodejs`，避免通用名称冲突，更适合 Node.js 依赖管理。
- 增加稳定导出入口与子路径导出（`exports`），支持主入口和模块化引入。
- 完善 npm 包元数据（`repository`、`bugs`、`homepage`、`engines`、`keywords`、`publishConfig`）。
- 新增工厂导出：`createClient`、`createThingManager`、`createProductManager`、`createDeviceManager`、`createAlarmManager`。
- 修复 `IoTClient.fromCredentials` 初始化参数错误。
- 更新 README 安装与导入示例，支持 npm 与 GitHub tag 安装方式。
