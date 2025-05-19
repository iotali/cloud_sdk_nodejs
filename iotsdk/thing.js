const log4js = require('log4js');
const { IoTClient } = require('./client');

class ThingManager {
	/**
	 * 初始化设备管理模块
	 * @param {IoTClient} client - IoT客户端实例
	 */
	constructor(client) {
		this.client = client;
		this.logger = client.logger;
	}

	/**
	 * 查询设备服务记录
	 * @param {string} deviceName - 设备名称
	 * @param {string} identifier - 服务标识
	 * @param {string} startTime - 开始时间
	 * @param {string} endTime - 结束时间
	 * @returns {Promise<Object>}
	 */
	async queryDeviceServiceData(deviceName, identifier, startTime, endTime) {
		const endpoint = '/api/v1/thing/queryDeviceServiceData';
		const payload = { deviceName, identifier, startTime, endTime };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const data = response;
		}

		return response;
	}

	/**
	 * 批量查询设备属性记录
	 * @param {string} deviceName - 设备名称
	 * @param {string[]} identifiers - 属性标识数组
	 * @param {string} startTime - 开始时间
	 * @param {string} endTime - 结束时间
	 * @returns {Promise<Object>}
	 */
	async queryDevicePropertiesData(deviceName, identifiers, startTime, endTime) {
		const endpoint = '/api/v1/thing/queryDevicePropertiesData';
		const payload = { deviceName, identifier: identifiers, startTime, endTime };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const data = response;
		}

		return response;
	}

	/**
	 * 查询设备属性记录
	 * @param {string} deviceName - 设备名称
	 * @param {string} identifier - 属性标识
	 * @param {string} startTime - 开始时间
	 * @param {string} endTime - 结束时间
	 * @returns {Promise<Object>}
	 */
	async queryDevicePropertyData(deviceName, identifier, startTime, endTime) {
		const endpoint = '/api/v1/thing/queryDevicePropertyData';
		const payload = { deviceName, identifier, startTime, endTime };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const data = response;
		}

		return response;
	}

	/**
	 * 批量查询设备详情
	 * @param {string} product_key - 产品唯一标识码
	 * @param {string[]} device_names - 设备名称列表
	 * @returns {Promise<Object>}
	 */
	async queryThingModel(productKey) {
		const endpoint = '/api/v1/thing/queryThingModel';
		const payload = {
			productKey,
		};
		if (!this.client) {
			throw new Error('IoT client not initialized');
		}
		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const point = response;
		}

		return response;
	}

	// 统一参数校验方法
	#validateParams(params, methodName) {
		const requiredParams = {
			queryDevicePropertyData: [
				'deviceName',
				'identifier',
				'startTime',
				'endTime',
			],
			queryDeviceServiceData: [
				'deviceName',
				'identifier',
				'startTime',
				'endTime',
			],
			queryDeviceEventData: [
				'deviceName',
				'identifier',
				'startTime',
				'endTime',
			],
			setBatchDevicesProperty: ['deviceName', 'pointList'],
			setDevicesProperty: ['deviceName', 'pointList'],
			invokeThingsService: ['deviceName', 'pointList', 'servicePoint'],
			invokeBatchThingsService: ['deviceName', 'pointList', 'servicePoint'],
			callDeviceService: ['deviceName', 'identifier', 'params'],
		};

		requiredParams[methodName].forEach((param) => {
			if (!params[param]) {
				throw new Error(`Missing required parameter: ${param}`);
			}
		});

		// 添加时间格式校验示例
		const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
		if (params.startTime && !timeRegex.test(params.startTime)) {
			throw new Error('时间格式应为 YYYY-MM-DD HH:mm:ss');
		}
	}

	/**
	 * 查询设备事件记录
	 * @param {string} deviceName - 设备名称
	 * @param {string} identifier - 事件标识
	 * @param {string} startTime - 开始时间
	 * @param {string} endTime - 结束时间
	 * @returns {Promise<Object>}
	 */
	async queryDeviceEventData(deviceName, identifier, startTime, endTime) {
		const endpoint = '/api/v1/thing/queryDeviceEventData';
		const payload = { deviceName, identifier, startTime, endTime };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		this.#validateParams(
			{
				deviceName,
				identifier,
				startTime,
				endTime,
			},
			'queryDeviceEventData'
		);

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			return response;
		}

		return response;
	}

	/**
	 * 设置设备属性
	 * @param {string} deviceName - 设备名称
	 * @param {Array} pointList - 属性点列表
	 * @returns {Promise<Object>}
	 */
	async setDevicesProperty(deviceName, pointList) {
		const endpoint = '/api/v1/thing/setDevicesProperty';
		const payload = { deviceName, pointList };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		this.#validateParams(
			{
				deviceName,
				pointList,
			},
			'setDevicesProperty'
		);

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			return response;
		}

		return response;
	}

	/**
	 * 批量设置设备属性
	 * @param {string} deviceName - 设备名称
	 * @param {Array} pointList - 属性点列表
	 * @returns {Promise<Object>}
	 */
	async setBatchDevicesProperty(deviceName, pointList) {
		const endpoint = '/api/v1/thing/setBatchDevicesProperty';
		const payload = { deviceName, pointList };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		this.#validateParams(
			{
				deviceName,
				pointList,
			},
			'setBatchDevicesProperty'
		);

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			return response;
		}

		return response;
	}

	/**
	 * 调用设备服务
	 * @param {string} deviceName - 设备名称
	 * @param {Array} pointList - 属性点列表
	 * @param {Object} servicePoint - 服务参数
	 * @returns {Promise<Object>}
	 */
	async invokeThingsService(deviceName, pointList, servicePoint) {
		this.#validateParams(
			{ deviceName, pointList, servicePoint },
			'invokeThingsService'
		);
		const endpoint = '/api/v1/thing/invokeThingsService';
		const payload = { deviceName, pointList, servicePoint };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			return response;
		}

		return response;
	}

	/**
	 * 批量调用设备服务
	 * @param {string} deviceName - 设备名称
	 * @param {Array} pointList - 属性点列表
	 * @param {Object} servicePoint - 服务参数
	 * @returns {Promise<Object>}
	 */
	async invokeBatchThingsService(deviceName, pointList, servicePoint) {
		this.#validateParams(
			{ deviceName, pointList, servicePoint },
			'invokeBatchThingsService'
		);
		const endpoint = '/api/v1/thing/invokeBatchThingsService';
		const payload = { deviceName, pointList, servicePoint };

		if (!this.client) {
			throw new Error('IoT client not initialized');
		}

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			return response;
		}

		return response;
	}
}
module.exports = { ThingManager };
