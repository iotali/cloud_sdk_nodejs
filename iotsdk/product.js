const { handleApiRequest } = require('./utils');

class ProductManager {
	/**
	 * 初始化产品管理模块
	 * @param {IoTClient} client - IoT客户端实例
	 */
	constructor(client) {
		this.client = client;
	}

	async createProduct(params) {
		const { productName, productKey, authType, productSecret } = params;

		const endpoint = '/api/v1/product/create';
		const payload = {
			productName,
			productKey,
			authType: authType,
			productSecret: productSecret,
		};

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const data = response;
		}

		return response;
	}

	async getDetail(params) {
		const { productId, productKey } = params;

		const endpoint = '/api/v1/product/query';
		const payload = productId ? { productId } : { productKey };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const data = response;
		}

		return response;
	}

	async delete(params) {
		const { productId, productKey } = params;

		const endpoint = '/api/v1/product/delete';
		const payload = productId ? { productId } : { productKey };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const data = response;
		}

		return response;
	}

	async list(filter) {
		const { productName, page, pageSize } = filter || {};

		const endpoint = '/api/v1/product/queryListAll';
		const payload = {
			productName: productName || '',
			page: page || 1,
			pageSize: pageSize || 20,
		};

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const data = response;
		}

		return response;
	}
}

module.exports = { ProductManager };
