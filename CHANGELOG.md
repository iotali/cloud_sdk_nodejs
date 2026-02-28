# Changelog

## v1.1.1

- `DeviceManager` 增加参数兼容能力：支持对象参数与位置参数两种调用方式。
- 修复 `README.md` 中与实际实现不一致的示例方法（移除不存在的方法调用示例）。
- 更新设备示例脚本 `examples/device_examples.js`，使其与当前 SDK 方法签名一致。

## v1.1.0

- 将包名调整为 `@iotali/cloud-sdk-nodejs`，避免通用名称冲突，更适合 Node.js 依赖管理。
- 增加稳定导出入口与子路径导出（`exports`），支持主入口和模块化引入。
- 完善 npm 包元数据（`repository`、`bugs`、`homepage`、`engines`、`keywords`、`publishConfig`）。
- 新增工厂导出：`createClient`、`createThingManager`、`createProductManager`、`createDeviceManager`、`createAlarmManager`。
- 修复 `IoTClient.fromCredentials` 初始化参数错误。
- 更新 README 安装与导入示例，支持 npm 与 GitHub tag 安装方式。
