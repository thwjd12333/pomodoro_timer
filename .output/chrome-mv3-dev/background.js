var background = (function() {
	//#region node_modules/wxt/dist/utils/define-background.mjs
	function defineBackground(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/background/badgeManager.ts
	var BADGE_COLOR = {
		pomodoro: "#6470d0",
		schedule: "#1D9E75"
	};
	var updateBadge = async (remainingSeconds, type) => {
		await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR[type] });
		await chrome.action.setBadgeTextColor({ color: "#ffffff" });
		await chrome.action.setBadgeText({ text: `${Math.ceil(remainingSeconds / 60)}m` });
	};
	var clearBadge = () => chrome.action.setBadgeText({ text: "" });
	//#endregion
	//#region src/utils/notifyEvents.ts
	var EVENTS = {
		sessionComplete: {
			message: "집중 세션이 끝났어요. 일정을 완료하셨나요?",
			sound: "bell"
		},
		breakEnd: {
			message: "휴식이 끝났어요. 다음 세션을 시작할까요?",
			sound: "soft"
		},
		scheduleStart: {
			message: "일정을 시작해요.",
			sound: "chime"
		},
		scheduleEnd: {
			message: "일정 시간이 끝났어요.",
			sound: "bell"
		}
	};
	//#endregion
	//#region src/background/phaseNotifier.ts
	var OFFSCREEN_URL = "offscreen.html";
	var resolvePhaseEndEvent = (noteType, phase) => noteType === "schedule" ? "scheduleEnd" : phase === "work" ? "sessionComplete" : "breakEnd";
	var creating = null;
	var ensureOffscreenDocument = async () => {
		if (await chrome.offscreen.hasDocument()) return;
		if (!creating) creating = chrome.offscreen.createDocument({
			url: OFFSCREEN_URL,
			reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
			justification: "타이머 종료 알림음 재생"
		}).finally(() => {
			creating = null;
		});
		await creating;
	};
	var channelsFor = (note) => note.type === "pomodoro" ? {
		os: note.notifyOnComplete,
		sound: note.soundOnComplete
	} : {
		os: note.notifyOnEnd,
		sound: note.soundOnEnd
	};
	var notifyPhaseEnd = async (note, phase) => {
		const event = resolvePhaseEndEvent(note.type, phase);
		const channels = channelsFor(note);
		if (channels.os) await chrome.notifications.create({
			type: "basic",
			iconUrl: chrome.runtime.getURL("/icons/icon128.png"),
			title: note.title,
			message: EVENTS[event].message
		});
		if (channels.sound) {
			await ensureOffscreenDocument();
			chrome.runtime.sendMessage({
				type: "play-sound",
				sound: EVENTS[event].sound
			}).catch(() => void 0);
		}
	};
	//#endregion
	//#region entrypoints/background.ts
	var STORAGE_KEY = "focuscal";
	var BADGE_ALARM = "badge-refresh";
	var TIMER_ALARM = "timer-end";
	var ALARM_CONTEXT_KEY = "timerAlarmContext";
	var readAppState = async () => {
		const raw = (await chrome.storage.sync.get(STORAGE_KEY))[STORAGE_KEY];
		if (typeof raw !== "string") return null;
		try {
			return JSON.parse(raw).state;
		} catch {
			return null;
		}
	};
	var refreshBadge = async () => {
		const state = await readAppState();
		const timer = state?.timerState;
		const stop = async () => {
			await chrome.alarms.clear(BADGE_ALARM);
			await clearBadge();
		};
		if (!state || !timer?.isRunning || timer.endsAt === null) return stop();
		const note = state.notes.find((n) => n.id === timer.noteId);
		const remaining = Math.round((timer.endsAt - Date.now()) / 1e3);
		if (!note || remaining <= 0) return stop();
		await updateBadge(remaining, note.type);
		if (!await chrome.alarms.get(BADGE_ALARM)) await chrome.alarms.create(BADGE_ALARM, { periodInMinutes: .5 });
	};
	var readAlarmContext = async () => {
		return (await chrome.storage.session.get(ALARM_CONTEXT_KEY))[ALARM_CONTEXT_KEY];
	};
	var syncAlarm = async () => {
		const timer = (await readAppState())?.timerState;
		if (timer?.isRunning && timer.endsAt !== null && timer.noteId !== null && timer.endsAt > Date.now()) {
			const context = {
				noteId: timer.noteId,
				phase: timer.phase,
				endsAt: timer.endsAt
			};
			await chrome.storage.session.set({ [ALARM_CONTEXT_KEY]: context });
			await chrome.alarms.create(TIMER_ALARM, { when: timer.endsAt });
			return;
		}
		const context = await readAlarmContext();
		if (context && Date.now() >= context.endsAt - 2e3) return;
		await chrome.alarms.clear(TIMER_ALARM);
		await chrome.storage.session.remove(ALARM_CONTEXT_KEY);
	};
	var handleTimerEnd = async () => {
		const context = await readAlarmContext();
		await chrome.storage.session.remove(ALARM_CONTEXT_KEY);
		if (!context || Date.now() < context.endsAt - 2e3) return;
		const note = (await readAppState())?.notes.find((n) => n.id === context.noteId);
		if (!note) return;
		await notifyPhaseEnd(note, context.phase);
	};
	var background_default = defineBackground(() => {
		chrome.storage.onChanged.addListener((changes, areaName) => {
			if (areaName === "sync" && changes[STORAGE_KEY]) {
				refreshBadge();
				syncAlarm();
			}
		});
		chrome.alarms.onAlarm.addListener((alarm) => {
			if (alarm.name === BADGE_ALARM) refreshBadge();
			if (alarm.name === TIMER_ALARM) handleTimerEnd();
		});
		chrome.notifications.onClicked.addListener((notificationId) => {
			chrome.notifications.clear(notificationId);
			chrome.action.openPopup().catch(() => chrome.windows.create({
				url: chrome.runtime.getURL("/popup.html?mode=window"),
				type: "popup",
				width: 380,
				height: 620,
				focused: true
			}));
		});
		refreshBadge();
		syncAlarm();
	});
	//#endregion
	//#region node_modules/wxt/dist/browser.mjs
	/**
	* Contains the `browser` export which you should use to access the extension
	* APIs in your project:
	*
	* ```ts
	* import { browser } from 'wxt/browser';
	*
	* browser.runtime.onInstalled.addListener(() => {
	*   // ...
	* });
	* ```
	*
	* @module wxt/browser
	*/
	var browser = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
	//#endregion
	//#region node_modules/@webext-core/match-patterns/lib/index.js
	var _MatchPattern = class {
		constructor(matchPattern) {
			if (matchPattern === "<all_urls>") {
				this.isAllUrls = true;
				this.protocolMatches = [..._MatchPattern.PROTOCOLS];
				this.hostnameMatch = "*";
				this.pathnameMatch = "*";
			} else {
				const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
				if (groups == null) throw new InvalidMatchPattern(matchPattern, "Incorrect format");
				const [_, protocol, hostname, pathname] = groups;
				validateProtocol(matchPattern, protocol);
				validateHostname(matchPattern, hostname);
				this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
				this.hostnameMatch = hostname;
				this.pathnameMatch = pathname;
			}
		}
		includes(url) {
			if (this.isAllUrls) return true;
			const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
			return !!this.protocolMatches.find((protocol) => {
				if (protocol === "http") return this.isHttpMatch(u);
				if (protocol === "https") return this.isHttpsMatch(u);
				if (protocol === "file") return this.isFileMatch(u);
				if (protocol === "ftp") return this.isFtpMatch(u);
				if (protocol === "urn") return this.isUrnMatch(u);
			});
		}
		isHttpMatch(url) {
			return url.protocol === "http:" && this.isHostPathMatch(url);
		}
		isHttpsMatch(url) {
			return url.protocol === "https:" && this.isHostPathMatch(url);
		}
		isHostPathMatch(url) {
			if (!this.hostnameMatch || !this.pathnameMatch) return false;
			const hostnameMatchRegexs = [this.convertPatternToRegex(this.hostnameMatch), this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))];
			const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
			return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
		}
		isFileMatch(url) {
			throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
		}
		isFtpMatch(url) {
			throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
		}
		isUrnMatch(url) {
			throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
		}
		convertPatternToRegex(pattern) {
			const starsReplaced = this.escapeForRegex(pattern).replace(/\\\*/g, ".*");
			return RegExp(`^${starsReplaced}$`);
		}
		escapeForRegex(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
	};
	var MatchPattern = _MatchPattern;
	MatchPattern.PROTOCOLS = [
		"http",
		"https",
		"file",
		"ftp",
		"urn"
	];
	var InvalidMatchPattern = class extends Error {
		constructor(matchPattern, reason) {
			super(`Invalid match pattern "${matchPattern}": ${reason}`);
		}
	};
	function validateProtocol(matchPattern, protocol) {
		if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*") throw new InvalidMatchPattern(matchPattern, `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`);
	}
	function validateHostname(matchPattern, hostname) {
		if (hostname.includes(":")) throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
		if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*.")) throw new InvalidMatchPattern(matchPattern, `If using a wildcard (*), it must go at the start of the hostname`);
	}
	//#endregion
	//#region \0virtual:wxt-background-entrypoint?/Users/psj/Documents/code/2026/pomodoro_timer/entrypoints/background.ts
	function print(method, ...args) {
		if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
		else method("[wxt]", ...args);
	}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => print(console.debug, ...args),
		log: (...args) => print(console.log, ...args),
		warn: (...args) => print(console.warn, ...args),
		error: (...args) => print(console.error, ...args)
	};
	var ws;
	/** Connect to the websocket and listen for messages. */
	function getDevServerWebSocket() {
		if (ws == null) {
			const serverUrl = "ws://localhost:3000";
			logger.debug("Connecting to dev server @", serverUrl);
			ws = new WebSocket(serverUrl, "vite-hmr");
			ws.addWxtEventListener = ws.addEventListener.bind(ws);
			ws.sendCustom = (event, payload) => ws?.send(JSON.stringify({
				type: "custom",
				event,
				payload
			}));
			ws.addEventListener("open", () => {
				logger.debug("Connected to dev server");
			});
			ws.addEventListener("close", () => {
				logger.debug("Disconnected from dev server");
			});
			ws.addEventListener("error", (event) => {
				logger.error("Failed to connect to dev server", event);
			});
			ws.addEventListener("message", (e) => {
				try {
					const message = JSON.parse(e.data);
					if (message.type === "custom") ws?.dispatchEvent(new CustomEvent(message.event, { detail: message.data }));
				} catch (err) {
					logger.error("Failed to handle message", err);
				}
			});
		}
		return ws;
	}
	/** https://developer.chrome.com/blog/longer-esw-lifetimes/ */
	function keepServiceWorkerAlive() {
		setInterval(async () => {
			await browser.runtime.getPlatformInfo();
		}, 5e3);
	}
	function reloadContentScript(payload) {
		if (browser.runtime.getManifest().manifest_version == 2) reloadContentScriptMv2(payload);
		else reloadContentScriptMv3(payload);
	}
	async function reloadContentScriptMv3({ registration, contentScript }) {
		if (registration === "runtime") await reloadRuntimeContentScriptMv3(contentScript);
		else await reloadManifestContentScriptMv3(contentScript);
	}
	async function reloadManifestContentScriptMv3(contentScript) {
		const id = `wxt:${contentScript.js[0]}`;
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const existing = registered.find((cs) => cs.id === id);
		if (existing) {
			logger.debug("Updating content script", existing);
			await browser.scripting.updateContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		} else {
			logger.debug("Registering new content script...");
			await browser.scripting.registerContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		}
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadRuntimeContentScriptMv3(contentScript) {
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const matches = registered.filter((cs) => {
			const hasJs = contentScript.js?.find((js) => cs.js?.includes(js));
			const hasCss = contentScript.css?.find((css) => cs.css?.includes(css));
			return hasJs || hasCss;
		});
		if (matches.length === 0) {
			logger.log("Content script is not registered yet, nothing to reload", contentScript);
			return;
		}
		await browser.scripting.updateContentScripts(matches);
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadTabsForContentScript(contentScript) {
		const allTabs = await browser.tabs.query({});
		const matchPatterns = contentScript.matches.map((match) => new MatchPattern(match));
		const matchingTabs = allTabs.filter((tab) => {
			const url = tab.url;
			if (!url) return false;
			return !!matchPatterns.find((pattern) => pattern.includes(url));
		});
		await Promise.all(matchingTabs.map(async (tab) => {
			try {
				await browser.tabs.reload(tab.id);
			} catch (err) {
				logger.warn("Failed to reload tab:", err);
			}
		}));
	}
	async function reloadContentScriptMv2(_payload) {
		throw Error("TODO: reloadContentScriptMv2");
	}
	try {
		const ws = getDevServerWebSocket();
		ws.addWxtEventListener("wxt:reload-extension", () => {
			browser.runtime.reload();
		});
		ws.addWxtEventListener("wxt:reload-content-script", (event) => {
			reloadContentScript(event.detail);
		});
		ws.addEventListener("open", () => ws.sendCustom("wxt:background-initialized"));
		keepServiceWorkerAlive();
	} catch (err) {
		logger.error("Failed to setup web socket connection with dev server", err);
	}
	browser.commands.onCommand.addListener((command) => {
		if (command === "wxt:reload-extension") browser.runtime.reload();
	});
	var result;
	try {
		result = background_default.main();
		if (result instanceof Promise) console.warn("The background's main() function return a promise, but it must be synchronous");
	} catch (err) {
		logger.error("The background crashed on startup!");
		throw err;
	}
	//#endregion
	return result;
})();

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsIm5hbWVzIjpbImJyb3dzZXIiXSwic291cmNlcyI6WyIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQubWpzIiwiLi4vLi4vc3JjL2JhY2tncm91bmQvYmFkZ2VNYW5hZ2VyLnRzIiwiLi4vLi4vc3JjL3V0aWxzL25vdGlmeUV2ZW50cy50cyIsIi4uLy4uL3NyYy9iYWNrZ3JvdW5kL3BoYXNlTm90aWZpZXIudHMiLCIuLi8uLi9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQudHNcbmZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG5cdGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuXHRyZXR1cm4gYXJnO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVCYWNrZ3JvdW5kIH07XG4iLCJpbXBvcnQgdHlwZSB7IE5vdGVUeXBlIH0gZnJvbSAnLi4vdHlwZXMvbm90ZSdcblxuLy8g67GD7KeAIOuwsOqyveyDiSDigJQg672A66qo64+E66GcOiDslbEg7JWh7IS87Yq4IOuztOudvCwg7J287KCVIO2DgOydtOuouDog7LSI66GdXG5jb25zdCBCQURHRV9DT0xPUjogUmVjb3JkPE5vdGVUeXBlLCBzdHJpbmc+ID0ge1xuICBwb21vZG9ybzogJyM2NDcwZDAnLFxuICBzY2hlZHVsZTogJyMxRDlFNzUnLFxufVxuXG4vLyDrgqjsnYAg7Iuc6rCE7J2EICdObScg7ZiV7YOc66GcIOydteyKpO2FkOyFmCDslYTsnbTsvZgg67GD7KeA7JeQIO2RnOyLnFxuZXhwb3J0IGNvbnN0IHVwZGF0ZUJhZGdlID0gYXN5bmMgKFxuICByZW1haW5pbmdTZWNvbmRzOiBudW1iZXIsXG4gIHR5cGU6IE5vdGVUeXBlLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGF3YWl0IGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VCYWNrZ3JvdW5kQ29sb3IoeyBjb2xvcjogQkFER0VfQ09MT1JbdHlwZV0gfSlcbiAgYXdhaXQgY2hyb21lLmFjdGlvbi5zZXRCYWRnZVRleHRDb2xvcih7IGNvbG9yOiAnI2ZmZmZmZicgfSlcbiAgYXdhaXQgY2hyb21lLmFjdGlvbi5zZXRCYWRnZVRleHQoe1xuICAgIHRleHQ6IGAke01hdGguY2VpbChyZW1haW5pbmdTZWNvbmRzIC8gNjApfW1gLFxuICB9KVxufVxuXG5leHBvcnQgY29uc3QgY2xlYXJCYWRnZSA9ICgpOiBQcm9taXNlPHZvaWQ+ID0+XG4gIGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHsgdGV4dDogJycgfSlcbiIsImltcG9ydCB0eXBlIHsgU291bmRUeXBlIH0gZnJvbSAnLi9zb3VuZFV0aWxzJ1xuXG5leHBvcnQgdHlwZSBOb3RpZnlFdmVudFR5cGUgPVxuICB8ICdzZXNzaW9uQ29tcGxldGUnXG4gIHwgJ2JyZWFrRW5kJ1xuICB8ICdzY2hlZHVsZVN0YXJ0J1xuICB8ICdzY2hlZHVsZUVuZCdcblxuLy8g7JWM66a8IO2Gte2VqSDthYzsnbTruJQg4oCUIOydtOuypO2KuOuzhCDrqZTsi5zsp4DCt+yCrOyatOuTnC4g7Yyd7JeFKG5vdGlmaWVyKeqzvCDrsLHqt7jrnbzsmrTrk5wocGhhc2VOb3RpZmllcinqsIAg6rO17JygXG5leHBvcnQgY29uc3QgRVZFTlRTOiBSZWNvcmQ8XG4gIE5vdGlmeUV2ZW50VHlwZSxcbiAgeyBtZXNzYWdlOiBzdHJpbmc7IHNvdW5kOiBTb3VuZFR5cGUgfVxuPiA9IHtcbiAgc2Vzc2lvbkNvbXBsZXRlOiB7XG4gICAgbWVzc2FnZTogJ+ynkeykkSDshLjshZjsnbQg64Gd64Ks7Ja07JqULiDsnbzsoJXsnYQg7JmE66OM7ZWY7IWo64KY7JqUPycsXG4gICAgc291bmQ6ICdiZWxsJyxcbiAgfSxcbiAgYnJlYWtFbmQ6IHtcbiAgICBtZXNzYWdlOiAn7Zy07Iud7J20IOuBneuCrOyWtOyalC4g64uk7J2MIOyEuOyFmOydhCDsi5zsnpHtlaDquYzsmpQ/JyxcbiAgICBzb3VuZDogJ3NvZnQnLFxuICB9LFxuICBzY2hlZHVsZVN0YXJ0OiB7IG1lc3NhZ2U6ICfsnbzsoJXsnYQg7Iuc7J6R7ZW07JqULicsIHNvdW5kOiAnY2hpbWUnIH0sXG4gIHNjaGVkdWxlRW5kOiB7IG1lc3NhZ2U6ICfsnbzsoJUg7Iuc6rCE7J20IOuBneuCrOyWtOyalC4nLCBzb3VuZDogJ2JlbGwnIH0sXG59XG4iLCJpbXBvcnQgdHlwZSB7IE5vdGUgfSBmcm9tICcuLi90eXBlcy9ub3RlJ1xuaW1wb3J0IHR5cGUgeyBUaW1lclBoYXNlIH0gZnJvbSAnLi4vdHlwZXMvdGltZXInXG5pbXBvcnQgeyBFVkVOVFMsIHR5cGUgTm90aWZ5RXZlbnRUeXBlIH0gZnJvbSAnLi4vdXRpbHMvbm90aWZ5RXZlbnRzJ1xuXG5jb25zdCBPRkZTQ1JFRU5fVVJMID0gJ29mZnNjcmVlbi5odG1sJ1xuXG4vLyAo64W47Yq4IO2DgOyehSwg64uo6rOEKSDihpIg7KKF66OMIOydtOuypO2KuC4g7J287KCVIOuFuO2KuOuKlCDri6jqs4Qg6rWs67aEIOyXhuydtCDsooXro4zroZwg7LKY66asXG5leHBvcnQgY29uc3QgcmVzb2x2ZVBoYXNlRW5kRXZlbnQgPSAoXG4gIG5vdGVUeXBlOiBOb3RlWyd0eXBlJ10sXG4gIHBoYXNlOiBUaW1lclBoYXNlLFxuKTogTm90aWZ5RXZlbnRUeXBlID0+XG4gIG5vdGVUeXBlID09PSAnc2NoZWR1bGUnXG4gICAgPyAnc2NoZWR1bGVFbmQnXG4gICAgOiBwaGFzZSA9PT0gJ3dvcmsnXG4gICAgICA/ICdzZXNzaW9uQ29tcGxldGUnXG4gICAgICA6ICdicmVha0VuZCdcblxuLy8g7Jik65SU7JikIOyerOyDneyaqSBvZmZzY3JlZW4g66y47ISc66W8IO2VmOuCmOunjCDsnKDsp4Ag4oCUIOuPmeyLnCDsg53shLEg7JqU7LKt7J2AIO2VmOuCmOydmCBQcm9taXNl66GcIOyngeugrO2ZlFxubGV0IGNyZWF0aW5nOiBQcm9taXNlPHZvaWQ+IHwgbnVsbCA9IG51bGxcbmNvbnN0IGVuc3VyZU9mZnNjcmVlbkRvY3VtZW50ID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICBpZiAoYXdhaXQgY2hyb21lLm9mZnNjcmVlbi5oYXNEb2N1bWVudCgpKSByZXR1cm5cbiAgaWYgKCFjcmVhdGluZylcbiAgICBjcmVhdGluZyA9IGNocm9tZS5vZmZzY3JlZW5cbiAgICAgIC5jcmVhdGVEb2N1bWVudCh7XG4gICAgICAgIHVybDogT0ZGU0NSRUVOX1VSTCxcbiAgICAgICAgcmVhc29uczogW2Nocm9tZS5vZmZzY3JlZW4uUmVhc29uLkFVRElPX1BMQVlCQUNLXSxcbiAgICAgICAganVzdGlmaWNhdGlvbjogJ+2DgOydtOuouCDsooXro4wg7JWM66a87J2MIOyerOyDnScsXG4gICAgICB9KVxuICAgICAgLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICBjcmVhdGluZyA9IG51bGxcbiAgICAgIH0pXG4gIGF3YWl0IGNyZWF0aW5nXG59XG5cbi8vIOyiheujjCDsnbTrsqTtirjrs4Qg64W47Yq4IOyxhOuEkCDshKTsoJUg4oCUIOu9gOuqqOuPhOuhnOuKlCBjb21wbGV0ZSwg7J287KCV7J2AIGVuZCDtlYTrk5zrpbwg7IKs7JqpXG5jb25zdCBjaGFubmVsc0ZvciA9IChub3RlOiBOb3RlKTogeyBvczogYm9vbGVhbjsgc291bmQ6IGJvb2xlYW4gfSA9PlxuICBub3RlLnR5cGUgPT09ICdwb21vZG9ybydcbiAgICA/IHsgb3M6IG5vdGUubm90aWZ5T25Db21wbGV0ZSwgc291bmQ6IG5vdGUuc291bmRPbkNvbXBsZXRlIH1cbiAgICA6IHsgb3M6IG5vdGUubm90aWZ5T25FbmQsIHNvdW5kOiBub3RlLnNvdW5kT25FbmQgfVxuXG4vLyDrsLHqt7jrnbzsmrTrk5zsl5DshJwg7YOA7J2066i4IOyiheujjOulvCDslYzrprwg4oCUIE9TIOyVjOumvOydgCDsp4HsoJEsIOyCrOyatOuTnOuKlCBvZmZzY3JlZW4g6rK97JygXG5leHBvcnQgY29uc3Qgbm90aWZ5UGhhc2VFbmQgPSBhc3luYyAoXG4gIG5vdGU6IE5vdGUsXG4gIHBoYXNlOiBUaW1lclBoYXNlLFxuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGV2ZW50ID0gcmVzb2x2ZVBoYXNlRW5kRXZlbnQobm90ZS50eXBlLCBwaGFzZSlcbiAgY29uc3QgY2hhbm5lbHMgPSBjaGFubmVsc0Zvcihub3RlKVxuXG4gIGlmIChjaGFubmVscy5vcylcbiAgICBhd2FpdCBjaHJvbWUubm90aWZpY2F0aW9ucy5jcmVhdGUoe1xuICAgICAgdHlwZTogJ2Jhc2ljJyxcbiAgICAgIGljb25Vcmw6IGNocm9tZS5ydW50aW1lLmdldFVSTCgnL2ljb25zL2ljb24xMjgucG5nJyksXG4gICAgICB0aXRsZTogbm90ZS50aXRsZSxcbiAgICAgIG1lc3NhZ2U6IEVWRU5UU1tldmVudF0ubWVzc2FnZSxcbiAgICB9KVxuXG4gIGlmIChjaGFubmVscy5zb3VuZCkge1xuICAgIGF3YWl0IGVuc3VyZU9mZnNjcmVlbkRvY3VtZW50KClcbiAgICAvLyBvZmZzY3JlZW4g66as7Iqk64SI6rCAIOyVhOyngSDsl4brjZTrnbzrj4Qg7Iuk7Yyo6rCAIOyghOyytCDtnZDrpoTsnYQg66eJ7KeAIOyViuuPhOuhnSDrsKnslrRcbiAgICB2b2lkIGNocm9tZS5ydW50aW1lXG4gICAgICAuc2VuZE1lc3NhZ2UoeyB0eXBlOiAncGxheS1zb3VuZCcsIHNvdW5kOiBFVkVOVFNbZXZlbnRdLnNvdW5kIH0pXG4gICAgICAuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKVxuICB9XG59XG4iLCJpbXBvcnQgdHlwZSB7IE5vdGUgfSBmcm9tICcuLi9zcmMvdHlwZXMvbm90ZSdcbmltcG9ydCB0eXBlIHsgVGltZXJQaGFzZSwgVGltZXJTdGF0ZSB9IGZyb20gJy4uL3NyYy90eXBlcy90aW1lcidcbmltcG9ydCB7IGNsZWFyQmFkZ2UsIHVwZGF0ZUJhZGdlIH0gZnJvbSAnLi4vc3JjL2JhY2tncm91bmQvYmFkZ2VNYW5hZ2VyJ1xuaW1wb3J0IHsgbm90aWZ5UGhhc2VFbmQgfSBmcm9tICcuLi9zcmMvYmFja2dyb3VuZC9waGFzZU5vdGlmaWVyJ1xuXG5jb25zdCBTVE9SQUdFX0tFWSA9ICdmb2N1c2NhbCdcbmNvbnN0IEJBREdFX0FMQVJNID0gJ2JhZGdlLXJlZnJlc2gnXG5jb25zdCBUSU1FUl9BTEFSTSA9ICd0aW1lci1lbmQnXG5jb25zdCBBTEFSTV9DT05URVhUX0tFWSA9ICd0aW1lckFsYXJtQ29udGV4dCdcblxuLy8g7JWM656M7J2AIO2OmOydtOuhnOuTnOulvCDsi6TsnYQg7IiYIOyXhuqzoCwg67Cc7ZmUIOyLnOygkOyXlCDtjJ3sl4XsnbQg7J2066+4IHRpbWVyU3RhdGXrpbwg67mE7Jug7J2EIOyImCDsnojslrRcbi8vIOyYiOyVvSDsi5zsoJDsnZgg7YyQ67OEIOygleuztOulvCBzdG9yYWdlLnNlc3Npb27sl5Ag65Sw66GcIOuztOq0gO2VnOuLpFxuaW50ZXJmYWNlIFRpbWVyQWxhcm1Db250ZXh0IHtcbiAgbm90ZUlkOiBzdHJpbmdcbiAgcGhhc2U6IFRpbWVyUGhhc2VcbiAgZW5kc0F0OiBudW1iZXJcbn1cblxuLy8genVzdGFuZCBwZXJzaXN06rCAIOyggOyepe2VnCBKU09OIOusuOyekOyXtOyXkOyEnCDslbEg7IOB7YOc66W8IOq6vOuDhFxuaW50ZXJmYWNlIFBlcnNpc3RlZFN0YXRlIHtcbiAgc3RhdGU6IHsgbm90ZXM6IE5vdGVbXTsgdGltZXJTdGF0ZTogVGltZXJTdGF0ZSB9XG59XG5cbmNvbnN0IHJlYWRBcHBTdGF0ZSA9IGFzeW5jICgpOiBQcm9taXNlPFBlcnNpc3RlZFN0YXRlWydzdGF0ZSddIHwgbnVsbD4gPT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zeW5jLmdldChTVE9SQUdFX0tFWSlcbiAgY29uc3QgcmF3ID0gcmVzdWx0W1NUT1JBR0VfS0VZXVxuICBpZiAodHlwZW9mIHJhdyAhPT0gJ3N0cmluZycpIHJldHVybiBudWxsXG4gIHRyeSB7XG4gICAgcmV0dXJuIChKU09OLnBhcnNlKHJhdykgYXMgUGVyc2lzdGVkU3RhdGUpLnN0YXRlXG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cblxuLy8g7KeE7ZaJIOykkSDtg4DsnbTrqLjsnZgg64Ko7J2AIOu2hOydhCDrsYPsp4Dsl5Ag67CY7JiB7ZWY6rOgLCDsp4Ttlokg7Jes67aA7JeQIOuUsOudvCDso7zquLAg6rCx7IugIOyVjOuejOydhCDsvJzqs6Ag64GUXG5jb25zdCByZWZyZXNoQmFkZ2UgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IHN0YXRlID0gYXdhaXQgcmVhZEFwcFN0YXRlKClcbiAgY29uc3QgdGltZXIgPSBzdGF0ZT8udGltZXJTdGF0ZVxuXG4gIGNvbnN0IHN0b3AgPSBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgY2hyb21lLmFsYXJtcy5jbGVhcihCQURHRV9BTEFSTSlcbiAgICBhd2FpdCBjbGVhckJhZGdlKClcbiAgfVxuXG4gIGlmICghc3RhdGUgfHwgIXRpbWVyPy5pc1J1bm5pbmcgfHwgdGltZXIuZW5kc0F0ID09PSBudWxsKSByZXR1cm4gc3RvcCgpXG5cbiAgY29uc3Qgbm90ZSA9IHN0YXRlLm5vdGVzLmZpbmQobiA9PiBuLmlkID09PSB0aW1lci5ub3RlSWQpXG4gIGNvbnN0IHJlbWFpbmluZyA9IE1hdGgucm91bmQoKHRpbWVyLmVuZHNBdCAtIERhdGUubm93KCkpIC8gMTAwMClcbiAgLy8g7Yyd7JeF7J20IOuLq+2ejCDssYQg64uo6rOE6rCAIOuBneuCnCDqsr3smrAg4oCUIOuLpOydjCDtjJ3sl4Ug7Jik7ZSIIOuVjCDri6jqs4Qg7KCE7ZmY7J20IOydvOyWtOuCmOuvgOuhnCDrsYPsp4Drp4wg7KCV66asXG4gIGlmICghbm90ZSB8fCByZW1haW5pbmcgPD0gMCkgcmV0dXJuIHN0b3AoKVxuXG4gIGF3YWl0IHVwZGF0ZUJhZGdlKHJlbWFpbmluZywgbm90ZS50eXBlKVxuICAvLyDrsYPsp4DripQg67aEIOuLqOychCDtkZzsi5zrnbwgMzDstIgg7KO86riwKGNocm9tZS5hbGFybXMg7LWc7IaM6rCSKeuptCDstqnrtoRcbiAgaWYgKCEoYXdhaXQgY2hyb21lLmFsYXJtcy5nZXQoQkFER0VfQUxBUk0pKSlcbiAgICBhd2FpdCBjaHJvbWUuYWxhcm1zLmNyZWF0ZShCQURHRV9BTEFSTSwgeyBwZXJpb2RJbk1pbnV0ZXM6IDAuNSB9KVxufVxuXG5jb25zdCByZWFkQWxhcm1Db250ZXh0ID0gYXN5bmMgKCk6IFByb21pc2U8VGltZXJBbGFybUNvbnRleHQgfCB1bmRlZmluZWQ+ID0+IHtcbiAgY29uc3Qgc3RvcmVkID0gYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc2Vzc2lvbi5nZXQoQUxBUk1fQ09OVEVYVF9LRVkpXG4gIHJldHVybiBzdG9yZWRbQUxBUk1fQ09OVEVYVF9LRVldIGFzIFRpbWVyQWxhcm1Db250ZXh0IHwgdW5kZWZpbmVkXG59XG5cbi8vIOynhO2WiSDspJHsnbTqs6Ag7JWE7KeBIOunjOujjCDsoITsnbTrqbQgZW5kc0F0IOyLnOygkOyXkCB0aW1lci1lbmQg7JWM656M7J2EIOyYiOyVve2VnOuLpC5cbi8vIOydtOuvuCDrp4zro4zrkJwgZW5kc0F07Jy866Gc64qUIOyerOyYiOyVve2VmOyngCDslYrripTri6Qg4oCUIO2VnCDrsogg7LKY66as65CcIOunjOujjOqwgCDsnbTtm4Qg7KCA7J6lIOuzgOqyveycvOuhnFxuLy8g64uk7IucIOyVjOumvOydhCDsj5jripQg6rKD7J2EIOunieq4sCDsnITtlaguIOygleyDgSDsvIDsnbTsiqTsnZgg7JWM656M7J2AIOunjOujjCDsoITsl5Ag7JiI7JW964+8IOq3uOuMgOuhnCDrsJztmZTtlZzri6QuXG5jb25zdCBzeW5jQWxhcm0gPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IHRpbWVyID0gKGF3YWl0IHJlYWRBcHBTdGF0ZSgpKT8udGltZXJTdGF0ZVxuXG4gIGlmIChcbiAgICB0aW1lcj8uaXNSdW5uaW5nICYmXG4gICAgdGltZXIuZW5kc0F0ICE9PSBudWxsICYmXG4gICAgdGltZXIubm90ZUlkICE9PSBudWxsICYmXG4gICAgdGltZXIuZW5kc0F0ID4gRGF0ZS5ub3coKVxuICApIHtcbiAgICBjb25zdCBjb250ZXh0OiBUaW1lckFsYXJtQ29udGV4dCA9IHtcbiAgICAgIG5vdGVJZDogdGltZXIubm90ZUlkLFxuICAgICAgcGhhc2U6IHRpbWVyLnBoYXNlLFxuICAgICAgZW5kc0F0OiB0aW1lci5lbmRzQXQsXG4gICAgfVxuICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLnNlc3Npb24uc2V0KHsgW0FMQVJNX0NPTlRFWFRfS0VZXTogY29udGV4dCB9KVxuICAgIGF3YWl0IGNocm9tZS5hbGFybXMuY3JlYXRlKFRJTUVSX0FMQVJNLCB7IHdoZW46IHRpbWVyLmVuZHNBdCB9KVxuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3QgY29udGV4dCA9IGF3YWl0IHJlYWRBbGFybUNvbnRleHQoKVxuICAvLyDrp4zro4wg7J6E67CVKDLstIgg7J2064K0KcK36rK96rO87ZaI6rOgIOyVhOyngSDsspjrpqwg7KCE7J24IOy7qO2FjeyKpO2KuOqwgCDsnojsnLzrqbRcbiAgLy8g7Yyd7JeF7J20IOuovOyggCDri6jqs4Trpbwg7KCE7ZmY7ZWcIOqyveyasOydtOuvgOuhnCDsmIjslb3rkJwg7JWM656M7J2EIOuCqOqyqCDrsJztmZTsi5ztgqjri6RcbiAgaWYgKGNvbnRleHQgJiYgRGF0ZS5ub3coKSA+PSBjb250ZXh0LmVuZHNBdCAtIDIwMDApIHJldHVyblxuXG4gIGF3YWl0IGNocm9tZS5hbGFybXMuY2xlYXIoVElNRVJfQUxBUk0pXG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLnNlc3Npb24ucmVtb3ZlKEFMQVJNX0NPTlRFWFRfS0VZKVxufVxuXG4vLyB0aW1lci1lbmQg7JWM656MIOuwnO2ZlCDihpIg7JiI7JW9IOy7qO2FjeyKpO2KuOuhnCDsooXro4wg7J2067Kk7Yq466W8IO2MkOuzhO2VtCDslYzrprwg67Cc7IahICgx7ZqM7ISxKVxuY29uc3QgaGFuZGxlVGltZXJFbmQgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gIGNvbnN0IGNvbnRleHQgPSBhd2FpdCByZWFkQWxhcm1Db250ZXh0KClcbiAgYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc2Vzc2lvbi5yZW1vdmUoQUxBUk1fQ09OVEVYVF9LRVkpXG4gIGlmICghY29udGV4dCB8fCBEYXRlLm5vdygpIDwgY29udGV4dC5lbmRzQXQgLSAyMDAwKSByZXR1cm5cblxuICBjb25zdCBub3RlID0gKGF3YWl0IHJlYWRBcHBTdGF0ZSgpKT8ubm90ZXMuZmluZChuID0+IG4uaWQgPT09IGNvbnRleHQubm90ZUlkKVxuICBpZiAoIW5vdGUpIHJldHVyblxuXG4gIGF3YWl0IG5vdGlmeVBoYXNlRW5kKG5vdGUsIGNvbnRleHQucGhhc2UpXG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoKCkgPT4ge1xuICAvLyDtjJ3sl4Xsl5DshJwg7YOA7J2066i4IOyLnOyekS/snbzsi5zsoJXsp4Av7JmE66OMIOyLnCDsoIDsnqXshozqsIAg6rCx7Iug65CY64qUIOymieyLnCDrsYPsp4DsmYAg7JWM656M7J2EIOuwmOyYgVxuICBjaHJvbWUuc3RvcmFnZS5vbkNoYW5nZWQuYWRkTGlzdGVuZXIoKGNoYW5nZXMsIGFyZWFOYW1lKSA9PiB7XG4gICAgaWYgKGFyZWFOYW1lID09PSAnc3luYycgJiYgY2hhbmdlc1tTVE9SQUdFX0tFWV0pIHtcbiAgICAgIHZvaWQgcmVmcmVzaEJhZGdlKClcbiAgICAgIHZvaWQgc3luY0FsYXJtKClcbiAgICB9XG4gIH0pXG5cbiAgY2hyb21lLmFsYXJtcy5vbkFsYXJtLmFkZExpc3RlbmVyKGFsYXJtID0+IHtcbiAgICBpZiAoYWxhcm0ubmFtZSA9PT0gQkFER0VfQUxBUk0pIHZvaWQgcmVmcmVzaEJhZGdlKClcbiAgICBpZiAoYWxhcm0ubmFtZSA9PT0gVElNRVJfQUxBUk0pIHZvaWQgaGFuZGxlVGltZXJFbmQoKVxuICB9KVxuXG4gIC8vIE9TIOyVjOumvCDtgbTrpq0g4oaSIOydteyKpO2FkOyFmCDtjJ3sl4XsnYQg7Je07Ja0IOyEuOyFmCDsooXro4wg7ZSM66Gc7Jqw66GcIOydtOyWtOqwkFxuICBjaHJvbWUubm90aWZpY2F0aW9ucy5vbkNsaWNrZWQuYWRkTGlzdGVuZXIobm90aWZpY2F0aW9uSWQgPT4ge1xuICAgIHZvaWQgY2hyb21lLm5vdGlmaWNhdGlvbnMuY2xlYXIobm90aWZpY2F0aW9uSWQpXG4gICAgY2hyb21lLmFjdGlvbi5vcGVuUG9wdXAoKS5jYXRjaCgoKSA9PlxuICAgICAgLy8g7Yyd7JeF7J2EIOyXtCDsiJgg7JeG64qUIOyDge2ZqSjtj6zsu6TsiqTrkJwg7LC9IOyXhuydjCDrk7Ep7JeQ7ISc64qUIOuPheumvSDssL3snLzroZwg64yA7LK0XG4gICAgICBjaHJvbWUud2luZG93cy5jcmVhdGUoe1xuICAgICAgICB1cmw6IGNocm9tZS5ydW50aW1lLmdldFVSTCgnL3BvcHVwLmh0bWw/bW9kZT13aW5kb3cnKSxcbiAgICAgICAgdHlwZTogJ3BvcHVwJyxcbiAgICAgICAgd2lkdGg6IDM4MCxcbiAgICAgICAgaGVpZ2h0OiA2MjAsXG4gICAgICAgIGZvY3VzZWQ6IHRydWUsXG4gICAgICB9KSxcbiAgICApXG4gIH0pXG5cbiAgLy8g67iM65287Jqw7KCAIOyLnOyekcK37ISc67mE7IqkIOybjOy7pCDsnqzquLDrj5kg7IucIOyDge2DnCDrs7Xsm5BcbiAgdm9pZCByZWZyZXNoQmFkZ2UoKVxuICB2b2lkIHN5bmNBbGFybSgpXG59KVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBicm93c2VyJDEgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy9icm93c2VyLnRzXG4vKipcbiogQ29udGFpbnMgdGhlIGBicm93c2VyYCBleHBvcnQgd2hpY2ggeW91IHNob3VsZCB1c2UgdG8gYWNjZXNzIHRoZSBleHRlbnNpb25cbiogQVBJcyBpbiB5b3VyIHByb2plY3Q6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG4qXG4qIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4qICAgLy8gLi4uXG4qIH0pO1xuKiBgYGBcbipcbiogQG1vZHVsZSB3eHQvYnJvd3NlclxuKi9cbmNvbnN0IGJyb3dzZXIgPSBicm93c2VyJDE7XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGJyb3dzZXIgfTtcbiIsIi8vIHNyYy9pbmRleC50c1xudmFyIF9NYXRjaFBhdHRlcm4gPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybikge1xuICAgIGlmIChtYXRjaFBhdHRlcm4gPT09IFwiPGFsbF91cmxzPlwiKSB7XG4gICAgICB0aGlzLmlzQWxsVXJscyA9IHRydWU7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IFsuLi5fTWF0Y2hQYXR0ZXJuLlBST1RPQ09MU107XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBncm91cHMgPSAvKC4qKTpcXC9cXC8oLio/KShcXC8uKikvLmV4ZWMobWF0Y2hQYXR0ZXJuKTtcbiAgICAgIGlmIChncm91cHMgPT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBcIkluY29ycmVjdCBmb3JtYXRcIik7XG4gICAgICBjb25zdCBbXywgcHJvdG9jb2wsIGhvc3RuYW1lLCBwYXRobmFtZV0gPSBncm91cHM7XG4gICAgICB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpO1xuICAgICAgdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKTtcbiAgICAgIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSk7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuICAgIH1cbiAgfVxuICBpbmNsdWRlcyh1cmwpIHtcbiAgICBpZiAodGhpcy5pc0FsbFVybHMpXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG4gICAgcmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZ0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcInVyblwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuICAgIH0pO1xuICB9XG4gIGlzSHR0cE1hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSHR0cHNNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIb3N0UGF0aE1hdGNoKHVybCkge1xuICAgIGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgaG9zdG5hbWVNYXRjaFJlZ2V4cyA9IFtcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gucmVwbGFjZSgvXlxcKlxcLi8sIFwiXCIpKVxuICAgIF07XG4gICAgY29uc3QgcGF0aG5hbWVNYXRjaFJlZ2V4ID0gdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5wYXRobmFtZU1hdGNoKTtcbiAgICByZXR1cm4gISFob3N0bmFtZU1hdGNoUmVnZXhzLmZpbmQoKHJlZ2V4KSA9PiByZWdleC50ZXN0KHVybC5ob3N0bmFtZSkpICYmIHBhdGhuYW1lTWF0Y2hSZWdleC50ZXN0KHVybC5wYXRobmFtZSk7XG4gIH1cbiAgaXNGaWxlTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZpbGU6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzRnRwTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNVcm5NYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogdXJuOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBjb252ZXJ0UGF0dGVyblRvUmVnZXgocGF0dGVybikge1xuICAgIGNvbnN0IGVzY2FwZWQgPSB0aGlzLmVzY2FwZUZvclJlZ2V4KHBhdHRlcm4pO1xuICAgIGNvbnN0IHN0YXJzUmVwbGFjZWQgPSBlc2NhcGVkLnJlcGxhY2UoL1xcXFxcXCovZywgXCIuKlwiKTtcbiAgICByZXR1cm4gUmVnRXhwKGBeJHtzdGFyc1JlcGxhY2VkfSRgKTtcbiAgfVxuICBlc2NhcGVGb3JSZWdleChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbiAgfVxufTtcbnZhciBNYXRjaFBhdHRlcm4gPSBfTWF0Y2hQYXR0ZXJuO1xuTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUyA9IFtcImh0dHBcIiwgXCJodHRwc1wiLCBcImZpbGVcIiwgXCJmdHBcIiwgXCJ1cm5cIl07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuICAgIHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG4gIH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcbiAgaWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgJHtwcm90b2NvbH0gbm90IGEgdmFsaWQgcHJvdG9jb2wgKCR7TWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5qb2luKFwiLCBcIil9KWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKSB7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIjpcIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBgSG9zdG5hbWUgY2Fubm90IGluY2x1ZGUgYSBwb3J0YCk7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIipcIikgJiYgaG9zdG5hbWUubGVuZ3RoID4gMSAmJiAhaG9zdG5hbWUuc3RhcnRzV2l0aChcIiouXCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSkge1xuICByZXR1cm47XG59XG5leHBvcnQge1xuICBJbnZhbGlkTWF0Y2hQYXR0ZXJuLFxuICBNYXRjaFBhdHRlcm5cbn07XG4iXSwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNSw2LDddLCJtYXBwaW5ncyI6Ijs7Q0FDQSxTQUFTLGlCQUFpQixLQUFLO0VBQzlCLElBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxZQUFZLE9BQU8sRUFBRSxNQUFN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