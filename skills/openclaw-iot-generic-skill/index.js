#!/usr/bin/env node
'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (!token.startsWith('--')) continue;
		const stripped = token.slice(2);
		if (stripped.includes('=')) {
			const [k, ...rest] = stripped.split('=');
			args[k] = rest.join('=');
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

function respond(ok, payload, exitCode = ok ? 0 : 1) {
	process.stdout.write(`${JSON.stringify({ ok, ...payload })}\n`);
	process.exit(exitCode);
}

function parseJsonArg(raw, fallback, errorCode, fieldName) {
	if (raw === undefined || raw === null || raw === '') return fallback;
	try {
		return JSON.parse(raw);
	} catch (_e) {
		throw new Error(`${errorCode}:${fieldName} 必须是合法 JSON`);
	}
}

function usage() {
	return [
		'Generic IoT skill usage:',
		'  --action discover --productKey <productKey> [--fullModel true]',
		'  --action device-status --deviceName <deviceName>',
		'  --action query-prop --deviceName <name> --identifier <id> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--downSampling 1s]',
		'  --action query-props --deviceName <name> --identifiers \'["id1","id2"]\' --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--downSampling 1s]',
		'  --action set-props --deviceName <name> --points \'[{"identifier":"power","value":"1"}]\' [--dryRun true]',
		'  --action call-service --deviceName <name> --servicePoint \'{"identifier":"start"}\' [--pointList \'[]\'] [--dryRun true]',
		'  --action query-events --deviceName <name> --identifier <eventId> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss"',
		'  --action alarms --deviceName <name> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--status <status>]',
		'  Optional: --quiet true|false (default true)',
	].join('\n');
}

function getRequiredValue(args, key, defaultFromEnv) {
	return args[key] || process.env[defaultFromEnv];
}

function assertRequired(v, field) {
	if (!v) throw new Error(`MISSING_ARG:${field} 不能为空`);
}

function isDryRun(args) {
	return String(args.dryRun || 'false').toLowerCase() === 'true';
}

function isTrueFlag(v, defaultValue = false) {
	if (v === undefined) return defaultValue;
	return String(v).toLowerCase() !== 'false';
}

function isQuietMode(args) {
	if (args.quiet !== undefined) {
		return String(args.quiet).toLowerCase() !== 'false';
	}
	if (process.env.IOT_SKILL_QUIET !== undefined) {
		return String(process.env.IOT_SKILL_QUIET).toLowerCase() !== 'false';
	}
	return true;
}

function muteConsoleForSdk() {
	const original = {
		log: console.log,
		info: console.info,
		debug: console.debug,
		error: console.error,
		warn: console.warn,
	};

	console.log = () => {};
	console.info = () => {};
	console.debug = () => {};
	console.warn = () => {};
	console.error = (...args) => {
		process.stderr.write(`${args.map((x) => String(x)).join(' ')}\n`);
	};

	return () => {
		console.log = original.log;
		console.info = original.info;
		console.debug = original.debug;
		console.error = original.error;
		console.warn = original.warn;
	};
}

function buildWritableSet() {
	const raw = process.env.IOT_WRITABLE_IDENTIFIERS || '';
	if (!raw.trim()) return null;
	return new Set(
		raw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	);
}

function validatePointsWritable(points, writableSet) {
	if (!writableSet) return;
	for (const p of points) {
		if (!writableSet.has(p.identifier)) {
			throw new Error(
				`WRITE_GUARD_BLOCKED:identifier "${p.identifier}" 不在 IOT_WRITABLE_IDENTIFIERS 白名单中`
			);
		}
	}
}

async function createManagers() {
	const sdk = require('@iotali/cloud-sdk-nodejs');
	const baseUrl = process.env.IOT_BASE_URL;
	const token = process.env.IOT_TOKEN;
	const appId = process.env.IOT_APP_ID;
	const appSecret = process.env.IOT_APP_SECRET;

	if (!baseUrl) throw new Error('MISSING_ENV:IOT_BASE_URL 未配置');

	let client;
	if (token) {
		client = sdk.createClient({ baseUrl, token });
	} else if (appId && appSecret) {
		client = await sdk.IoTClient.fromCredentials({ baseUrl, appId, appSecret });
	} else {
		throw new Error(
			'MISSING_ENV:请配置 IOT_TOKEN 或 IOT_APP_ID + IOT_APP_SECRET'
		);
	}

	return {
		deviceManager: sdk.createDeviceManager(client),
		thingManager: sdk.createThingManager(client),
		alarmManager: sdk.createAlarmManager(client),
	};
}

async function execute(action, args) {
	const { deviceManager, thingManager, alarmManager } = await createManagers();
	const writableSet = buildWritableSet();

	if (action === 'discover') {
		const productKey = getRequiredValue(args, 'productKey', 'IOT_DEFAULT_PRODUCT_KEY');
		assertRequired(productKey, 'productKey');
		const response = await thingManager.queryThingModel(productKey);
		const model = response?.data || {};
		const properties = Array.isArray(model.properties) ? model.properties : [];
		const events = Array.isArray(model.events) ? model.events : [];
		const actions = Array.isArray(model.actions) ? model.actions : [];
		const fullModel = isTrueFlag(args.fullModel, false);
		return {
			action,
			productKey,
			data: fullModel
				? model
				: {
						counts: {
							properties: properties.length,
							events: events.length,
							actions: actions.length,
						},
						properties: properties.map((x) => ({
							identifier: x.identifier,
							name: x.name,
							access_mode: x.access_mode,
							type: x?.data_type?.type || null,
						})),
						events: events.map((x) => ({
							identifier: x.identifier,
							name: x.name,
						})),
						actions: actions.map((x) => ({
							identifier: x.identifier,
							name: x.name,
						})),
					},
			success: response?.success === true,
			errorMessage: response?.errorMessage,
		};
	}

	if (action === 'device-status') {
		const deviceName = getRequiredValue(args, 'deviceName', 'IOT_DEFAULT_DEVICE_NAME');
		assertRequired(deviceName, 'deviceName');
		const response = await deviceManager.getDeviceStatus({ deviceName });
		return {
			action,
			deviceName,
			data: response?.data ?? null,
			success: response?.success === true,
			errorMessage: response?.errorMessage,
		};
	}

	if (action === 'query-prop') {
		const deviceName = getRequiredValue(args, 'deviceName', 'IOT_DEFAULT_DEVICE_NAME');
		assertRequired(deviceName, 'deviceName');
		assertRequired(args.identifier, 'identifier');
		assertRequired(args.startTime, 'startTime');
		assertRequired(args.endTime, 'endTime');
		const response = await thingManager.queryDevicePropertyData(
			deviceName,
			args.identifier,
			args.startTime,
			args.endTime,
			args.downSampling || '1s'
		);
		return {
			action,
			deviceName,
			identifier: args.identifier,
			data: response?.data ?? null,
			success: response?.success === true,
			errorMessage: response?.errorMessage,
		};
	}

	if (action === 'query-props') {
		const deviceName = getRequiredValue(args, 'deviceName', 'IOT_DEFAULT_DEVICE_NAME');
		assertRequired(deviceName, 'deviceName');
		assertRequired(args.identifiers, 'identifiers');
		assertRequired(args.startTime, 'startTime');
		assertRequired(args.endTime, 'endTime');
		const identifiers = parseJsonArg(
			args.identifiers,
			null,
			'INVALID_JSON',
			'identifiers'
		);
		if (!Array.isArray(identifiers) || identifiers.length === 0) {
			throw new Error('INVALID_ARG:identifiers 必须是非空数组');
		}

		const response = await thingManager.queryDevicePropertiesData(
			deviceName,
			identifiers,
			args.startTime,
			args.endTime,
			args.downSampling || '1s'
		);
		return {
			action,
			deviceName,
			identifiers,
			data: response?.data ?? null,
			success: response?.success === true,
			errorMessage: response?.errorMessage,
		};
	}

	if (action === 'set-props') {
		const deviceName = getRequiredValue(args, 'deviceName', 'IOT_DEFAULT_DEVICE_NAME');
		assertRequired(deviceName, 'deviceName');
		assertRequired(args.points, 'points');
		const points = parseJsonArg(args.points, null, 'INVALID_JSON', 'points');
		if (!Array.isArray(points) || points.length === 0) {
			throw new Error('INVALID_ARG:points 必须是非空数组');
		}
		validatePointsWritable(points, writableSet);

		if (isDryRun(args)) {
			return {
				action,
				deviceName,
				dryRun: true,
				data: { points },
				success: true,
			};
		}

		const response = await thingManager.setDevicesProperty(deviceName, points);
		return {
			action,
			deviceName,
			data: response?.data ?? null,
			success: response?.success === true,
			errorMessage: response?.errorMessage,
		};
	}

	if (action === 'call-service') {
		const deviceName = getRequiredValue(args, 'deviceName', 'IOT_DEFAULT_DEVICE_NAME');
		assertRequired(deviceName, 'deviceName');
		assertRequired(args.servicePoint, 'servicePoint');
		const servicePoint = parseJsonArg(
			args.servicePoint,
			null,
			'INVALID_JSON',
			'servicePoint'
		);
		const pointList = parseJsonArg(args.pointList, [], 'INVALID_JSON', 'pointList');
		if (!servicePoint || typeof servicePoint !== 'object') {
			throw new Error('INVALID_ARG:servicePoint 必须是对象');
		}
		if (!Array.isArray(pointList)) {
			throw new Error('INVALID_ARG:pointList 必须是数组');
		}
		validatePointsWritable(pointList, writableSet);

		if (isDryRun(args)) {
			return {
				action,
				deviceName,
				dryRun: true,
				data: { pointList, servicePoint },
				success: true,
			};
		}

		const response = await thingManager.invokeThingsService(
			deviceName,
			pointList,
			servicePoint
		);
		return {
			action,
			deviceName,
			data: response?.data ?? null,
			success: response?.success === true,
			errorMessage: response?.errorMessage,
		};
	}

	if (action === 'query-events') {
		const deviceName = getRequiredValue(args, 'deviceName', 'IOT_DEFAULT_DEVICE_NAME');
		assertRequired(deviceName, 'deviceName');
		assertRequired(args.identifier, 'identifier');
		assertRequired(args.startTime, 'startTime');
		assertRequired(args.endTime, 'endTime');
		const response = await thingManager.queryDeviceEventData(
			deviceName,
			args.identifier,
			args.startTime,
			args.endTime
		);
		return {
			action,
			deviceName,
			identifier: args.identifier,
			data: response?.data ?? null,
			success: response?.success === true,
			errorMessage: response?.errorMessage,
		};
	}

	if (action === 'alarms') {
		const deviceName = getRequiredValue(args, 'deviceName', 'IOT_DEFAULT_DEVICE_NAME');
		const params = {
			deviceName,
			status: args.status,
			startTime: args.startTime,
			endTime: args.endTime,
		};
		if (!params.startTime || !params.endTime) {
			throw new Error('MISSING_ARG:startTime/endTime 不能为空');
		}

		const response = await alarmManager.queryAlarmList(params);
		return {
			action,
			params,
			data: response?.data ?? null,
			success: response?.success === true,
			errorMessage: response?.errorMessage,
		};
	}

	throw new Error(`INVALID_ACTION:不支持的 action: ${action}`);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help || args.h) {
		respond(true, { message: usage() }, 0);
	}

	const action = String(args.action || '').trim().toLowerCase();
	if (!action) {
		respond(false, {
			errorCode: 'MISSING_ACTION',
			message: '缺少 --action',
			usage: usage(),
		});
	}

	try {
		let restoreConsole = null;
		if (isQuietMode(args)) {
			restoreConsole = muteConsoleForSdk();
		}

		const result = await execute(action, args);
		if (restoreConsole) restoreConsole();

		if (!result.success) {
			respond(false, {
				action,
				errorCode: 'API_FAILED',
				message: result.errorMessage || '接口调用失败',
				data: result.data ?? null,
			});
		}
		respond(true, result, 0);
	} catch (error) {
		// Ensure stdout remains parseable JSON even after failures.
		const rawMessage = error?.message || '未知错误';
		const [maybeCode, ...rest] = rawMessage.split(':');
		const hasCode = rest.length > 0;
		respond(false, {
			action,
			errorCode: hasCode ? maybeCode : 'UNEXPECTED_ERROR',
			message: hasCode ? rest.join(':').trim() : rawMessage,
		});
	}
}

main();
