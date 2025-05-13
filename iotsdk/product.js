const log4js = require('log4js');
const { IoTClient } = require('./client');

// 配置日志
log4js.configure({
	appenders: { iotsdk: { type: 'console' } },
	categories: { default: { appenders: ['iotsdk'], level: 'info' } },
});
const logger = log4js.getLogger('iotsdk');

class ProductManager {
	/**
	 * 初始化产品管理模块
	 * @param {IoTClient} client - IoT客户端实例
	 */
	constructor(client) {
		this.client = client;
		this.logger = client.logger;
	}

	/**
	 * 新建产品
	 * @param {string} productName - 产品名称
	 * @param {string} productKey - 产品密钥
	 * @param {string} authType - 认证类型
	 * @param {string} productSecret - 产品密钥
	 * @returns {Promise<Object>}
	 */
	async createProduct(productName, productKey, authType, productSecret) {
		const endpoint = '/api/v1/product/create';
		const payload = {
			productName,
			productKey,
			authType,
			productSecret,
		};
		this.logger.info(`创建产品: ${payload}`);
		const response = await this.client._make_request(endpoint, payload);

		if (this.client.check_response(response)) {
			const productInfo = response.data;
			this.logger.info(`产品创建成功: ${productInfo.name}`);
			this.logger.info(`产品ID: ${productInfo.id}`);
			this.logger.info(`产品密钥: ${productInfo.key}`);
		}

		return response;
	}

	/**
	 * 查询指定产品详细信息
	 * @param {string} productId - 产品ID
	 * @returns {Promise<Object>}
	 */
	async getProductDetail(productId, productKey) {
		if (!productId && !productKey) {
			throw new Error('产品ID(productId)或产品密钥(productKey)必须提供其一');
		}

		const endpoint = '/api/v1/product/query';
		const payload = productId ? { productId } : { productKey };

		const response = await this.client._make_request(endpoint, payload);

		if (this.client.check_response(response)) {
			const productInfo = response.data;
			this.logger.info(`产品名称: ${productInfo.name}`);
			this.logger.info(`产品状态: ${productInfo.status}`);
			this.logger.info(`创建时间: ${productInfo.createTime}`);
		}

		return response;
	}

	/**
	 * 查询产品列表（支持名称过滤）
	 * @param {Object} request - 查询参数（包含productName、page、pageSize等）
	 * @returns {Promise<Object>}
	 */
	async queryProductList(request) {
		const endpoint = '/api/v1/product/queryListAll';
		const payload = request;

		const response = await this.client._make_request(endpoint, payload, 'POST');

		if (this.client.check_response(response)) {
			const productList = response.data;
			this.logger.info(`查询到${productList.length}个产品`);
			productList.forEach((product) => {
				this.logger.info(`产品名称: ${product.name}, 状态: ${product.status}`);
			});
		}

		return response;
	}

	/**
	 * 删除产品
	 * @param {string} productId - 产品ID
	 * @returns {Promise<Object>}
	 */
	async deleteProduct(productId) {
		if (!productId) {
			throw new Error('产品ID(productId)必须提供');
		}

		const endpoint = '/api/v1/product/delete';
		const payload = { id: productId };

		const response = await this.client._make_request(endpoint, payload);

		if (this.client.check_response(response)) {
			this.logger.info(`产品删除成功，ID: ${productId}`);
		}

		return response;
	}
}

module.exports = { ProductManager };
