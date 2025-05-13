const axios = require('axios');
const { format } = require('date-fns');

async function queryDeviceStatus(baseUrl, token, deviceName, deviceId) {
	/* 调用设备在线状态查询API
    参数:
    baseUrl (string): API基础URL
    token (string): 认证令牌
    deviceName (string, optional): 设备编码
    deviceId (string, optional): 设备唯一标识
    返回:
    object: API响应结果
    */
	if (!deviceName && !deviceId) {
		throw new Error('设备编码(deviceName)和设备ID(deviceId)至少需要提供一个');
	}

	const endpoint = `${baseUrl}/api/v1/quickdevice/status`;
	const payload = {};
	if (deviceName) payload.deviceName = deviceName;
	if (deviceId) payload.deviceId = deviceId;

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.data.success) {
			console.log('\n✅ 设备状态查询成功!');
			const statusData = response.data.data;
			const deviceStatus = statusData.status;
			const timestampMs = statusData.timestamp;

			const statusMap = {
				ONLINE: '在线',
				OFFLINE: '离线',
				UNACTIVE: '未激活',
			};
			const statusText = statusMap[deviceStatus] || deviceStatus;

			let timeStr;
			if (timestampMs) {
				const dt = new Date(timestampMs);
				timeStr = format(dt, 'yyyy-MM-dd HH:mm:ss');
			} else {
				timeStr = '未知';
			}

			console.log(`设备状态: ${statusText}`);
			console.log(`状态更新时间: ${timeStr}`);
			console.log(`状态时间戳: ${timestampMs}`);

			if (deviceStatus === 'OFFLINE' && timestampMs) {
				const nowMs = Date.now();
				const offlineDurationMs = nowMs - timestampMs;
				const offlineMinutes = Math.floor(offlineDurationMs / (1000 * 60));

				let offlineText;
				if (offlineMinutes < 60) {
					offlineText = `约 ${offlineMinutes} 分钟`;
				} else {
					const offlineHours = Math.floor(offlineMinutes / 60);
					if (offlineHours < 24) {
						const remainingMinutes = offlineMinutes % 60;
						offlineText = `约 ${offlineHours} 小时 ${remainingMinutes} 分钟`;
					} else {
						const offlineDays = Math.floor(offlineHours / 24);
						const remainingHours = offlineHours % 24;
						offlineText = `约 ${offlineDays} 天 ${remainingHours} 小时`;
					}
				}
				console.log(`离线时长: ${offlineText}`);
			}
		} else {
			console.log('\n❌ 设备状态查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}

// 使用示例
if (require.main === module) {
	const baseUrl = 'http://121.40.253.224:10081';
	const token = '488820fb-41af-40e5-b2d3-d45a8c576eea';

	console.log('\n通过设备编码查询设备状态:');
	queryDeviceStatus(baseUrl, token, 'test_device_001', null);

	console.log('\n通过设备ID查询设备状态:');
	queryDeviceStatus(baseUrl, token, null, '1919379345382572032');
}
