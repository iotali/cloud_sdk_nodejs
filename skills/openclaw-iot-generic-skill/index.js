#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs/promises');
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

function createRequestId() {
	const rand = Math.random().toString(36).slice(2, 8);
	return `req_${Date.now()}_${rand}`;
}

function classifyErrorType(errorCode, message) {
	const code = String(errorCode || '').toUpperCase();
	const msg = String(message || '').toLowerCase();

	if (
		code.startsWith('MISSING_') ||
		code.startsWith('INVALID_') ||
		code === 'WRITE_GUARD_BLOCKED'
	) {
		return 'validation_error';
	}
	if (
		code.includes('AUTH') ||
		msg.includes('token') ||
		msg.includes('auth') ||
		msg.includes('认证') ||
		msg.includes('401') ||
		msg.includes('403')
	) {
		return 'auth_error';
	}
	if (
		msg.includes('enotfound') ||
		msg.includes('econnrefused') ||
		msg.includes('etimedout') ||
		msg.includes('network') ||
		msg.includes('timeout') ||
		msg.includes('socket hang up')
	) {
		return 'network_error';
	}
	if (code === 'API_FAILED') {
		return 'platform_error';
	}
	return 'unknown_error';
}

function normalizeThrownError(error) {
	const rawMessage = error?.message || '未知错误';
	const [maybeCode, ...rest] = rawMessage.split(':');
	const hasCode = rest.length > 0;
	const errorCode = hasCode ? maybeCode : 'UNEXPECTED_ERROR';
	const message = hasCode ? rest.join(':').trim() : rawMessage;
	const errorType = classifyErrorType(errorCode, message);
	return { errorCode, errorType, message };
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
		'  --action discover --productKey <productKey> [--fullModel true] [--refreshModel true]',
		'  --action resolve-intent --productKey <productKey> --query <text> [--topK 8] [--writableOnly true]',
		'  --action list-writable-identifiers --productKey <productKey> [--onlyAllowed true]',
		'  --action list-devices --productKey <productKey> [--page 1] [--pageSize 20] [--status ONLINE|OFFLINE|UNACTIVE] [--keyword name] [--brief true] [--fetchAll true]',
		'  --action device-status --deviceName <deviceName>',
		'  --action query-history --deviceName <name> [--identifier <id> | --identifiers \'["id1","id2"]\' | --identifiers id1,id2] [--range last_1h|last_6h|last_24h|last_7d] [--startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss"] [--downSampling 1s] [--limit 200] [--aggregate latest|min|max|avg|count|all] [--omitData true]',
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

function toPositiveInt(value, defaultValue) {
	const num = Number.parseInt(value, 10);
	if (Number.isNaN(num) || num <= 0) return defaultValue;
	return num;
}

function getModelCacheConfig(args) {
	return {
		enabled:
			args.useCache !== undefined
				? isTrueFlag(args.useCache, true)
				: isTrueFlag(process.env.IOT_MODEL_CACHE_ENABLED, true),
		ttlMs: Math.max(
			1000,
			toPositiveInt(
				args.modelCacheTtlMs || process.env.IOT_MODEL_CACHE_TTL_MS,
				5 * 60 * 1000
			)
		),
	};
}

function getModelCacheFile(productKey) {
	const safe = String(productKey).replace(/[^a-zA-Z0-9_-]/g, '_');
	return path.join(__dirname, '.cache', `thing-model-${safe}.json`);
}

async function readModelCache(productKey) {
	const file = getModelCacheFile(productKey);
	const content = await fs.readFile(file, 'utf8');
	return JSON.parse(content);
}

async function writeModelCache(productKey, data) {
	const dir = path.join(__dirname, '.cache');
	await fs.mkdir(dir, { recursive: true });
	const file = getModelCacheFile(productKey);
	await fs.writeFile(file, JSON.stringify(data), 'utf8');
}

async function fetchThingModelWithCache(thingManager, productKey, args) {
	const cfg = getModelCacheConfig(args);
	const refresh = isTrueFlag(args.refreshModel, false);

	if (cfg.enabled && !refresh) {
		try {
			const cached = await readModelCache(productKey);
			const ageMs = Date.now() - Number(cached.cachedAt || 0);
			if (ageMs >= 0 && ageMs <= cfg.ttlMs && cached.model) {
				return {
					ok: true,
					source: 'cache',
					model: cached.model,
					cachedAt: cached.cachedAt,
					ageMs,
				};
			}
		} catch (_e) {
			// Cache miss or parse issue; fall through to remote fetch.
		}
	}

	const response = await thingManager.queryThingModel(productKey);
	if (!response?.success) {
		return {
			ok: false,
			response,
		};
	}

	const model = response?.data || {};
	const cachedAt = Date.now();
	if (cfg.enabled) {
		try {
			await writeModelCache(productKey, { productKey, cachedAt, model });
		} catch (_e) {
			// Cache write failure should not block normal flow.
		}
	}

	return {
		ok: true,
		source: 'remote',
		model,
		cachedAt,
		ageMs: 0,
	};
}

function buildWritableSetFromEnv() {
	const raw = process.env.IOT_WRITABLE_IDENTIFIERS || '';
	if (!raw.trim()) return null;
	return new Set(
		raw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	);
}

function extractModelEntries(model) {
	const properties = Array.isArray(model?.properties) ? model.properties : [];
	const events = Array.isArray(model?.events) ? model.events : [];
	const actions = Array.isArray(model?.actions) ? model.actions : [];
	return { properties, events, actions };
}

function isPropertyWritable(prop) {
	return String(prop?.access_mode || '').toUpperCase().includes('WRITE');
}

function scoreCandidate(query, tokens, candidate) {
	const text = {
		identifier: String(candidate.identifier || '').toLowerCase(),
		name: String(candidate.name || '').toLowerCase(),
		desc: String(candidate.desc || '').toLowerCase(),
	};
	const q = query.toLowerCase();
	let score = 0;
	const matched = [];

	if (text.identifier === q) {
		score += 100;
		matched.push('identifier_exact');
	}
	if (text.identifier.includes(q)) {
		score += 40;
		matched.push('identifier_contains');
	}
	if (text.name.includes(q)) {
		score += 35;
		matched.push('name_contains');
	}
	if (text.desc.includes(q)) {
		score += 20;
		matched.push('desc_contains');
	}

	for (const t of tokens) {
		if (t.length < 2) continue;
		if (text.identifier.includes(t)) score += 10;
		if (text.name.includes(t)) score += 8;
		if (text.desc.includes(t)) score += 5;
	}

	return { score, matched };
}

function buildIntentCandidates(model, query, options = {}) {
	const { properties, events, actions } = extractModelEntries(model);
	const topK = Math.max(1, toPositiveInt(options.topK, 8));
	const writableOnly = isTrueFlag(options.writableOnly, false);
	const tokens = String(query)
		.toLowerCase()
		.split(/[\s,，;；|/]+/)
		.filter(Boolean);

	const all = [];
	for (const p of properties) {
		if (writableOnly && !isPropertyWritable(p)) continue;
		const candidate = {
			type: 'property',
			identifier: p.identifier,
			name: p.name,
			desc: p.desc,
			access_mode: p.access_mode,
		};
		const scored = scoreCandidate(String(query), tokens, candidate);
		if (scored.score > 0) all.push({ ...candidate, ...scored });
	}
	for (const e of events) {
		const candidate = {
			type: 'event',
			identifier: e.identifier,
			name: e.name,
			desc: e.desc,
		};
		const scored = scoreCandidate(String(query), tokens, candidate);
		if (scored.score > 0) all.push({ ...candidate, ...scored });
	}
	for (const a of actions) {
		const candidate = {
			type: 'action',
			identifier: a.identifier,
			name: a.name,
			desc: a.desc,
		};
		const scored = scoreCandidate(String(query), tokens, candidate);
		if (scored.score > 0) all.push({ ...candidate, ...scored });
	}

	all.sort((x, y) => y.score - x.score);
	return all.slice(0, topK);
}

function formatDateTime(d) {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	const hh = String(d.getHours()).padStart(2, '0');
	const mi = String(d.getMinutes()).padStart(2, '0');
	const ss = String(d.getSeconds()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function resolveTimeWindow(args) {
	if (args.startTime && args.endTime) {
		return {
			startTime: args.startTime,
			endTime: args.endTime,
			source: 'explicit',
		};
	}

	const range = String(args.range || 'last_1h').toLowerCase();
	const now = new Date();
	const start = new Date(now.getTime());
	if (range === 'last_1h') start.setHours(start.getHours() - 1);
	else if (range === 'last_6h') start.setHours(start.getHours() - 6);
	else if (range === 'last_24h') start.setDate(start.getDate() - 1);
	else if (range === 'last_7d') start.setDate(start.getDate() - 7);
	else {
		throw new Error(
			'INVALID_ARG:range 仅支持 last_1h|last_6h|last_24h|last_7d，或显式 startTime/endTime'
		);
	}

	return {
		startTime: formatDateTime(start),
		endTime: formatDateTime(now),
		source: range,
	};
}

function resolveIdentifiers(args) {
	if (args.identifier) return [String(args.identifier)];
	if (!args.identifiers) {
		throw new Error('MISSING_ARG:identifier 或 identifiers 至少提供一个');
	}

	try {
		const parsed = JSON.parse(args.identifiers);
		if (!Array.isArray(parsed) || parsed.length === 0) {
			throw new Error('INVALID_ARG:identifiers JSON 必须是非空数组');
		}
		return parsed.map((x) => String(x));
	} catch (_e) {
		const split = String(args.identifiers)
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (split.length === 0) {
			throw new Error('INVALID_ARG:identifiers 必须是 JSON 数组或逗号分隔字符串');
		}
		return split;
	}
}

function trimHistoryData(data, limit) {
	if (!limit || limit <= 0) return data;
	if (Array.isArray(data)) {
		// Case A: direct points array
		if (
			data.length > 0 &&
			(data[0]?.time !== undefined || data[0]?.value !== undefined)
		) {
			return data.slice(-limit);
		}
		// Case B: series array [{ dataList: [...] , point: {...} }]
		return data.map((item) => {
			if (item && Array.isArray(item.dataList)) {
				return { ...item, dataList: item.dataList.slice(-limit) };
			}
			return item;
		});
	}
	if (!data || typeof data !== 'object') return data;

	// Case C: single series object { dataList: [...], point: {...} }
	if (Array.isArray(data.dataList)) {
		return { ...data, dataList: data.dataList.slice(-limit) };
	}

	const output = {};
	for (const [k, v] of Object.entries(data)) {
		output[k] = Array.isArray(v) ? v.slice(-limit) : v;
	}
	return output;
}

function buildHistorySummary(data) {
	if (Array.isArray(data)) {
		// Case A: direct points array
		if (
			data.length > 0 &&
			(data[0]?.time !== undefined || data[0]?.value !== undefined)
		) {
			return {
				seriesCount: 1,
				totalPoints: data.length,
			};
		}
		// Case B: series array [{ dataList: [...] }]
		let totalPoints = 0;
		for (const item of data) {
			if (item && Array.isArray(item.dataList)) {
				totalPoints += item.dataList.length;
			}
		}
		return {
			seriesCount: data.length,
			totalPoints,
		};
	}
	if (!data || typeof data !== 'object') {
		return { seriesCount: 0, totalPoints: 0 };
	}

	// Case C: single series object { dataList: [...] }
	if (Array.isArray(data.dataList)) {
		return {
			seriesCount: 1,
			totalPoints: data.dataList.length,
		};
	}

	let total = 0;
	let seriesCount = 0;
	for (const v of Object.values(data)) {
		seriesCount += 1;
		if (Array.isArray(v)) total += v.length;
	}
	return { seriesCount, totalPoints: total };
}

function normalizeHistorySeries(data) {
	const series = [];
	if (Array.isArray(data)) {
		// Direct points array
		if (
			data.length > 0 &&
			(data[0]?.time !== undefined || data[0]?.value !== undefined)
		) {
			series.push({
				identifier: null,
				name: null,
				points: data,
			});
			return series;
		}

		// Series array
		for (const item of data) {
			if (item && Array.isArray(item.dataList)) {
				series.push({
					identifier: item?.point?.identifier || null,
					name: item?.point?.name || null,
					points: item.dataList,
				});
			}
		}
		return series;
	}

	if (!data || typeof data !== 'object') {
		return series;
	}

	// Single series object
	if (Array.isArray(data.dataList)) {
		series.push({
			identifier: data?.point?.identifier || null,
			name: data?.point?.name || null,
			points: data.dataList,
		});
		return series;
	}

	// Object map: { idA: [...], idB: [...] }
	for (const [k, v] of Object.entries(data)) {
		if (Array.isArray(v)) {
			series.push({
				identifier: k,
				name: null,
				points: v,
			});
		}
	}
	return series;
}

function resolveAggregateModes(raw) {
	const input = String(raw || 'latest').trim().toLowerCase();
	if (input === 'none') return [];
	if (input === 'all') return ['latest', 'min', 'max', 'avg', 'count'];
	return input
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

function buildHistoryAggregates(data, modes) {
	if (!Array.isArray(modes) || modes.length === 0) return [];
	const modeSet = new Set(modes);
	const series = normalizeHistorySeries(data);

	return series.map((s) => {
		const numericPoints = s.points
			.map((p) => {
				const value = Number(p?.value);
				return {
					time: p?.time ?? null,
					value,
					valid: Number.isFinite(value),
				};
			})
			.filter((p) => p.valid);

		const result = {
			identifier: s.identifier,
			name: s.name,
		};

		if (modeSet.has('count')) {
			result.count = s.points.length;
			result.numericCount = numericPoints.length;
		}

		if (modeSet.has('latest')) {
			const last = s.points[s.points.length - 1] || null;
			result.latest = last
				? { time: last.time ?? null, value: last.value ?? null }
				: null;
		}

		if (numericPoints.length > 0) {
			if (modeSet.has('min')) {
				let min = numericPoints[0];
				for (const p of numericPoints) {
					if (p.value < min.value) min = p;
				}
				result.min = { time: min.time, value: min.value };
			}
			if (modeSet.has('max')) {
				let max = numericPoints[0];
				for (const p of numericPoints) {
					if (p.value > max.value) max = p;
				}
				result.max = { time: max.time, value: max.value };
			}
			if (modeSet.has('avg')) {
				const sum = numericPoints.reduce((acc, p) => acc + p.value, 0);
				result.avg = sum / numericPoints.length;
			}
		}

		return result;
	});
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
	return buildWritableSetFromEnv();
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
		const fetched = await fetchThingModelWithCache(thingManager, productKey, args);
		if (!fetched.ok) {
			return {
				action,
				productKey,
				data: null,
				success: false,
				errorMessage: fetched?.response?.errorMessage || '物模型查询失败',
			};
		}

		const model = fetched.model || {};
		const properties = Array.isArray(model.properties) ? model.properties : [];
		const events = Array.isArray(model.events) ? model.events : [];
		const actions = Array.isArray(model.actions) ? model.actions : [];
		const fullModel = isTrueFlag(args.fullModel, false);
		return {
			action,
			productKey,
			modelSource: fetched.source,
			modelCachedAt: fetched.cachedAt,
			modelAgeMs: fetched.ageMs,
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
			success: true,
			errorMessage: null,
		};
	}

	if (action === 'resolve-intent') {
		const productKey = getRequiredValue(args, 'productKey', 'IOT_DEFAULT_PRODUCT_KEY');
		assertRequired(productKey, 'productKey');
		const query = String(args.query || args.text || '').trim();
		assertRequired(query, 'query');

		const fetched = await fetchThingModelWithCache(thingManager, productKey, args);
		if (!fetched.ok) {
			return {
				action,
				productKey,
				query,
				candidates: [],
				success: false,
				errorMessage: fetched?.response?.errorMessage || '物模型查询失败',
			};
		}

		const candidates = buildIntentCandidates(fetched.model, query, {
			topK: args.topK,
			writableOnly: args.writableOnly,
		});
		return {
			action,
			productKey,
			query,
			topK: toPositiveInt(args.topK, 8),
			writableOnly: isTrueFlag(args.writableOnly, false),
			modelSource: fetched.source,
			modelCachedAt: fetched.cachedAt,
			modelAgeMs: fetched.ageMs,
			candidates,
			success: true,
			errorMessage: null,
		};
	}

	if (action === 'list-writable-identifiers') {
		const productKey = getRequiredValue(args, 'productKey', 'IOT_DEFAULT_PRODUCT_KEY');
		assertRequired(productKey, 'productKey');
		const onlyAllowed = isTrueFlag(args.onlyAllowed, false);
		const whitelist = buildWritableSetFromEnv();

		const fetched = await fetchThingModelWithCache(thingManager, productKey, args);
		if (!fetched.ok) {
			return {
				action,
				productKey,
				onlyAllowed,
				data: [],
				success: false,
				errorMessage: fetched?.response?.errorMessage || '物模型查询失败',
			};
		}

		const { properties } = extractModelEntries(fetched.model);
		let writable = properties
			.filter((p) => isPropertyWritable(p))
			.map((p) => ({
				identifier: p.identifier,
				name: p.name,
				access_mode: p.access_mode,
			}));

		if (onlyAllowed && whitelist) {
			writable = writable.filter((x) => whitelist.has(x.identifier));
		}

		return {
			action,
			productKey,
			onlyAllowed,
			whitelistEnabled: Boolean(whitelist),
			modelSource: fetched.source,
			modelCachedAt: fetched.cachedAt,
			modelAgeMs: fetched.ageMs,
			count: writable.length,
			data: writable,
			success: true,
			errorMessage: null,
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

	if (action === 'query-history') {
		const deviceName = getRequiredValue(args, 'deviceName', 'IOT_DEFAULT_DEVICE_NAME');
		assertRequired(deviceName, 'deviceName');
		const identifiers = resolveIdentifiers(args);
		const timeWindow = resolveTimeWindow(args);
		const downSampling = args.downSampling || '1s';
		const limit = Math.min(2000, toPositiveInt(args.limit, 200));
		const aggregateModes = resolveAggregateModes(args.aggregate);
		const omitData = isTrueFlag(args.omitData, false);

		let response;
		if (identifiers.length === 1) {
			response = await thingManager.queryDevicePropertyData(
				deviceName,
				identifiers[0],
				timeWindow.startTime,
				timeWindow.endTime,
				downSampling
			);
		} else {
			response = await thingManager.queryDevicePropertiesData(
				deviceName,
				identifiers,
				timeWindow.startTime,
				timeWindow.endTime,
				downSampling
			);
		}

		const rawData = response?.data ?? null;
		const trimmed = trimHistoryData(rawData, limit);
		const aggregates = buildHistoryAggregates(trimmed, aggregateModes);
		return {
			action,
			deviceName,
			identifiers,
			timeWindow,
			downSampling,
			limit,
			aggregateModes,
			summary: buildHistorySummary(trimmed),
			aggregates,
			data: omitData ? null : trimmed,
			success: response?.success === true,
			errorMessage: response?.errorMessage,
		};
	}

	if (action === 'list-devices') {
		const productKey = getRequiredValue(args, 'productKey', 'IOT_DEFAULT_PRODUCT_KEY');
		assertRequired(productKey, 'productKey');
		const page = toPositiveInt(args.page, 1);
		const pageSize = Math.min(100, toPositiveInt(args.pageSize, 20));
		const status = args.status ? String(args.status).toUpperCase() : null;
		const keyword = args.keyword ? String(args.keyword).trim() : '';
		const brief = isTrueFlag(args.brief, true);
		const fetchAll = isTrueFlag(args.fetchAll, true);

		let response;
		let devices;
		let paginationMode;
		let note = null;

		if (fetchAll) {
			response = await deviceManager.queryDevicesByProduct({
				productKey,
				page: 1,
				pageSize: 100,
			});
			devices = Array.isArray(response?.data) ? response.data : [];
			paginationMode = 'client_full_scan';
		} else {
			response = await deviceManager.queryDevicesByProduct({
				productKey,
				page,
				pageSize,
			});
			devices = Array.isArray(response?.data) ? response.data : [];
			paginationMode = 'server_page';
			if (status || keyword) {
				note =
					'fetchAll=false 时过滤仅作用于当前页，若需全量精确过滤请使用 fetchAll=true';
			}
		}

		let filtered = devices;
		if (status) {
			filtered = filtered.filter((d) => String(d?.status || '').toUpperCase() === status);
		}
		if (keyword) {
			filtered = filtered.filter((d) =>
				String(d?.deviceName || '')
					.toLowerCase()
					.includes(keyword.toLowerCase())
			);
		}

		const statusCounts = filtered.reduce(
			(acc, d) => {
				const s = String(d?.status || 'UNKNOWN').toUpperCase();
				acc[s] = (acc[s] || 0) + 1;
				return acc;
			},
			{}
		);

		let pageItems;
		let hasMore;
		let total;
		if (fetchAll) {
			const start = (page - 1) * pageSize;
			const end = start + pageSize;
			pageItems = filtered.slice(start, end);
			hasMore = end < filtered.length;
			total = filtered.length;
		} else {
			if (devices.length > pageSize) {
				// Some platform deployments ignore page/pageSize. Fall back to local paging.
				const start = (page - 1) * pageSize;
				const end = start + pageSize;
				pageItems = filtered.slice(start, end);
				hasMore = end < filtered.length;
				total = filtered.length;
				paginationMode = 'server_page_incompatible_fallback';
				note =
					'平台疑似未按 page/pageSize 分页，已自动回退为本地分页；建议使用 fetchAll=true';
			} else {
				pageItems = filtered;
				hasMore = devices.length >= pageSize;
				total = filtered.length;
			}
		}

		const items = brief
			? pageItems.map((d) => ({
					deviceName: d.deviceName,
					deviceId: d.deviceId,
					status: d.status,
					lastOnlineTime: d.lastOnlineTime,
					timestamp: d.timestamp,
				}))
			: pageItems;

		return {
			action,
			productKey,
			page,
			pageSize,
			total,
			returned: items.length,
			hasMore,
			paginationMode,
			note,
			filters: {
				status,
				keyword: keyword || null,
				brief,
				fetchAll,
			},
			data: {
				statusCounts,
				items,
			},
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
	const requestId = args.requestId || createRequestId();
	const startedAt = Date.now();

	let restoreConsole = null;
	const finish = (ok, payload, exitCode = ok ? 0 : 1) => {
		if (restoreConsole) restoreConsole();
		const elapsedMs = Date.now() - startedAt;
		respond(
			ok,
			{
				requestId,
				elapsedMs,
				...payload,
			},
			exitCode
		);
	};

	if (args.help || args.h) {
		finish(true, { message: usage() }, 0);
	}

	const action = String(args.action || '').trim().toLowerCase();
	if (!action) {
		finish(false, {
			errorCode: 'MISSING_ACTION',
			errorType: 'validation_error',
			message: '缺少 --action',
			usage: usage(),
		});
	}

	try {
		if (isQuietMode(args)) {
			restoreConsole = muteConsoleForSdk();
		}

		const result = await execute(action, args);

		if (!result.success) {
			const errorCode = 'API_FAILED';
			const message = result.errorMessage || '接口调用失败';
			const errorType = classifyErrorType(errorCode, message);
			finish(false, {
				action,
				errorCode,
				errorType,
				message,
				data: result.data ?? null,
			});
		}
		finish(true, result, 0);
	} catch (error) {
		const normalized = normalizeThrownError(error);
		finish(false, {
			action,
			errorCode: normalized.errorCode,
			errorType: normalized.errorType,
			message: normalized.message,
		});
	}
}

main();
