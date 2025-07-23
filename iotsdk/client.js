const axios = require('axios');
const log4js = require('log4js');

// 配置日志
log4js.configure({
	appenders: { iotsdk: { type: 'console' } },
	categories: { default: { appenders: ['iotsdk'], level: 'info' } },
});

class IoTClient {
	/**
	 * 初始化IoT客户端
	 * @param {string} baseUrl - API基础URL
	 * @param {string} token - 认证令牌
	 */
	constructor({ baseUrl, token }) {
		this.baseUrl = baseUrl.replace(/\/$/, '');
		this.token = token;

		if (!this.baseUrl) {
			throw new Error('无效的baseUrl');
		}
		if (!this.token) {
			throw new Error('无效的token');
		}

		console.info(`IoT客户端已初始化: ${this.baseUrl}`);
	}

	/**
	 * 通过应用凭证初始化IoT客户端
	 * @param {string} baseUrl - API基础URL
	 * @param {string} appId - 应用ID
	 * @param {string} appSecret - 应用密钥
	 * @returns {Promise<IoTClient>}
	 */
	static async fromCredentials({ baseUrl, appId, appSecret }) {
		console.info('通过应用凭证初始化IoT客户端');

		const auth_url = `${baseUrl.replace(/\/$/, '')}/api/v1/oauth/auth`;
		const headers = { 'Content-Type': 'application/json' };
		const payload = { appId, appSecret };

		console.debug(`发送认证请求: POST ${auth_url}`);
		console.debug(`认证请求体: ${JSON.stringify(payload)}`);

		try {
			const response = await axios.post(auth_url, payload, { headers });
			const result = response.data;
			console.debug(`收到认证响应: ${JSON.stringify(result)}`);

			if (!result.success || result.code !== 200) {
				const errorMsg = result.errorMessage || '未知错误';
				console.error(`认证失败: ${errorMsg}`);
				throw new Error(`认证失败: ${errorMsg}`);
			}

			const token = result.data;
			console.info('认证成功，已获取token');
			return new IoTClient(baseUrl, token);
		} catch (error) {
			console.error(`认证请求错误: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 发送API请求的通用方法
	 * @param {string} endpoint - API端点路径
	 * @param {Object} payload - 请求体数据
	 * @param {string} method - HTTP方法(默认POST)
	 * @param {Object} additionalHeaders - 附加的请求头
	 * @returns {Promise<Object>}
	 */
	async makeRequest(
		endpoint,
		payload = {},
		method = 'POST',
		additionalHeaders = {}
	) {
		const url = `${this.baseUrl}${endpoint}`;
		const headers = {
			'Content-Type': 'application/json',
			token: this.token,
			...additionalHeaders,
		};

		console.debug(`发送请求: ${method} ${url}`);
		console.debug(`请求头: ${JSON.stringify(headers)}`);
		console.debug(`请求体: ${JSON.stringify(payload)}`);

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
			console.debug(`收到响应: ${JSON.stringify(result)}`);
			return result;
		} catch (error) {
			console.error(`请��错误: ${error.message}`);
			throw error;
		}
	}

	/**
	 * 检查API响应是否成功
	 * @param {Object} response - API响应
	 * @returns {boolean}
	 */
	checkResponse(response) {
		if (!response) return false;

		const success = response.success || false;
		if (!success) {
			const errorMsg = response.errorMessage || '未知错误';
			console.info(`API调用失败: ${errorMsg}`);
		}
		return success;
	}
}

module.exports = IoTClient;
