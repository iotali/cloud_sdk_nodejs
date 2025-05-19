/**
 * 将毫秒时间戳格式化为可读字符串
 * @param {number|null} timestampMs - 毫秒时间戳
 * @returns {string}
 */
function formatTimestamp(timestampMs) {
	if (!timestampMs) return '未知';
	try {
		const dt = new Date(timestampMs);
		return dt.toLocaleString();
	} catch (error) {
		return timestampMs.toString();
	}
}

/**
 * 将ISO格式时间字符串转换为可读字符串
 * @param {string|null} timeStr - ISO格式时间字符串
 * @returns {string}
 */
function formatIsoTime(timeStr) {
	if (!timeStr) return '未知';
	try {
		const dt = new Date(timeStr);
		return dt.toLocaleString();
	} catch (error) {
		return timeStr;
	}
}

/**
 * 计算并格式化离线时长
 * @param {number} timestampMs - 离线时的毫秒时间戳
 * @returns {string}
 */
function formatOfflineDuration(timestampMs) {
	const nowMs = Date.now();
	const offlineDurationMs = nowMs - timestampMs;
	const offlineMinutes = offlineDurationMs / (1000 * 60);

	if (offlineMinutes < 60) {
		return `约 ${Math.floor(offlineMinutes)} 分钟`;
	}

	const offlineHours = offlineMinutes / 60;
	if (offlineHours < 24) {
		return `约 ${Math.floor(offlineHours)} 小时 ${Math.floor(
			offlineMinutes % 60
		)} 分钟`;
	}

	const offlineDays = Math.floor(offlineHours / 24);
	const remainingHours = Math.floor(offlineHours % 24);
	return `约 ${offlineDays} 天 ${remainingHours} 小时`;
}

/**
 * 美化打印JSON数据
 * @param {Object} data - 要打印的JSON数据
 */
function prettyPrintJson(data) {
	console.log(JSON.stringify(data, null, 2));
}

/**
 * 获取设备状态的中文描述
 * @param {string} status - 设备状态码
 * @returns {string}
 */
function getStatusText(status) {
	const status_map = {
		ONLINE: '在线',
		OFFLINE: '离线',
		UNACTIVE: '未激活',
	};
	return status_map[status] || status;
}

const handleApiRequest = ({
	client,
	endpoint,
	payload,
	logger,
	resourceType,
}) => {
	if (!client || !endpoint) {
		throw new Error('缺少必要的客户端配置或API端点');
	}

	console.debug(`正在请求${resourceType}接口: ${endpoint}`, payload);

	return client
		.makeRequest(endpoint, payload)
		.then((response) => {
			if (response.code === 200) {
				console.info(`${resourceType}操作成功: ${endpoint}`);
				return response.data;
			}
			console.error(`${resourceType}请求异常: ${response.statusText}`);
			throw new Error(response.data?.errorMessage || 'API请求失败');
		})
		.catch((error) => {
			console.error(`${resourceType}请求错误: ${error.message}`, {
				endpoint,
				error: error.stack,
			});
			throw error;
		});
};

module.exports = {
	handleApiRequest,
	formatTimestamp,
	formatIsoTime,
	formatOfflineDuration,
	prettyPrintJson,
	getStatusText,
};
