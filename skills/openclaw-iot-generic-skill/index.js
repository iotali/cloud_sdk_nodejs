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
		code === 'WRITE_GUARD_BLOCKED' ||
		code === 'WRITE_DISABLED' ||
		code === 'WRITE_NIGHT_BLOCKED' ||
		code === 'SENSITIVE_ACTION_CONFIRM_REQUIRED'
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
		msg.includes('socket hang up') ||
		code === 'READ_TIMEOUT'
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
		'  --action set-props --deviceName <name> --points \'[{"identifier":"power","value":"1"}]\' [--dryRun true] [--confirm true]',
		'  --action call-service --deviceName <name> --servicePoint \'{"identifier":"start"}\' [--pointList \'[]\'] [--dryRun true] [--confirm true]',
		'  --action query-events --deviceName <name> --identifier <eventId> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss"',
		'  --action alarms --deviceName <name> --startTime "YYYY-MM-DD HH:mm:ss" --endTime "YYYY-MM-DD HH:mm:ss" [--status <status>]',
		'  Optional: --quiet true|false (default true)',
		'  Optional(read): --readTimeoutMs 10000 --readRetryCount 2 --readRetryDelayMs 300',
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

function toInteger(value, defaultValue) {
	const num = Number.parseInt(value, 10);
	if (Number.isNaN(num)) return defaultValue;
	return num;
}

function clampNumber(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const READ_ACTIONS = new Set([
	'discover',
	'resolve-intent',
	'list-writable-identifiers',
	'list-devices',
	'device-status',
	'query-history',
	'query-prop',
	'query-props',
	'query-events',
	'alarms',
]);

const WRITE_ACTIONS = new Set(['set-props', 'call-service']);

function getResilienceConfig(args) {
	return {
		readTimeoutMs: clampNumber(
			toPositiveInt(args.readTimeoutMs || process.env.IOT_READ_TIMEOUT_MS, 10000),
			100,
			120000
		),
		readRetryCount: clampNumber(
			toInteger(args.readRetryCount || process.env.IOT_READ_RETRY_COUNT, 2),
			0,
			5
		),
		readRetryDelayMs: clampNumber(
			Math.max(
				0,
				toInteger(args.readRetryDelayMs || process.env.IOT_READ_RETRY_DELAY_MS, 300)
			),
			0,
			10000
		),
	};
}

async function withTimeout(taskFactory, timeoutMs, timeoutMessage) {
	let timer = null;
	try {
		return await Promise.race([
			taskFactory(),
			new Promise((_, reject) => {
				timer = setTimeout(() => {
					reject(new Error(`READ_TIMEOUT:${timeoutMessage}`));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

async function invokeIoTOperation({
	action,
	args,
	operationName,
	taskFactory,
	runtimeMeta,
}) {
	const cfg = getResilienceConfig(args);
	const canRetry = READ_ACTIONS.has(action);
	const maxAttempts = canRetry ? cfg.readRetryCount + 1 : 1;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			if (canRetry) {
				return await withTimeout(
					taskFactory,
					cfg.readTimeoutMs,
					`${action}.${operationName} ${cfg.readTimeoutMs}ms`
				);
			}
			return await taskFactory();
		} catch (error) {
			const normalized = normalizeThrownError(error);
			const isRetriable = canRetry && normalized.errorType === 'network_error';
			const hasNextAttempt = attempt < maxAttempts;
			if (!isRetriable || !hasNextAttempt) {
				throw error;
			}

			const delayMs = cfg.readRetryDelayMs * 2 ** (attempt - 1);
			if (runtimeMeta) {
				runtimeMeta.retries.push({
					action,
					operationName,
					attempt,
					errorCode: normalized.errorCode,
					errorType: normalized.errorType,
					delayMs,
				});
			}
			if (delayMs > 0) await sleep(delayMs);
		}
	}

	throw new Error('UNEXPECTED_ERROR:invokeIoTOperation 执行异常');
}

function parseActionList(raw) {
	return String(raw || '')
		.split(',')
		.map((x) => x.trim().toLowerCase())
		.filter(Boolean);
}

function parseHourMinute(raw, fallback) {
	const value = String(raw || fallback);
	const matched = value.match(/^(\d{1,2}):(\d{1,2})$/);
	if (!matched) return fallback;
	const hh = Number(matched[1]);
	const mm = Number(matched[2]);
	if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return fallback;
	return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function toMinuteOfDay(hhmm) {
	const [hh, mm] = String(hhmm).split(':').map((x) => Number(x));
	return hh * 60 + mm;
}

function getMinuteOfDayNow(offsetMinutes) {
	if (offsetMinutes === null || offsetMinutes === undefined) {
		const now = new Date();
		return now.getHours() * 60 + now.getMinutes();
	}
	const utcMs = Date.now() + new Date().getTimezoneOffset() * 60000;
	const shifted = new Date(utcMs + offsetMinutes * 60000);
	return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function isInTimeRange(current, start, end) {
	if (start === end) return true;
	if (start < end) return current >= start && current < end;
	return current >= start || current < end;
}

function getWriteRiskPolicy(args) {
	const sensitiveActions = new Set(
		parseActionList(args.sensitiveActions || process.env.IOT_SENSITIVE_ACTIONS)
	);
	const timezoneOffsetMinutes = (() => {
		const fromArg = args.writeTzOffsetMinutes;
		const fromEnv = process.env.IOT_WRITE_TZ_OFFSET_MINUTES;
		if (fromArg === undefined && fromEnv === undefined) return null;
		return clampNumber(
			toInteger(fromArg !== undefined ? fromArg : fromEnv, 0),
			-720,
			840
		);
	})();

	return {
		allowWrite: isTrueFlag(
			args.allowWrite !== undefined ? args.allowWrite : process.env.IOT_ALLOW_WRITE,
			true
		),
		nightWriteBlockEnabled: isTrueFlag(
			args.blockNightWrite !== undefined
				? args.blockNightWrite
				: process.env.IOT_WRITE_NIGHT_BLOCK_ENABLED,
			false
		),
		nightStart: parseHourMinute(
			args.writeNightStart || process.env.IOT_WRITE_NIGHT_START,
			'23:00'
		),
		nightEnd: parseHourMinute(
			args.writeNightEnd || process.env.IOT_WRITE_NIGHT_END,
			'06:00'
		),
		timezoneOffsetMinutes,
		sensitiveActions,
	};
}

function enforceWriteRiskPolicy(action, args) {
	if (!WRITE_ACTIONS.has(action)) return;

	const policy = getWriteRiskPolicy(args);
	if (!policy.allowWrite) {
		throw new Error('WRITE_DISABLED:环境策略禁止写操作');
	}

	if (policy.nightWriteBlockEnabled) {
		const current = getMinuteOfDayNow(policy.timezoneOffsetMinutes);
		const start = toMinuteOfDay(policy.nightStart);
		const end = toMinuteOfDay(policy.nightEnd);
		if (isInTimeRange(current, start, end)) {
			throw new Error(
				`WRITE_NIGHT_BLOCKED:当前处于夜间限制时段 ${policy.nightStart}-${policy.nightEnd}`
			);
		}
	}

	if (policy.sensitiveActions.has(action) && !isTrueFlag(args.confirm, false)) {
		throw new Error('SENSITIVE_ACTION_CONFIRM_REQUIRED:敏感操作需传 --confirm true');
	}
}

function estimateIdentifierCount(raw) {
	if (!raw) return 0;
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed.length;
		return 1;
	} catch (_e) {
		return String(raw)
			.split(',')
			.map((x) => x.trim())
			.filter(Boolean).length;
	}
}

function estimatePointsCount(raw, fallback = 0) {
	if (!raw) return fallback;
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.length : fallback;
	} catch (_e) {
		return fallback;
	}
}

function estimateServiceIdentifier(raw) {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		return parsed?.identifier ? String(parsed.identifier) : null;
	} catch (_e) {
		return null;
	}
}

function buildRequestSummary(action, args) {
	const summary = {};
	if (!action) return summary;

	if (args.productKey) summary.productKey = String(args.productKey);
	if (args.deviceName) summary.deviceName = String(args.deviceName);
	if (args.identifier) summary.identifier = String(args.identifier);
	if (args.identifiers) {
		summary.identifiersCount = estimateIdentifierCount(args.identifiers);
	}
	if (args.range) summary.range = String(args.range);
	if (args.startTime && args.endTime) summary.explicitWindow = true;
	if (args.page !== undefined) summary.page = toPositiveInt(args.page, 1);
	if (args.pageSize !== undefined) summary.pageSize = toPositiveInt(args.pageSize, 20);
	if (args.fetchAll !== undefined) summary.fetchAll = isTrueFlag(args.fetchAll, true);
	if (args.status) summary.status = String(args.status);
	if (args.keyword) summary.keyword = String(args.keyword).slice(0, 50);
	if (args.dryRun !== undefined) summary.dryRun = isTrueFlag(args.dryRun, false);
	if (args.points) summary.pointsCount = estimatePointsCount(args.points, 0);
	if (args.pointList) summary.pointListCount = estimatePointsCount(args.pointList, 0);
	if (args.servicePoint) {
		summary.serviceIdentifier = estimateServiceIdentifier(args.servicePoint);
	}
	const resilience = getResilienceConfig(args);
	summary.readTimeoutMs = resilience.readTimeoutMs;
	summary.readRetryCount = resilience.readRetryCount;
	return summary;
}

function writeStructuredLog(entry) {
	if (!isTrueFlag(process.env.IOT_STRUCTURED_LOG_ENABLED, true)) return;
	process.stderr.write(
		`${JSON.stringify({
			type: 'skill_log',
			ts: new Date().toISOString(),
			...entry,
		})}\n`
	);
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

async function fetchThingModelWithCache(thingManager, productKey, args, queryThingModelFn) {
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

	const response = queryThingModelFn
		? await queryThingModelFn(productKey)
		: await thingManager.queryThingModel(productKey);
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

async function execute(action, args, runtimeMeta) {
	enforceWriteRiskPolicy(action, args);
	const { deviceManager, thingManager, alarmManager } = await createManagers();
	const writableSet = buildWritableSet();
	const invoke = (operationName, taskFactory) =>
		invokeIoTOperation({
			action,
			args,
			operationName,
			taskFactory,
			runtimeMeta,
		});

	if (action === 'discover') {
		const productKey = getRequiredValue(args, 'productKey', 'IOT_DEFAULT_PRODUCT_KEY');
		assertRequired(productKey, 'productKey');
		const fetched = await fetchThingModelWithCache(
			thingManager,
			productKey,
			args,
			(pk) => invoke('queryThingModel', () => thingManager.queryThingModel(pk))
		);
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

		const fetched = await fetchThingModelWithCache(
			thingManager,
			productKey,
			args,
			(pk) => invoke('queryThingModel', () => thingManager.queryThingModel(pk))
		);
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

		const fetched = await fetchThingModelWithCache(
			thingManager,
			productKey,
			args,
			(pk) => invoke('queryThingModel', () => thingManager.queryThingModel(pk))
		);
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
		const response = await invoke('getDeviceStatus', () =>
			deviceManager.getDeviceStatus({ deviceName })
		);
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
			response = await invoke('queryDevicePropertyData', () =>
				thingManager.queryDevicePropertyData(
					deviceName,
					identifiers[0],
					timeWindow.startTime,
					timeWindow.endTime,
					downSampling
				)
			);
		} else {
			response = await invoke('queryDevicePropertiesData', () =>
				thingManager.queryDevicePropertiesData(
					deviceName,
					identifiers,
					timeWindow.startTime,
					timeWindow.endTime,
					downSampling
				)
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
			response = await invoke('queryDevicesByProduct', () =>
				deviceManager.queryDevicesByProduct({
					productKey,
					page: 1,
					pageSize: 100,
				})
			);
			devices = Array.isArray(response?.data) ? response.data : [];
			paginationMode = 'client_full_scan';
		} else {
			response = await invoke('queryDevicesByProduct', () =>
				deviceManager.queryDevicesByProduct({
					productKey,
					page,
					pageSize,
				})
			);
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
		const response = await invoke('queryDevicePropertyData', () =>
			thingManager.queryDevicePropertyData(
				deviceName,
				args.identifier,
				args.startTime,
				args.endTime,
				args.downSampling || '1s'
			)
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

		const response = await invoke('queryDevicePropertiesData', () =>
			thingManager.queryDevicePropertiesData(
				deviceName,
				identifiers,
				args.startTime,
				args.endTime,
				args.downSampling || '1s'
			)
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

		const response = await invoke('setDevicesProperty', () =>
			thingManager.setDevicesProperty(deviceName, points)
		);
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

		const response = await invoke('invokeThingsService', () =>
			thingManager.invokeThingsService(deviceName, pointList, servicePoint)
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
		const response = await invoke('queryDeviceEventData', () =>
			thingManager.queryDeviceEventData(
				deviceName,
				args.identifier,
				args.startTime,
				args.endTime
			)
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

		const response = await invoke('queryAlarmList', () => alarmManager.queryAlarmList(params));
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
	const runtimeMeta = {
		retries: [],
	};
	let currentAction = null;
	let requestSummary = {};

	let restoreConsole = null;
	const finish = (ok, payload, exitCode = ok ? 0 : 1) => {
		if (restoreConsole) restoreConsole();
		const elapsedMs = Date.now() - startedAt;
		writeStructuredLog({
			requestId,
			action: currentAction || payload.action || null,
			ok,
			resultCode: ok ? 'OK' : payload.errorCode || 'FAILED',
			elapsedMs,
			requestSummary,
			retryCount: runtimeMeta.retries.length,
			retries: runtimeMeta.retries,
		});
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
		currentAction = 'help';
		finish(true, { message: usage() }, 0);
	}

	const action = String(args.action || '').trim().toLowerCase();
	currentAction = action || null;
	requestSummary = buildRequestSummary(currentAction, args);
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

		const result = await execute(action, args, runtimeMeta);

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
