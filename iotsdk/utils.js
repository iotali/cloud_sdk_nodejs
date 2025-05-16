/**
 * 将毫秒时间戳格式化为可读字符串
 * @param {number|null} timestamp_ms - 毫秒时间戳
 * @returns {string}
 */
function format_timestamp(timestamp_ms) {
	if (!timestamp_ms) return '未知';
	try {
		const dt = new Date(timestamp_ms);
		return dt.toLocaleString();
	} catch (error) {
		return timestamp_ms.toString();
	}
}

/**
 * 将ISO格式时间字符串转换为可读字符串
 * @param {string|null} time_str - ISO格式时间字符串
 * @returns {string}
 */
function format_iso_time(time_str) {
	if (!time_str) return '未知';
	try {
		const dt = new Date(time_str);
		return dt.toLocaleString();
	} catch (error) {
		return time_str;
	}
}

/**
 * 计算并格式化离线时长
 * @param {number} timestamp_ms - 离线时的毫秒时间戳
 * @returns {string}
 */
function format_offline_duration(timestamp_ms) {
	const now_ms = Date.now();
	const offline_duration_ms = now_ms - timestamp_ms;
	const offline_minutes = offline_duration_ms / (1000 * 60);

	if (offline_minutes < 60) {
		return `约 ${Math.floor(offline_minutes)} 分钟`;
	}

	const offline_hours = offline_minutes / 60;
	if (offline_hours < 24) {
		return `约 ${Math.floor(offline_hours)} 小时 ${Math.floor(
			offline_minutes % 60
		)} 分钟`;
	}

	const offline_days = Math.floor(offline_hours / 24);
	const remaining_hours = Math.floor(offline_hours % 24);
	return `约 ${offline_days} 天 ${remaining_hours} 小时`;
}

/**
 * 美化打印JSON数据
 * @param {Object} data - 要打印的JSON数据
 */
function pretty_print_json(data) {
	console.log(JSON.stringify(data, null, 2));
}

/**
 * 获取设备状态的中文描述
 * @param {string} status - 设备状态码
 * @returns {string}
 */
function get_status_text(status) {
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
		._make_request(endpoint, payload)
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
	format_timestamp,
	format_iso_time,
	format_offline_duration,
	pretty_print_json,
	get_status_text,
};
