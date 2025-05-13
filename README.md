# IoT 云平台 SDK (Node.js)

一款专为 IoT 设备连接与管理设计的 Node.js 开发工具包，提供安全、高效的云平台交互能力，支持多认证方式与全生命周期设备管理。

## 核心架构

采用模块化设计，关键组件分工明确：

- **IoTClient**（核心客户端）: 负责基础 HTTP 通信、认证管理（含 token 自动刷新）及响应处理
- **DeviceManager**（设备管理器）: 封装设备注册/查询/控制等全链路操作接口
- **Utils**（工具集）: 包含数据编码/解码、时间戳转换、日志工具等实用功能

## 功能特性

- 认证管理
  - 通过 token 直接认证
  - **新增：** 通过应用凭证(appId/appSecret)自动获取 token
- 设备管理
  - 设备注册
  - 设备详情查询
  - 设备状态查询
  - 批量设备状态查询
- 远程控制
  - RRPC 消息发送
  - 自定义指令下发（异步）

## 安装要求

1. Node.js 14 或更高版本
2. 安装依赖库：

```bash
npm install
```

## 快速开始

### 1. 创建客户端和设备管理器

#### 方式一：使用 token 创建客户端（传统方式）

```javascript
const iotsdk = require('./iotsdk');

// 创建IoT客户端
const client = iotsdk.createClient({
	baseUrl: 'https://your-iot-platform-url',
	token: 'your-auth-token',
});

// 创建设备管理器
const deviceManager = iotsdk.createDeviceManager(client);
```

#### 方式二：使用应用凭证创建客户端（推荐方式）

```javascript
const { IoTClient } = require('./iotsdk/client');

// 使用应用凭证自动获取token并创建客户端
const client = IoTClient.fromCredentials({
	baseUrl: 'https://your-iot-platform-url',
	appId: 'your-app-id',
	appSecret: 'your-app-secret',
});

// 创建设备管理器
const deviceManager = iotsdk.createDeviceManager(client);
```

### 2. 设备注册

```javascript
// 注册设备
const response = await deviceManager.registerDevice({
	productKey: 'your-product-key',
	deviceName: 'your-device-name', // 可选
	nickName: '设备显示名称', // 可选
});

// 检查结果
if (client.checkResponse(response)) {
	const deviceInfo = response.data;
	console.log(`设备ID: ${deviceInfo.deviceId}`);
	console.log(`设备密钥: ${deviceInfo.deviceSecret}`);
}
```

### 3. 查询设备详情

```javascript
// 通过设备名称查询
const response1 = await deviceManager.getDeviceDetail({
	deviceName: 'your-device-name',
});

// 或通过设备ID查询
const response2 = await deviceManager.getDeviceDetail({
	deviceId: 'your-device-id',
});

// 处理结果
if (client.checkResponse(response1)) {
	const deviceInfo = response1.data;
	console.log(`设备状态: ${deviceInfo.status}`);
}
```

### 4. 查询设备状态

```javascript
// 查询设备在线状态
try {
	const statusResponse = await deviceManager.getDeviceStatus({
		deviceName: 'your-device-name',
	});

	if (client.checkResponse(statusResponse)) {
		const statusData = statusResponse.data;
		console.log(`设备状态: ${statusData.status}`);
		console.log(`状态时间戳: ${statusData.timestamp}`);
	}
} catch (error) {
	console.error('状态查询失败:', error);
}
```

### 5. 批量查询设备状态

```javascript
// 批量查询设备状态
const deviceNames = ['device1', 'device2', 'device3'];

try {
	const batchResponse = await deviceManager.batchGetDeviceStatus({
		deviceNameList: deviceNames,
	});

	if (client.checkResponse(batchResponse)) {
		const devicesData = batchResponse.data;
		devicesData.forEach((device) => {
			console.log(`设备名称: ${device.deviceName}`);
			console.log(`设备状态: ${device.status}`);
			console.log(`最后在线时间: ${device.lastOnlineTime}`);
			console.log('-------------------');
		});
	}
} catch (error) {
	console.error('批量查询失败:', error);
}
```

### 6. 发送 RRPC 消息

```javascript
// 发送RRPC消息
try {
	const rrpcResponse = await deviceManager.sendRrpcMessage({
		deviceName: 'your-device-name',
		productKey: 'your-product-key',
		messageContent: 'Hello Device',
		timeout: 5000,
	});

	if (client.checkResponse(rrpcResponse)) {
		if (rrpcResponse.payloadBase64Byte) {
			const decodedResponse = Buffer.from(
				rrpcResponse.payloadBase64Byte,
				'base64'
			).toString('utf-8');
			console.log(`设备响应: ${decodedResponse}`);
		}
	}
} catch (error) {
	console.error('RRPC消息发送失败:', error);
}
```

### 7. 发送自定义指令（异步）

```javascript
const { Buffer } = require('buffer');

// 发送自定义指令
try {
	const messageContent = JSON.stringify({
		command: 'set_mode',
		params: {
			mode: 2,
			duration: 30,
		},
	});

	const payload = {
		deviceName: 'your-device-name',
		messageContent: Buffer.from(messageContent).toString('base64'),
	};

	const customResponse = await client.makeRequest(
		'/api/v1/device/down/record/add/custom',
		payload
	);

	if (client.checkResponse(customResponse)) {
		console.log('自定义指令下发成功!');
	}
} catch (error) {
	console.error('指令发送失败:', error);
}
```

## 完整示例

### 使用应用凭证并重用客户端

```javascript
const { IoTClient } = require('./iotsdk/client');
const iotsdk = require('./iotsdk');
const { Buffer } = require('buffer');

// 配置参数
const config = {
	baseUrl: 'https://your-iot-platform-url',
	appId: 'your-app-id',
	appSecret: 'your-app-secret',
	productKey: 'your-product-key',
};

(async () => {
	try {
		// 初始化客户端（仅一次）
		const client = IoTClient.fromCredentials(config);
		console.log(`客户端初始化成功，Token: ${client.token.substring(0, 10)}...`);

		// 创建设备管理器
		const deviceManager = iotsdk.createDeviceManager(client);

		// 执行多个操作，复用同一个客户端
		const deviceName = 'test-device-1';

		// 查询设备状态
		const statusResponse = await deviceManager.getDeviceStatus({ deviceName });
		if (client.checkResponse(statusResponse)) {
			const status = statusResponse.data?.status || 'unknown';
			console.log(`设备状态: ${status}`);
		}

		// 发送指令
		const commandJson = JSON.stringify({ command: 'refresh' });
		await deviceManager.sendRrpcMessage({
			deviceName,
			productKey: config.productKey,
			messageContent: commandJson,
		});

		// 其他操作...
	} catch (error) {
		console.error('发生错误:', error);
	}
})();
```

## 示例代码

参见 `examples` 目录下的示例文件，特别是 `product_examples.js`，展示了如何使用应用凭证初始化客户端并执行各种产品操作。

## 异常处理

SDK 提供了统一的异常处理机制：

```javascript
try {
	const response = await deviceManager.getDeviceStatus({
		deviceName: 'your-device-name',
	});

	if (client.checkResponse(response)) {
		// 处理成功响应
	} else {
		// 处理API错误
		const errorMsg = response.errorMessage || '未知错误';
		console.error(`API调用失败: ${errorMsg}`);
	}
} catch (error) {
	// 处理网络或其他异常
	console.error('发生异常:', error);
}
```

## 自定义日志

SDK 支持使用 log4js 日志库：

```javascript
const log4js = require('log4js');

// 配置日志系统
log4js.configure({
	appenders: {
		iotsdk: { type: 'console' },
	},
	categories: {
		default: { appenders: ['iotsdk'], level: 'debug' },
	},
});

// 获取日志记录器
const logger = log4js.getLogger('iotsdk');

// 创建带自定义日志的客户端
const client = iotsdk.createClient({
	baseUrl: 'https://your-iot-platform-url',
	token: 'your-auth-token',
	logger,
});

// 或使用应用凭证创建
const client = IoTClient.fromCredentials({
	baseUrl: 'https://your-iot-platform-url',
	appId: 'your-app-id',
	appSecret: 'your-app-secret',
	logger,
});
```

## 注意事项

- **认证方式**：推荐使用应用凭证方式自动获取 token
- **客户端复用**：创建一次客户端实例后在应用程序中复用，避免重复获取 token
- 使用前请确保已获取正确的认证令牌/应用凭证和产品密钥
- 所有 API 调用都会返回完整的响应内容，便于进一步处理和分析
- 自定义指令下发需要设备已订阅相应的主题

## 贡献

欢迎提交问题和改进建议，也欢迎通过 Pull Request 来提交代码贡献。

## 许可证

MIT License

# cloud_sdk_nodejs
