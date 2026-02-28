class DeviceManager {
	/**
	 * 初始化设备管理模块
	 * @param {IoTClient} client - IoT客户端实例
	 */
	constructor(client) {
		this.client = client;
	}

	#normalizeRegisterArgs(productKeyOrParams, deviceName, nickName) {
		if (
			productKeyOrParams &&
			typeof productKeyOrParams === 'object' &&
			!Array.isArray(productKeyOrParams)
		) {
			return {
				productKey: productKeyOrParams.productKey,
				deviceName: productKeyOrParams.deviceName,
				nickName: productKeyOrParams.nickName,
			};
		}
		return { productKey: productKeyOrParams, deviceName, nickName };
	}

	#normalizeDeviceIdentityArgs(deviceNameOrParams, deviceId) {
		if (
			deviceNameOrParams &&
			typeof deviceNameOrParams === 'object' &&
			!Array.isArray(deviceNameOrParams)
		) {
			return {
				deviceName: deviceNameOrParams.deviceName,
				deviceId: deviceNameOrParams.deviceId,
			};
		}
		return { deviceName: deviceNameOrParams, deviceId };
	}

	#normalizeProductQueryArgs(productKeyOrParams, page, pageSize) {
		if (
			productKeyOrParams &&
			typeof productKeyOrParams === 'object' &&
			!Array.isArray(productKeyOrParams)
		) {
			return {
				productKey: productKeyOrParams.productKey,
				page: productKeyOrParams.page ?? 1,
				pageSize: productKeyOrParams.pageSize ?? 20,
			};
		}
		return { productKey: productKeyOrParams, page, pageSize };
	}

	#normalizeBatchDetailArgs(productKeyOrParams, deviceNames) {
		if (
			productKeyOrParams &&
			typeof productKeyOrParams === 'object' &&
			!Array.isArray(productKeyOrParams)
		) {
			return {
				productKey: productKeyOrParams.productKey,
				deviceNames: productKeyOrParams.deviceNames,
			};
		}
		return { productKey: productKeyOrParams, deviceNames };
	}

	/**
	 * 注册设备
	 * @param {string} productKey - 产品唯一标识码
	 * @param {string} [deviceName] - 设备标识码，可选，若未提供则自动生成
	 * @param {string} [nickName] - 设备显示名称，可选
	 * @returns {Promise<Object>}
	 */
	async registerDevice(productKey, deviceName, nickName) {
		const args = this.#normalizeRegisterArgs(productKey, deviceName, nickName);
		if (!args.productKey) {
			throw new Error('productKey 不能为空');
		}

		const endpoint = '/api/v1/quickdevice/register';
		const payload = { productKey: args.productKey };

		if (args.deviceName) payload.deviceName = args.deviceName;
		if (args.nickName) payload.nickName = args.nickName;

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const deviceInfo = response.data;
			console.info(`设备注册成功: ${deviceInfo.deviceName}`);
			console.info('设备信息摘要:');
			console.info(`产品密钥: ${deviceInfo.productKey}`);
			console.info(`设备名称: ${deviceInfo.deviceName}`);
			console.info(`显示名称: ${deviceInfo.nickName}`);
			console.info(`设备ID: ${deviceInfo.deviceId}`);
			console.info(`设备密钥: ${deviceInfo.deviceSecret}`);
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
		const args = this.#normalizeDeviceIdentityArgs(deviceName, deviceId);
		if (!args.deviceName && !args.deviceId) {
			throw new Error('设备编码(deviceName)和设备ID(deviceId)至少需要提供一个');
		}

		const endpoint = '/api/v1/quickdevice/detail';
		const payload = {};
		if (args.deviceName) payload.deviceName = args.deviceName;
		if (args.deviceId) payload.deviceId = args.deviceId;

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

			console.info(`设备ID: ${deviceInfo.deviceId || '未知'}`);
			console.info(`设备名称: ${deviceInfo.deviceName || '未知'}`);
			console.info(`设备状态: ${statusText}`);
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
		const args = this.#normalizeDeviceIdentityArgs(deviceName, deviceId);
		if (!args.deviceName && !args.deviceId) {
			throw new Error('设备编码(deviceName)和设备ID(deviceId)至少需要提供一个');
		}

		const endpoint = '/api/v1/quickdevice/status';
		const payload = {};
		if (args.deviceName) payload.deviceName = args.deviceName;
		if (args.deviceId) payload.deviceId = args.deviceId;

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

			console.info(`设备状态: ${statusText}`);
			console.info(`状态更新时间: ${time_str}`);

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

				console.info(`离线时长: ${offlineText}`);
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
		const args = this.#normalizeProductQueryArgs(productKey, page, pageSize);
		if (!args.productKey) {
			throw new Error('productKey 不能为空');
		}

		const endpoint = '/api/v1/quickdevice/queryDevice';
		const payload = {
			productKey: args.productKey,
			page: Math.max(1, args.page || 1),
			pageSize: Math.min(100, Math.max(1, args.pageSize || 20)),
		};

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const devices = response.data;
			console.info(`查询到${devices.length}台设备`);
			devices.forEach((device, index) => {
				console.info(
					`设备${index + 1}: ${device.deviceName} (${device.deviceId})`
				);
				console.info(`状态: ${device.status === 'ONLINE' ? '在线' : '离线'}`);
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
		const args = this.#normalizeBatchDetailArgs(productKey, deviceNames);
		if (!args.productKey) {
			throw new Error('productKey 不能为空');
		}
		if (!args.deviceNames || args.deviceNames.length === 0) {
			throw new Error('设备名称列表不能为空');
		}

		const endpoint = '/api/v1/quickdevice/batchQueryDeviceDetail';
		const payload = {
			productKey: args.productKey,
			deviceNames: args.deviceNames,
		};

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const devices = response.data;
			console.info(`批量查询到${devices.length}台设备详情`);
			devices.forEach((device) => {
				console.info(`设备名称: ${device.deviceName}`);
				console.info(
					`最后在线: ${new Date(device.lastOnlineTime).toLocaleString()}`
				);
				console.info(`固件版本: ${device.firmwareVersion || '未知'}`);
			});
		}

		return response;
	}
}

module.exports = { DeviceManager };
