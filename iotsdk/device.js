const log4js = require('log4js');
const { IoTClient } = require('./client');

// 配置日志
log4js.configure({
	appenders: { iotsdk: { type: 'console' } },
	categories: { default: { appenders: ['iotsdk'], level: 'info' } },
});
const logger = log4js.getLogger('iotsdk');

class DeviceManager {
	/**
	 * 初始化设备管理模块
	 * @param {IoTClient} client - IoT客户端实例
	 */
	constructor(client) {
		this.client = client;
		this.logger = client.logger;
	}

	/**
	 * 注册设备
	 * @param {string} productKey - 产品唯一标识码
	 * @param {string} [deviceName] - 设备标识码，可选，若未提供则自动生成
	 * @param {string} [nickName] - 设备显示名称，可选
	 * @returns {Promise<Object>}
	 */
	async registerDevice(productKey, deviceName, nickName) {
		const endpoint = '/api/v1/quickdevice/register';
		const payload = { productKey: productKey };

		if (deviceName) payload.deviceName = deviceName;
		if (nickName) payload.nickName = nickName;

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const deviceInfo = response.data;
			this.logger.info(`设备注册成功: ${deviceInfo.deviceName}`);

			this.logger.info('设备信息摘要:');
			this.logger.info(`产品密钥: ${deviceInfo.productKey}`);
			this.logger.info(`设备名称: ${deviceInfo.deviceName}`);
			this.logger.info(`显示名称: ${deviceInfo.nickName}`);
			this.logger.info(`设备ID: ${deviceInfo.deviceId}`);
			this.logger.info(`设备密钥: ${deviceInfo.deviceSecret}`);
		}

		return response;
	}

	/**
	 * 查询设备详情
	 * @param {string} [deviceName] - 设备编码，可选
	 * @param {string} [deviceId] - 设备唯一标识，可选
	 * @returns {Promise<Object>}
	 */
	async getDeviceDetail(deviceName, deviceId) {
		if (!deviceName && !deviceId) {
			throw new Error('设备编码(deviceName)和设备ID(deviceId)至少需要提供一个');
		}

		const endpoint = '/api/v1/quickdevice/detail';
		const payload = {};
		if (deviceName) payload.deviceName = deviceName;
		if (deviceId) payload.deviceId = deviceId;

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const deviceInfo = response.data;
			const deviceStatus = deviceInfo.status;

			const statusMap = {
				ONLINE: '在线',
				OFFLINE: '离线',
				UNACTIVE: '未激活',
			};
			const statusText = statusMap[deviceStatus] || deviceStatus;

			this.logger.info(`设备ID: ${deviceInfo.deviceId || '未知'}`);
			this.logger.info(`设备名称: ${deviceInfo.deviceName || '未知'}`);
			this.logger.info(`设备状态: ${statusText}`);
		}

		return response;
	}

	/**
	 * 查询设备在线状态
	 * @param {string} [deviceName] - 设备编码，可选
	 * @param {string} [deviceId] - 设备唯一标识，可选
	 * @returns {Promise<Object>}
	 */
	async getDeviceStatus(deviceName, deviceId) {
		if (!deviceName && !deviceId) {
			throw new Error('设备编码(deviceName)和设备ID(deviceId)至少需要提供一个');
		}

		const endpoint = '/api/v1/quickdevice/status';
		const payload = {};
		if (deviceName) payload.deviceName = deviceName;
		if (deviceId) payload.deviceId = deviceId;

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const statusData = response.data;
			const deviceStatus = statusData.status;
			const timestampMs = statusData.timestamp;

			const statusMap = {
				ONLINE: '在线',
				OFFLINE: '离线',
				UNACTIVE: '未激活',
			};
			const statusText = statusMap[deviceStatus] || deviceStatus;

			let time_str = '未知';
			if (timestampMs) {
				const dt = new Date(timestampMs);
				time_str = dt.toLocaleString();
			}

			this.logger.info(`设备状态: ${statusText}`);
			this.logger.info(`状态更新时间: ${time_str}`);

			if (deviceStatus === 'OFFLINE' && timestampMs) {
				const nowMs = Date.now();
				const offlineDurationMs = nowMs - timestampMs;
				const offlineMinutes = offlineDurationMs / (1000 * 60);

				let offlineText;
				if (offlineMinutes < 60) {
					offlineText = `约 ${Math.floor(offlineMinutes)} 分钟`;
				} else {
					const offlineHours = offlineMinutes / 60;
					if (offlineHours < 24) {
						offlineText = `约 ${Math.floor(offlineHours)} 小时 ${Math.floor(
							offlineMinutes % 60
						)} 分钟`;
					} else {
						const offlineDays = Math.floor(offlineHours / 24);
						const remainingHours = Math.floor(offlineHours % 24);
						offlineText = `约 ${offlineDays} 天 ${remainingHours} 小时`;
					}
				}

				this.logger.info(`离线时长: ${offlineText}`);
			}
		}

		return response;
	}

	/**
	 * 查询产品下所有设备
	 * @param {string} productKey - 产品唯一标识码
	 * @param {number} [page=1] - 页码
	 * @param {number} [pageSize=20] - 每页数量
	 * @returns {Promise<Object>}
	 */
	async queryDevicesByProduct(productKey, page = 1, pageSize = 20) {
		const endpoint = '/api/v1/quickdevice/queryDevice';
		const payload = {
			productKey: productKey,
			page: Math.max(1, page),
			pageSize: Math.min(100, Math.max(1, pageSize)),
		};

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const devices = response.data;
			this.logger.info(`查询到${devices.length}台设备`);
			devices.forEach((device, index) => {
				this.logger.info(
					`设备${index + 1}: ${device.deviceName} (${device.deviceId})`
				);
				this.logger.info(
					`状态: ${device.status === 'ONLINE' ? '在线' : '离线'}`
				);
			});
		}

		return response;
	}

	/**
	 * 批量查询设备详情
	 * @param {string} productKey - 产品唯一标识码
	 * @param {string[]} deviceNames - 设备名称列表
	 * @returns {Promise<Object>}
	 */
	async batchQueryDeviceDetails(productKey, deviceNames) {
		if (!deviceNames || deviceNames.length === 0) {
			throw new Error('设备名称列表不能为空');
		}

		const endpoint = '/api/v1/quickdevice/batchQueryDeviceDetail';
		const payload = {
			productKey: productKey,
			deviceNames: deviceNames,
		};

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const devices = response.data;
			this.logger.info(`批量查询到${devices.length}台设备详情`);
			devices.forEach((device) => {
				this.logger.info(`设备名称: ${device.deviceName}`);
				this.logger.info(
					`最后在线: ${new Date(device.lastOnlineTime).toLocaleString()}`
				);
				this.logger.info(`固件版本: ${device.firmwareVersion || '未知'}`);
			});
		}

		return response;
	}
}

module.exports = { DeviceManager };
