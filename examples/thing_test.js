const axios = require('axios');
const IoTClient = require('../iotsdk/client');
const { ThingManager } = require('../iotsdk/thing');

// 查看指定产品物模型的功能定义 API
// 通用API请求处理器
async function handleApiRequest({
	apiCall,
	baseUrl,
	token,
	successMessage,
	errorMessage,
	args,
}) {
	try {
		const client = new IoTClient({ baseUrl, token });
		const thingManager = new ThingManager(client);
		const response = await apiCall(thingManager, ...args);

		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.success) {
			console.log(`\n✅ ${successMessage}`);
		} else {
			console.log(`\n❌ ${errorMessage}`);
			console.log('错误详情:', response.data?.errorMessage || '未知错误');
		}
		return response.data;
	} catch (error) {
		console.error(
			`请求异常 [${errorMessage}]:`,
			error.response?.data || error.message
		);
		return null;
	}
}

async function queryThingModel(baseUrl, token, productKey) {
	return handleApiRequest({
		apiCall: (manager) => manager.queryThingModel(productKey),
		baseUrl,
		token,
		successMessage: '物模型查询成功',
		errorMessage: '物模型查询失败',
		args: [productKey],
	});
}

async function queryDevicePropertyData(
	baseUrl,
	token,
	deviceName,
	identifier,
	startTime,
	endTime,
	downSampling
) {
	return handleApiRequest({
		apiCall: (manager) =>
			manager.queryDevicePropertyData(
				deviceName,
				identifier,
				startTime,
				endTime,
				downSampling
			),
		baseUrl,
		token,
		successMessage: '属性记录查询成功',
		errorMessage: '属性记录查询失败',
		args: [deviceName, identifier, startTime, endTime, downSampling],
	});
}
// 批量查询指定设备的属性记录
async function queryDevicePropertiesData(
	baseUrl,
	token,
	deviceName,
	identifier,
	startTime,
	endTime,
	downSampling
) {
	return handleApiRequest({
		apiCall: (manager) =>
			manager.queryDevicePropertiesData(
				deviceName,
				identifier,
				startTime,
				endTime,
				downSampling
			),
		baseUrl,
		token,
		successMessage: '批量属性记录查询成功',
		errorMessage: '批量属性记录查询失败',
		args: [deviceName, identifier, startTime, endTime, downSampling],
	});
}
// 查询指定设备的事件记录
async function queryDeviceEventData(
	baseUrl,
	token,
	deviceName,
	identifier,
	startTime,
	endTime
) {
	return handleApiRequest({
		apiCall: (manager) =>
			manager.queryDeviceEventData(deviceName, identifier, startTime, endTime),
		baseUrl,
		token,
		successMessage: '事件记录查询成功',
		errorMessage: '事件记录查询失败',
		args: [deviceName, identifier, startTime, endTime],
	});
}
// 查询指定设备的服务记录
async function queryDeviceServiceData(
	baseUrl,
	token,
	deviceName,
	identifier,
	startTime,
	endTime
) {
	return handleApiRequest({
		apiCall: (manager) =>
			manager.queryDeviceServiceData(
				deviceName,
				identifier,
				startTime,
				endTime
			),
		baseUrl,
		token,
		successMessage: '服务记录查询成功',
		errorMessage: '服务记录查询失败',
		args: [deviceName, identifier, startTime, endTime],
	});
}
// 设置属性值
async function setDevicesProperty(baseUrl, token, deviceName, pointList) {
	return handleApiRequest({
		apiCall: (manager) =>
			manager.setBatchDevicesProperty(deviceName, pointList),
		baseUrl,
		token,
		successMessage: '批量属性设置成功',
		errorMessage: '批量属性设置失败',
		args: [deviceName, pointList],
	});
}
// 调用设备服务
async function invokeThingsService(
	baseUrl,
	token,
	deviceName,
	identifier,
	params
) {
	return handleApiRequest({
		apiCall: (manager) =>
			manager.invokeThingsService(deviceName, identifier, params),
		baseUrl,
		token,
		successMessage: '设备服务调用成功',
		errorMessage: '设备服务调用失败',
		args: [deviceName, identifier, params],
	});
}

// 执行测试
if (require.main === module) {
	const baseUrl = 'http://127.0.0.1:18083';
	const token = '488820fb-41af-40e5-b2d3-d45a8c576eea';

	queryThingModel(baseUrl, token, 'NrateJMx');
	// queryDevicePropertyData(
	// 	baseUrl,
	// 	token,
	// 	'MM2025002',
	// 	'rotation_speed',
	// 	'2025-07-16 06:30:39',
	// 	'2025-07-16 14:30:39'
	// );

	// queryDevicePropertiesData(
	// 	baseUrl,
	// 	token,
	// 	'MM2025002',
	// 	['pressure', 'rotation_speed'],
	// 	'2025-07-16 06:30:39',
	// 	'2025-07-16 14:30:39',
	// 	'10s'
	// );

	// queryDeviceEventData(
	// 	baseUrl,
	// 	token,
	// 	'u9OAii0rXO',
	// 	'overheat_alarm',
	// 	'2025-05-14 06:30:39',
	// 	'2025-05-16 18:30:39'
	// );

	// queryDeviceServiceData(
	// 	baseUrl,
	// 	token,
	// 	'u9OAii0rXO',
	// 	'',
	// 	'2025-05-14 06:30:39',
	// 	'2025-05-16 18:30:39'
	// );

	// setDevicesProperty(
	// 	baseUrl,
	// 	token,
	// 	['u9OAii0rXO', 'L00000002'],
	// 	[{ identifier: 'operation_mode', value: '2' }]
	// );
	// invokeThingsService(
	// 	baseUrl,
	// 	token,
	// 	'u9OAii0rXO',
	// 	[{ identifier: 'mode', value: '2' }],
	// 	{
	// 		identifier: 'start_device',
	// 	}
	// );
}
