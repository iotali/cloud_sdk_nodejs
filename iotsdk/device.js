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
	 * @param {string} product_key - 产品唯一标识码
	 * @param {string} [device_name] - 设备标识码，可选，若未提供则自动生成
	 * @param {string} [nick_name] - 设备显示名称，可选
	 * @returns {Promise<Object>}
	 */
	async register_device(product_key, device_name, nick_name) {
		const endpoint = '/api/v1/quickdevice/register';
		const payload = { productKey: product_key };

		if (device_name) payload.deviceName = device_name;
		if (nick_name) payload.nickName = nick_name;

		const response = await this.client._make_request(endpoint, payload);

		if (this.client.check_response(response)) {
			const device_info = response.data;
			this.logger.info(`设备注册成功: ${device_info.deviceName}`);

			this.logger.info('设备信息摘要:');
			this.logger.info(`产品密钥: ${device_info.productKey}`);
			this.logger.info(`设备名称: ${device_info.deviceName}`);
			this.logger.info(`显示名称: ${device_info.nickName}`);
			this.logger.info(`设备ID: ${device_info.deviceId}`);
			this.logger.info(`设备密钥: ${device_info.deviceSecret}`);
		}

		return response;
	}

	/**
	 * 查询设备详情
	 * @param {string} [device_name] - 设备编码，可选
	 * @param {string} [device_id] - 设备唯一标识，可选
	 * @returns {Promise<Object>}
	 */
	async get_device_detail(device_name, device_id) {
		if (!device_name && !device_id) {
			throw new Error('设备编码(deviceName)和设备ID(deviceId)至少需要提供一个');
		}

		const endpoint = '/api/v1/quickdevice/detail';
		const payload = {};
		if (device_name) payload.deviceName = device_name;
		if (device_id) payload.deviceId = device_id;

		const response = await this.client._make_request(endpoint, payload);

		if (this.client.check_response(response)) {
			const device_info = response.data;
			const device_status = device_info.status;

			const status_map = {
				ONLINE: '在线',
				OFFLINE: '离线',
				UNACTIVE: '未激活',
			};
			const status_text = status_map[device_status] || device_status;

			this.logger.info(`设备ID: ${device_info.deviceId || '未知'}`);
			this.logger.info(`设备名称: ${device_info.deviceName || '未知'}`);
			this.logger.info(`设备状态: ${status_text}`);
		}

		return response;
	}

	/**
	 * 查询设备在线状态
	 * @param {string} [device_name] - 设备编码，可选
	 * @param {string} [device_id] - 设备唯一标识，可选
	 * @returns {Promise<Object>}
	 */
	async get_device_status(device_name, device_id) {
		if (!device_name && !device_id) {
			throw new Error('设备编码(deviceName)和设备ID(deviceId)至少需要提供一个');
		}

		const endpoint = '/api/v1/quickdevice/status';
		const payload = {};
		if (device_name) payload.deviceName = device_name;
		if (device_id) payload.deviceId = device_id;

		const response = await this.client._make_request(endpoint, payload);

		if (this.client.check_response(response)) {
			const status_data = response.data;
			const device_status = status_data.status;
			const timestamp_ms = status_data.timestamp;

			const status_map = {
				ONLINE: '在线',
				OFFLINE: '离线',
				UNACTIVE: '未激活',
			};
			const status_text = status_map[device_status] || device_status;

			let time_str = '未知';
			if (timestamp_ms) {
				const dt = new Date(timestamp_ms);
				time_str = dt.toLocaleString();
			}

			this.logger.info(`设备状态: ${status_text}`);
			this.logger.info(`状态更新时间: ${time_str}`);

			if (device_status === 'OFFLINE' && timestamp_ms) {
				const now_ms = Date.now();
				const offline_duration_ms = now_ms - timestamp_ms;
				const offline_minutes = offline_duration_ms / (1000 * 60);

				let offline_text;
				if (offline_minutes < 60) {
					offline_text = `约 ${Math.floor(offline_minutes)} 分钟`;
				} else {
					const offline_hours = offline_minutes / 60;
					if (offline_hours < 24) {
						offline_text = `约 ${Math.floor(offline_hours)} 小时 ${Math.floor(
							offline_minutes % 60
						)} 分钟`;
					} else {
						const offline_days = Math.floor(offline_hours / 24);
						const remaining_hours = Math.floor(offline_hours % 24);
						offline_text = `约 ${offline_days} 天 ${remaining_hours} 小时`;
					}
				}

				this.logger.info(`离线时长: ${offline_text}`);
			}
		}

		return response;
	}

	/**
	 * 查询产品下所有设备
	 * @param {string} product_key - 产品唯一标识码
	 * @param {number} [page=1] - 页码
	 * @param {number} [page_size=20] - 每页数量
	 * @returns {Promise<Object>}
	 */
	async query_devices_by_product(product_key, page = 1, page_size = 20) {
		const endpoint = '/api/v1/quickdevice/queryDevice';
		const payload = {
			productKey: product_key,
			page: Math.max(1, page),
			pageSize: Math.min(100, Math.max(1, page_size)),
		};

		const response = await this.client._make_request(endpoint, payload);

		if (this.client.check_response(response)) {
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
	 * @param {string} product_key - 产品唯一标识码
	 * @param {string[]} device_names - 设备名称列表
	 * @returns {Promise<Object>}
	 */
	async batch_query_device_details(product_key, device_names) {
		if (!device_names || device_names.length === 0) {
			throw new Error('设备名称列表不能为空');
		}

		const endpoint = '/api/v1/quickdevice/batchQueryDeviceDetail';
		const payload = {
			productKey: product_key,
			deviceNames: device_names,
		};

		const response = await this.client._make_request(endpoint, payload);

		if (this.client.check_response(response)) {
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
