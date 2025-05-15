const axios = require('axios');
const { format } = require('date-fns');

async function testQueryDevicesByProduct(baseUrl, token, productKey) {
	const endpoint = `${baseUrl}/api/v1/quickdevice/queryDevice`;
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

async function testBatchDeviceDetails(baseUrl, token, productKey, deviceName) {
	const endpoint = `${baseUrl}/api/v1/quickdevice/batchQueryDeviceDetail`;
	const payload = { productKey, deviceName };

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
	queryDevicePropertyData(
		baseUrl,
		token,
		'hbqPvaMbBQ',
		'washingMode',
		'2025-05-14T06:30:39.694Z',
		'2025-05-14T10:30:39.694Z'
	);
}
