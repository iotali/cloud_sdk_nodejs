const { IoTClient } = require('./client');

class AlarmManager {
	/**
	 * 初始化告警管理模块
	 * @param {IoTClient} client - IoT客户端实例
	 */
	constructor(client) {
		this.client = client;
	}

	/**
	 * 查询告警列表
	 * @param {Object} params - 查询参数
	 * @param {string} [params.deviceName] - 设备编码
	 * @param {string} [params.status] - 告警状态，可选
	 * @param {string} [params.startTime] - 开始时间
	 * @param {string} [params.endTime] - 结束时间
	 */
	async queryAlarmList(params = {}) {
		const endpoint = '/api/v1/alarm/queryAlarmListAll';
		const payload = {
			...params,
		};

		const response = await this.client.makeRequest(endpoint, payload);

		if (this.client.checkResponse(response)) {
			const alarms = response.data || [];
			console.info(`查询到${alarms.length}条告警`);
		}

		return response;
	}
}

module.exports = { AlarmManager };
