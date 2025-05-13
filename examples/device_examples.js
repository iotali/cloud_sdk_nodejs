// IoT SDK设备管理示例（Node.js版本）
const { IoTClient, createDeviceManager, utils } = require('iotsdk');
const { promisify } = require('util');
const base64 = require('base-64');

// 配置参数
const BASE_URL = 'https://xxx.xxx.com';
const PRODUCT_KEY = 'NrateJMx';
const APP_ID = 'app-680***';
const APP_SECRET = '6808aa30614c4c9f3238***';

// 初始化客户端（使用Async/Await代替Promise链）
async function initializeClientWithCredentials() {
	console.log('\n===== 使用应用凭证初始化客户端示例 =====');

	const client = await IoTClient.fromCredentials({
		baseUrl: BASE_URL,
		appId: APP_ID,
		appSecret: APP_SECRET,
	});

	console.log('\n客户端初始化成功!');
	console.log(`Base URL: ${client.baseUrl}`);
	console.log(`Token: ${client.token.substring(0, 10)}...`);

	return client;
}

// 设备注册示例（改为异步函数）
async function registerDeviceExample(client) {
	console.log('\n===== 设备注册示例 =====');

	const deviceManager = createDeviceManager(client);
	try {
		const response = await deviceManager.registerDevice({
			productKey: PRODUCT_KEY,
			deviceName: '32test',
			nickName: '测试设备003',
		});

		console.log('\n设备注册成功!');
		const deviceInfo = response.data;
		console.log(`设备ID: ${deviceInfo.deviceId}`);
		console.log(`设备密钥: ${deviceInfo.deviceSecret}`);
	} catch (error) {
		console.error('设备注册失败:', error.message);
	}
}

// 设备状态查询（使用解构赋值）
async function queryDeviceStatusExample(client) {
	console.log('\n===== 设备状态查询示例 =====');

	const deviceManager = createDeviceManager(client);
	try {
		const { data: statusData } = await deviceManager.getDeviceStatus('32test');

		console.log('\n设备状态查询成功!');
		console.log(`设备状态: ${statusData.status}`);
		console.log(`状态时间戳: ${statusData.timestamp}`);
	} catch (error) {
		console.error('查询失败:', error.message);
	}
}

// 发送自定义命令（使用Node.js的Buffer代替Python的base64模块）
async function sendCustomCommandExample(client) {
	console.log('\n===== 自定义指令下发示例 =====');

	const messageContent = '{"washingMode": 2, "washingTime": 30}';
	console.log(`原始消息内容: ${messageContent}`);

	const base64Message = Buffer.from(messageContent).toString('base64');

	try {
		const response = await client.makeRequest({
			endpoint: '/api/v1/device/down/record/add/custom',
			method: 'POST',
			data: {
				deviceName: '32test',
				messageContent: base64Message,
			},
		});

		console.log('\n自定义指令下发成功!');
		console.log('响应数据:', response.data);
	} catch (error) {
		console.error(
			`下发失败: ${error.response?.data?.errorMessage || error.message}`
		);
	}
}

// 主执行函数（使用IIFE包裹异步代码）
(async function main() {
	try {
		console.log('\n===== 创建SDK客户端 =====');
		const client = await initializeClientWithCredentials();

		await registerDeviceExample(client);
		await queryDeviceStatusExample(client);
		await sendCustomCommandExample(client);

		console.log('\n===== 示例运行完成 =====');
	} catch (error) {
		console.error('运行出错:', error.message);
	}
})();
