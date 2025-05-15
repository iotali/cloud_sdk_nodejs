const axios = require('axios');
const { format } = require('date-fns');

// 查看指定产品物模型的功能定义 API
async function queryThingModel(baseUrl, token, productKey) {
	const endpoint = `${baseUrl}/api/v1/thing/queryThingModel`;
	const payload = { productKey };

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 查询成功!');
			// const data = response.data.data;
			// console.log(`设备: ${data}`);
		} else {
			console.log('\n❌ 查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}

// 查询指定设备的属性记录 API
async function queryDevicePropertyData(
	baseUrl,
	token,
	deviceName,
	identifier,
	startTime,
	endTime
) {
	const endpoint = `${baseUrl}/api/v1/thing/queryDevicePropertyData`;
	const payload = { deviceName, identifier, startTime, endTime };

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 查询成功!');
			// const data = response.data.data;
			// console.log(`设备: ${data}`);
		} else {
			console.log('\n❌ 查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}
// 批量查询指定设备的属性记录
async function queryDevicePropertiesData(
	baseUrl,
	token,
	deviceName,
	identifier,
	startTime,
	endTime
) {
	const endpoint = `${baseUrl}/api/v1/thing/queryDevicePropertiesData`;
	const payload = { deviceName, identifier, startTime, endTime };

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 设备查询成功!');
			const data = response.data.data;
			console.log(`设备: ${data}`);
		} else {
			console.log('\n❌ 查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
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
	const endpoint = `${baseUrl}/api/v1/thing/queryDeviceEventData`;
	const payload = { deviceName, identifier, startTime, endTime };

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 设备查询成功!');
			const data = response.data.data;
			console.log(`设备: ${data}`);
		} else {
			console.log('\n❌ 查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
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
	const endpoint = `${baseUrl}/api/v1/thing/queryDeviceServiceData`;
	const payload = { deviceName, identifier, startTime, endTime };

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 设备查询成功!');
			const data = response.data.data;
			console.log(`设备: ${data}`);
		} else {
			console.log('\n❌ 查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}
// 设置属性值
async function setDevicesProperty(baseUrl, token, deviceName, pointList) {
	const endpoint = `${baseUrl}/api/v1/thing/setBatchDevicesProperty`;
	const payload = { deviceName, pointList };

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 设备查询成功!');
			const data = response.data.data;
			console.log(`设备: ${data}`);
		} else {
			console.log('\n❌ 查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}
// 调用设备服务
async function invokeThingsService(
	baseUrl,
	token,
	deviceName,
	pointList,
	servicePoint
) {
	const endpoint = `${baseUrl}/api/v1/thing/invokeThingsService`;
	const payload = { deviceName, pointList, servicePoint };

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 设备查询成功!');
			const data = response.data.data;
			console.log(`设备: ${data}`);
		} else {
			console.log('\n❌ 查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}

// 执行测试
if (require.main === module) {
	const baseUrl = 'http://127.0.0.1:18083';
	const token = '488820fb-41af-40e5-b2d3-d45a8c576eea';
	// testQueryDevicesByProduct(baseUrl, token, 'NrateJMx');

	// testBatchDeviceDetails(baseUrl, token, 'NrateJMx', [
	// 	'hbqPvaMbBQ',
	// 	'RJeDKWZauj',
	// ]);
	// queryThingModel(baseUrl, token, 'NrateJMx');
	// queryDevicePropertyData(
	// 	baseUrl,
	// 	token,
	// 	'u9OAii0rXO',
	// 	'motor_speed',
	// 	'2025-05-14 06:30:39',
	// 	'2025-05-14 10:30:39'
	// );

	// queryDevicePropertiesData(
	// 	baseUrl,
	// 	token,
	// 	'u9OAii0rXO',
	// 	['motor_speed', 'temperature'],
	// 	'2025-05-14 06:30:39',
	// 	'2025-05-14 10:30:39'
	// );

	// queryDeviceEventData(
	// 	baseUrl,
	// 	token,
	// 	'u9OAii0rXO',
	// 	'overheat_alarm',
	// 	'2025-05-14 06:30:39',
	// 	'2025-05-16 18:30:39'
	// );

	queryDeviceServiceData(
		baseUrl,
		token,
		'u9OAii0rXO',
		'',
		'2025-05-14 06:30:39',
		'2025-05-16 18:30:39'
	);

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
