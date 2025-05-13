const axios = require('axios');
const log4js = require('log4js');

// 配置日志
log4js.configure({
	appenders: { iotsdk: { type: 'console' } },
	categories: { default: { appenders: ['iotsdk'], level: 'info' } },
});
const logger = log4js.getLogger('iotsdk');

class IoTClient {
	/**
	 * 初始化IoT客户端
	 * @param {string} base_url - API基础URL
	 * @param {string} token - 认证令牌
	 */
	constructor(base_url, token) {
		this.base_url = base_url.replace(/\/$/, '');
		this.token = token;

		if (!this.base_url) {
			throw new Error('无效的base_url');
		}
		if (!this.token) {
			throw new Error('无效的token');
		}

		logger.info(`IoT客户端已初始化: ${this.base_url}`);
	}

	/**
	 * 通过应用凭证初始化IoT客户端
	 * @param {string} base_url - API基础URL
	 * @param {string} app_id - 应用ID
	 * @param {string} app_secret - 应用密钥
	 * @returns {Promise<IoTClient>}
	 */
	static async from_credentials(base_url, app_id, app_secret) {
		logger.info('通过应用凭证初始化IoT客户端');

		const auth_url = `${base_url.replace(/\/$/, '')}/api/v1/oauth/auth`;
		const headers = { 'Content-Type': 'application/json' };
		const payload = { appId: app_id, appSecret: app_secret };

		logger.debug(`发送认证请求: POST ${auth_url}`);
		logger.debug(`认证请求体: ${JSON.stringify(payload)}`);

		try {
			const response = await axios.post(auth_url, payload, { headers });
			const result = response.data;
			logger.debug(`收到认证响应: ${JSON.stringify(result)}`);

			if (!result.success || result.code !== 200) {
				const error_msg = result.errorMessage || '未知错误';
				logger.error(`认证失败: ${error_msg}`);
				throw new Error(`认证失败: ${error_msg}`);
			}

			const token = result.data;
			logger.info('认证成功，已获取token');
			return new IoTClient(base_url, token);
		} catch (error) {
			logger.error(`认证请求错误: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 发送API请求的通用方法
	 * @param {string} endpoint - API端点路径
	 * @param {Object} payload - 请求体数据
	 * @param {string} method - HTTP方法(默认POST)
	 * @param {Object} additional_headers - 附加的请求头
	 * @returns {Promise<Object>}
	 */
	async _make_request(
		endpoint,
		payload = {},
		method = 'POST',
		additional_headers = {}
	) {
		const url = `${this.base_url}${endpoint}`;
		const headers = {
			'Content-Type': 'application/json',
			token: this.token,
			...additional_headers,
		};

		logger.debug(`发送请求: ${method} ${url}`);
		logger.debug(`请求头: ${JSON.stringify(headers)}`);
		logger.debug(`请求体: ${JSON.stringify(payload)}`);

		try {
			let response;
			if (method.toUpperCase() === 'POST') {
				response = await axios.post(url, payload, { headers });
			} else if (method.toUpperCase() === 'GET') {
				response = await axios.get(url, { headers, params: payload });
			} else {
				throw new Error(`不支持的HTTP方法: ${method}`);
			}

			const result = response.data;
			logger.debug(`收到响应: ${JSON.stringify(result)}`);
			return result;
		} catch (error) {
			logger.error(`请求错误: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 检查API响应是否成功
	 * @param {Object} response - API响应
	 * @returns {boolean}
	 */
	check_response(response) {
		if (!response) return false;

		const success = response.success || false;
		if (!success) {
			const error_msg = response.errorMessage || '未知错误';
			logger.warning(`API调用失败: ${error_msg}`);
		}
		return success;
	}
}
