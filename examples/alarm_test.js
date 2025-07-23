const IoTClient = require('../iotsdk/client');
const { AlarmManager } = require('../iotsdk/alarm');

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
		const alarmManager = new AlarmManager(client);
		const response = await apiCall(alarmManager, ...args);

		console.log('状态码:', response.code);
		// console.log('API响应:\n', JSON.stringify(response.data, null, 2));

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

// 查询告警列表
async function queryAlarmList(baseUrl, token, params) {
	return handleApiRequest({
		apiCall: (manager) => manager.queryAlarmList(params),
		baseUrl,
		token,
		successMessage: '告警列表查询成功',
		errorMessage: '告警列表查询失败',
		args: [params],
	});
}

// 执行测试
if (require.main === module) {
	const baseUrl = 'http://127.0.0.1:18083';
	const token = '488820fb-41af-40e5-b2d3-d45a8c576eea';
	const params = {
		deviceName: 'MM2025002',
		startTime: '2025-06-14 06:30:39',
		endTime: '2025-07-16 18:30:39',
	};

	queryAlarmList(baseUrl, token, params);
}
