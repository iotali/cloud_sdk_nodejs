#!/usr/bin/env node
'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (!token.startsWith('--')) {
			continue;
		}

		const stripped = token.slice(2);
		if (stripped.includes('=')) {
			const [key, ...rest] = stripped.split('=');
			args[key] = rest.join('=');
			continue;
		}

		const next = argv[i + 1];
		if (next && !next.startsWith('--')) {
			args[stripped] = next;
			i += 1;
		} else {
			args[stripped] = true;
		}
	}
	return args;
}

function toResult(ok, payload) {
	return JSON.stringify({ ok, ...payload });
}

function printAndExit(ok, payload, exitCode = ok ? 0 : 1) {
	process.stdout.write(`${toResult(ok, payload)}\n`);
	process.exit(exitCode);
}

function resolveAction(action) {
	if (!action) return null;
	const normalized = String(action).toLowerCase();
	if (normalized === 'on' || normalized === 'off' || normalized === 'status') {
		return normalized;
	}
	return null;
}

function usage() {
	return [
		'Usage:',
		'  node index.js --action on --deviceName <name>',
		'  node index.js --action off --deviceName <name>',
		'  node index.js --action status --deviceName <name>',
		'',
		'Optional:',
		'  --identifier <pointIdentifier>',
		'  --onValue <value>',
		'  --offValue <value>',
		'  --dryRun true',
	].join('\n');
}

async function createSdkClient() {
	const sdk = require('@iotali/cloud-sdk-nodejs');
	const baseUrl = process.env.IOT_BASE_URL;
	const token = process.env.IOT_TOKEN;
	const appId = process.env.IOT_APP_ID;
	const appSecret = process.env.IOT_APP_SECRET;

	if (!baseUrl) {
		throw new Error('缺少环境变量 IOT_BASE_URL');
	}

	let client;
	if (token) {
		client = sdk.createClient({ baseUrl, token });
	} else if (appId && appSecret) {
		client = await sdk.IoTClient.fromCredentials({ baseUrl, appId, appSecret });
	} else {
		throw new Error(
			'缺少认证信息：请配置 IOT_TOKEN，或配置 IOT_APP_ID + IOT_APP_SECRET'
		);
	}

	return {
		sdk,
		client,
		deviceManager: sdk.createDeviceManager(client),
		thingManager: sdk.createThingManager(client),
	};
}

async function run() {
	const args = parseArgs(process.argv.slice(2));

	if (args.help || args.h) {
		printAndExit(true, { message: usage() }, 0);
	}

	const action = resolveAction(args.action);
	if (!action) {
		printAndExit(false, {
			errorCode: 'INVALID_ACTION',
			message: 'action 必须为 on/off/status',
			usage: usage(),
		});
	}

	const deviceName = args.deviceName || process.env.IOT_DEVICE_NAME;
	if (!deviceName) {
		printAndExit(false, {
			errorCode: 'MISSING_DEVICE_NAME',
			message: '缺少 deviceName，请通过 --deviceName 或 IOT_DEVICE_NAME 提供',
		});
	}

	const identifier = args.identifier || process.env.IOT_SWITCH_IDENTIFIER || 'power_switch';
	const onValue = args.onValue ?? process.env.IOT_SWITCH_ON_VALUE ?? '1';
	const offValue = args.offValue ?? process.env.IOT_SWITCH_OFF_VALUE ?? '0';
	const dryRun = String(args.dryRun || 'false').toLowerCase() === 'true';

	try {
		const { deviceManager, thingManager } = await createSdkClient();

		if (action === 'status') {
			const response = await deviceManager.getDeviceStatus({ deviceName });
			if (!response?.success) {
				printAndExit(false, {
					errorCode: 'STATUS_QUERY_FAILED',
					message: response?.errorMessage || '状态查询失败',
				});
			}

			printAndExit(true, {
				action,
				deviceName,
				message: '状态查询成功',
				data: {
					status: response?.data?.status,
					timestamp: response?.data?.timestamp,
				},
			});
		}

		const targetValue = action === 'on' ? onValue : offValue;
		const pointList = [{ identifier, value: targetValue }];

		if (dryRun) {
			printAndExit(true, {
				action,
				deviceName,
				message: 'dry-run 模式，未实际下发',
				data: { identifier, value: targetValue },
			});
		}

		const controlResponse = await thingManager.setDevicesProperty(deviceName, pointList);
		if (!controlResponse?.success) {
			printAndExit(false, {
				errorCode: 'CONTROL_FAILED',
				message: controlResponse?.errorMessage || '插座控制失败',
			});
		}

		const statusResponse = await deviceManager.getDeviceStatus({ deviceName });
		printAndExit(true, {
			action,
			deviceName,
			message: `已执行 ${action} 操作`,
			data: {
				control: controlResponse?.data ?? null,
				status: statusResponse?.data?.status ?? null,
				timestamp: statusResponse?.data?.timestamp ?? null,
			},
		});
	} catch (error) {
		printAndExit(false, {
			errorCode: 'UNEXPECTED_ERROR',
			message: error?.message || '未知错误',
		});
	}
}

run();
