/*\
title: $:/plugins/mblackman/projectify/ui/widgets/date-picker.js
type: application/javascript
module-type: widget

py-date-picker widget factory.

This widget is intended to be used within a drop-down (with the tc-drop-down CSS
class). See $:/plugins/mblackman/projectify/ui/buttons/TodoDueDate for usages.

\*/
(function() {

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

const Widget = require("$:/core/modules/widgets/widget.js").widget;
const Pikaday = require("$:/plugins/mblackman/projectify/lib/pikaday.js");

function detectDeviceLocaleUses12Hour() {
	try {
		if(typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
			const opts = new Intl.DateTimeFormat(undefined, {hour: "numeric"}).resolvedOptions();
			if(typeof opts.hour12 === "boolean") {
				return opts.hour12;
			}
			if(typeof opts.hourCycle === "string") {
				return opts.hourCycle === "h11" || opts.hourCycle === "h12";
			}
		}
	} catch(_e) {
		// Fall back to 24h if Intl is unavailable
	}
	return false;
}

function is12HourTimePreferred(wiki) {
	const targetWiki = wiki || (typeof $tw !== "undefined" ? $tw.wiki : null);
	if(targetWiki) {
		const pref = (targetWiki.getTiddlerText("$:/config/projectify/TimeFormat", "auto") || "auto").trim().toLowerCase();
		if(pref === "12h" || pref === "12") return true;
		if(pref === "24h" || pref === "24") return false;
		const statusVal = (
			targetWiki.getTiddlerText("$:/temp/projectify/LocaleTimeFormat", "") ||
			targetWiki.getTiddlerText("$:/status/projectify/LocaleTimeFormat", "") ||
			""
		).trim().toLowerCase();
		if(statusVal === "12h") return true;
		if(statusVal === "24h") return false;
	}
	return detectDeviceLocaleUses12Hour();
}

function getToday() {
	return new Date();
}

function getTomorrow() {
	const today = getToday();
	const tomorrow = new Date(today);
	tomorrow.setDate(today.getDate() + 1);
	return tomorrow;
}

function getNextMonday() {
	const tomorrow = getTomorrow();
	const monday = new Date(tomorrow);
	monday.setDate(monday.getDate() + (1 + 7 - tomorrow.getDay()) % 7);
	return monday;
}

function isEndOfDayDate(date) {
	if(!date || typeof date.getTime !== "function" || Number.isNaN(date.getTime())) {
		return true;
	}
	return (
		date.getHours() === 23 &&
		date.getMinutes() === 59 &&
		date.getSeconds() === 59 &&
		date.getMilliseconds() === 999
	);
}

function formatEndOfDay(date) {
	const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
	return $tw.utils.formatDateString(endOfDay, "[UTC]YYYY0MM0DD0hh0mm0ss0XXX");
}

function formatDateWithOptionalTime(date, existingDate, timeToken) {
	if(timeToken) {
		const tm = parseTimeToken(timeToken);
		if(tm) {
			const withTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), tm.hours, tm.minutes, 0, 0);
			return $tw.utils.formatDateString(withTime, "[UTC]YYYY0MM0DD0hh0mm0ss0XXX");
		}
	}
	if(existingDate && typeof existingDate.getTime === "function" && !Number.isNaN(existingDate.getTime()) && !isEndOfDayDate(existingDate)) {
		const preserved = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate(),
			existingDate.getHours(),
			existingDate.getMinutes(),
			0,
			0
		);
		return $tw.utils.formatDateString(preserved, "[UTC]YYYY0MM0DD0hh0mm0ss0XXX");
	}
	return formatEndOfDay(date);
}

function parseTimeToken(str) {
	if(!str) return null;
	const m = String(str).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
	if(!m) return null;
	let hours = parseInt(m[1], 10);
	const minutes = m[2] !== undefined ? parseInt(m[2], 10) : 0;
	const meridiem = m[3] ? m[3].toLowerCase() : null;
	if(minutes < 0 || minutes > 59) return null;
	if(meridiem) {
		if(hours < 1 || hours > 12) return null;
		if(meridiem === "pm" && hours < 12) hours += 12;
		if(meridiem === "am" && hours === 12) hours = 0;
	} else {
		if(hours < 0 || hours > 23) return null;
	}
	return {hours, minutes};
}

function computeNextOccurrenceDate(baseDate, recurRule) {
	const today = getToday();
	const start = (baseDate && !Number.isNaN(baseDate.getTime()) && baseDate > today) ? new Date(baseDate) : new Date(today);
	const hasSpecificTime = baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) && !isEndOfDayDate(baseDate);
	const next = hasSpecificTime
		? new Date(start.getFullYear(), start.getMonth(), start.getDate(), baseDate.getHours(), baseDate.getMinutes(), 0, 0)
		: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
	const rule = (recurRule || "").trim().toLowerCase();

	if(rule === "daily") {
		next.setDate(next.getDate() + 1);
	} else if(rule === "weekdays") {
		do {
			next.setDate(next.getDate() + 1);
		} while(next.getDay() === 0 || next.getDay() === 6);
	} else if(rule === "weekly") {
		next.setDate(next.getDate() + 7);
	} else if(rule === "monthly") {
		next.setMonth(next.getMonth() + 1);
	} else if(rule === "yearly") {
		next.setFullYear(next.getFullYear() + 1);
	} else {
		const match = rule.match(/^\+?(\d+)([dwmy])$/);
		if(match) {
			const count = parseInt(match[1], 10);
			const unit = match[2];
			if(unit === "d") next.setDate(next.getDate() + count);
			else if(unit === "w") next.setDate(next.getDate() + count * 7);
			else if(unit === "m") next.setMonth(next.getMonth() + count);
			else if(unit === "y") next.setFullYear(next.getFullYear() + count);
		} else {
			next.setDate(next.getDate() + 1);
		}
	}
	return next;
}

function parseSmartQuickAddTokens(rawText, wiki) {
	let text = (rawText || "").trim();
	const result = {
		title: text,
		priority: undefined,
		due: undefined,
		scheduled: undefined,
		project: undefined,
		contexts: []
	};
	if(!text) {
		return result;
	}

	const enabled = !wiki || wiki.getTiddlerText("$:/config/projectify/SmartQuickAdd", "yes") !== "no";
	if(!enabled) {
		return result;
	}

	// Parse priority tokens: !1, !2, !3, p1, p2, p3 (as standalone whitespace-delimited tokens)
	text = text.replace(/(?:^|\s)(?:!([123])|p([123]))(?=\s|$)/gi, (match, pBang, pChar) => {
		result.priority = pBang || pChar;
		return " ";
	});

	// Parse due date tokens: @today, @tomorrow, @nextweek, @YYYY-MM-DD (with optional @time suffix like @today@14:30 or @tomorrow@9am)
	text = text.replace(/(?:^|\s)@(today|tomorrow|nextweek|\d{4}-\d{2}-\d{2})(?:@(\d{1,2}(?::\d{2})?(?:am|pm)?))?(?=\s|$)/gi, (match, token, timePart) => {
		const lower = token.toLowerCase();
		let dt;
		if(lower === "today") {
			dt = getToday();
		} else if(lower === "tomorrow") {
			dt = getTomorrow();
		} else if(lower === "nextweek") {
			dt = getNextMonday();
		} else {
			const parts = token.split("-");
			const parsedDt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
			if(!Number.isNaN(parsedDt.getTime())) {
				dt = parsedDt;
			}
		}
		if(dt) {
			result.due = formatDateWithOptionalTime(dt, null, timePart);
		}
		return " ";
	});

	// Parse standalone due time token: @14:30, @9am, @5:30pm (implies due today at that time if no due date was specified)
	text = text.replace(/(?:^|\s)@(\d{1,2}:\d{2}(?:am|pm)?|\d{1,2}(?:am|pm))(?=\s|$)/gi, (match, timePart) => {
		const baseDt = result.due ? $tw.utils.parseDate(result.due) : getToday();
		result.due = formatDateWithOptionalTime(baseDt || getToday(), null, timePart);
		return " ";
	});

	// Parse start/scheduled tokens: ~today, ~tomorrow, ~nextweek, ~YYYY-MM-DD (with optional @time suffix like ~today@09:00)
	text = text.replace(/(?:^|\s)~(today|tomorrow|nextweek|\d{4}-\d{2}-\d{2})(?:@(\d{1,2}(?::\d{2})?(?:am|pm)?))?(?=\s|$)/gi, (match, token, timePart) => {
		const lower = token.toLowerCase();
		let dt;
		if(lower === "today") {
			dt = getToday();
		} else if(lower === "tomorrow") {
			dt = getTomorrow();
		} else if(lower === "nextweek") {
			dt = getNextMonday();
		} else {
			const parts = token.split("-");
			const parsedDt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
			if(!Number.isNaN(parsedDt.getTime())) {
				dt = parsedDt;
			}
		}
		if(dt) {
			result.scheduled = formatDateWithOptionalTime(dt, null, timePart);
		}
		return " ";
	});

	// Parse standalone scheduled time token: ~14:30, ~9am, ~5:30pm
	text = text.replace(/(?:^|\s)~(\d{1,2}:\d{2}(?:am|pm)?|\d{1,2}(?:am|pm))(?=\s|$)/gi, (match, timePart) => {
		const baseDt = result.scheduled ? $tw.utils.parseDate(result.scheduled) : getToday();
		result.scheduled = formatDateWithOptionalTime(baseDt || getToday(), null, timePart);
		return " ";
	});

	// Parse #Project token: #[Project Name] or #ProjectWord
	text = text.replace(/(?:^|\s)#(?:\[([^\]]+)\]|([^\s#]+))(?=\s|$)/g, (match, bracketed, single) => {
		const projName = (bracketed || single || "").trim();
		if(projName) {
			result.project = projName;
		}
		return " ";
	});

	// Parse remaining @context tokens (e.g., @work, @home, @computer, @errands)
	text = text.replace(/(?:^|\s)@([a-zA-Z0-9_-]+)(?=\s|$)/g, (match, ctx) => {
		const tag = `@${ctx}`;
		if(!result.contexts.includes(tag)) {
			result.contexts.push(tag);
		}
		return " ";
	});

	const cleanedTitle = text.replace(/\s+/g, " ").trim();
	if(cleanedTitle) {
		result.title = cleanedTitle;
	}
	return result;
}

class AbstractDatePickerWidget extends Widget {
	initialise(parseTreeNode, options) {
		super.initialise(parseTreeNode, options);
	}

	execute() {
		this.title = this.getAttribute("tiddler", this.getVariable("currentTiddler"));
		this.field = this.getAttribute("field", "due");
		this.makeChildWidgets();
	}

	refresh(changedTiddlers) {
		const changedAttributes = this.computeAttributes();
		if(changedAttributes.tiddler || changedAttributes.field) {
			this.refreshSelf();
			return true;
		}
		return this.refreshChildren(changedTiddlers);
	}

	getTiddler() {
		return this.wiki.getTiddler(this.title);
	}

	getValue() {
		const tiddler = this.getTiddler();
		if(!tiddler) {
			return undefined;
		}
		const fieldVal = tiddler.getFieldString(this.field);
		return fieldVal ? $tw.utils.parseDate(fieldVal) : undefined;
	}

	setEndOfDate(date) {
		if(!this.title) {
			return;
		}
		const existing = this.getTiddler();
		const currentVal = this.getValue();
		const updateFields = {
			title: this.title,
			[this.field]: date ? formatDateWithOptionalTime(date, currentVal) : undefined
		};

		this.wiki.addTiddler(
			new $tw.Tiddler(
				this.wiki.getCreationFields(),
				existing,
				updateFields,
				this.wiki.getModificationFields()
			)
		);

		$tw.rootWidget.dispatchEvent({type: "tm-auto-save-wiki"});
	}

	setSpecificTime(timeStr) {
		if(!this.title) {
			return;
		}
		const existing = this.getTiddler();
		const currentVal = this.getValue() || getToday();
		const cleanTime = (timeStr || "").trim();
		const updateFields = {
			title: this.title,
			[this.field]: cleanTime ? formatDateWithOptionalTime(currentVal, null, cleanTime) : formatEndOfDay(currentVal)
		};

		this.wiki.addTiddler(
			new $tw.Tiddler(
				this.wiki.getCreationFields(),
				existing,
				updateFields,
				this.wiki.getModificationFields()
			)
		);

		$tw.rootWidget.dispatchEvent({type: "tm-auto-save-wiki"});
	}

	endOfDate(date) {
		// TW format is [UTC]YYYY0MM0DD0hh0mm0ss0XXX
		const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
		return $tw.utils.formatDateString(endOfDay, "[UTC]YYYY0MM0DD0hh0mm0ss0XXX");
	}
}

class TimePickerWidget extends AbstractDatePickerWidget {
	render(parent, nextSibling) {
		this.parentDomNode = parent;
		this.computeAttributes();
		this.execute();

		this.domNode = this.createDomNode();
		parent.insertBefore(this.domNode, nextSibling);
		this.domNodes.push(this.domNode);
	}

	refresh(changedTiddlers) {
		const changedAttributes = this.computeAttributes();
		if(
			changedAttributes.tiddler ||
			changedAttributes.field ||
			changedTiddlers["$:/config/projectify/TimeFormat"] ||
			changedTiddlers["$:/temp/projectify/LocaleTimeFormat"] ||
			changedTiddlers["$:/status/projectify/LocaleTimeFormat"]
		) {
			this.refreshSelf();
			return true;
		}
		if(changedTiddlers[this.title]) {
			this.syncUiState();
		}
		return this.refreshChildren(changedTiddlers);
	}

	getCurrentTimeString() {
		const dt = this.getValue();
		if(!dt || isEndOfDayDate(dt)) {
			return "";
		}
		const hh = String(dt.getHours()).padStart(2, "0");
		const mm = String(dt.getMinutes()).padStart(2, "0");
		return `${hh}:${mm}`;
	}

	syncLocaleTimeStatus() {
		if(this.wiki && !this.wiki.tiddlerExists("$:/temp/projectify/LocaleTimeFormat")) {
			this.wiki.addTiddler({
				title: "$:/temp/projectify/LocaleTimeFormat",
				text: detectDeviceLocaleUses12Hour() ? "12h" : "24h"
			});
		}
	}

	formatTimeBadgeLabel(timeStr, use12h) {
		if(!timeStr) return "";
		const parts = timeStr.split(":");
		const h = parseInt(parts[0], 10);
		const mm = parts[1] || "00";
		if(Number.isNaN(h)) return timeStr;
		if(use12h) {
			const suffix = h < 12 ? "AM" : "PM";
			const h12 = h % 12 === 0 ? 12 : h % 12;
			return `${h12}:${mm} ${suffix}`;
		}
		return `${String(h).padStart(2, "0")}:${mm}`;
	}

	stepTimeByMinutes(deltaMinutes) {
		const currentStr = this.getCurrentTimeString();
		let totalMinutes = 12 * 60;
		if(currentStr) {
			const parts = currentStr.split(":");
			const h = parseInt(parts[0], 10);
			const m = parseInt(parts[1] || "0", 10);
			if(!Number.isNaN(h) && !Number.isNaN(m)) {
				totalMinutes = h * 60 + m + deltaMinutes;
			}
		} else {
			totalMinutes = 12 * 60 + deltaMinutes;
		}
		const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
		const nextH = String(Math.floor(wrapped / 60)).padStart(2, "0");
		const nextM = String(wrapped % 60).padStart(2, "0");
		this.setSpecificTime(`${nextH}:${nextM}`);
		this.syncUiState();
	}

	syncUiState() {
		const currentStr = this.getCurrentTimeString();
		const use12h = is12HourTimePreferred(this.wiki);
		if(this.clearBtnNode) {
			this.clearBtnNode.hidden = !currentStr;
		}
		if(this.badgeNode) {
			this.badgeNode.textContent = currentStr ? this.formatTimeBadgeLabel(currentStr, use12h) : "";
			this.badgeNode.hidden = !currentStr;
		}
		if(this.presetButtons) {
			this.presetButtons.forEach(({btn, time}) => {
				const baseCls = "tc-btn-invisible py-time-chip tc-popup-handle";
				btn.className = currentStr === time ? `${baseCls} py-active` : baseCls;
				btn.setAttribute("aria-pressed", currentStr === time ? "true" : "false");
			});
		}
		if(this.timeInputNode && this.timeInputNode.value !== currentStr) {
			this.timeInputNode.value = currentStr;
		}
	}

	createDomNode() {
		this.syncLocaleTimeStatus();
		const use12h = is12HourTimePreferred(this.wiki);
		const wrap = this.document.createElement("div");
		wrap.className = "py-time-picker-control tc-popup-handle";

		// 1. Header row: Clock icon + "Time" label + active time badge + Clear button
		const header = this.document.createElement("div");
		header.className = "py-time-header tc-popup-handle";

		const labelGroup = this.document.createElement("span");
		labelGroup.className = "py-inline-label tc-popup-handle";
		const clockIconTid = this.wiki.getTiddlerText("$:/plugins/mblackman/projectify/images/clock", "");
		const timeCaption = this.wiki.getTiddlerText("$:/language/projectify/Time", "Time");
		labelGroup.innerHTML = `${clockIconTid} <span class="tc-popup-handle">${timeCaption}</span>`;

		const badgeSpan = this.document.createElement("span");
		badgeSpan.className = "py-time-badge tc-popup-handle";
		badgeSpan.hidden = true;
		this.badgeNode = badgeSpan;
		labelGroup.appendChild(badgeSpan);

		const clearBtn = this.document.createElement("button");
		clearBtn.setAttribute("type", "button");
		clearBtn.className = "tc-btn-invisible py-time-clear tc-popup-handle";
		const clearCaption = this.wiki.getTiddlerText("$:/language/projectify/Clear", "Clear");
		clearBtn.textContent = `× ${clearCaption}`;
		clearBtn.title = use12h
			? "Clear specific time (use default 12:00 PM notification)"
			: "Clear specific time (use default 12:00 notification)";
		this.clearBtnNode = clearBtn;

		clearBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.setSpecificTime("");
			this.syncUiState();
		});

		header.appendChild(labelGroup);
		header.appendChild(clearBtn);
		wrap.appendChild(header);

		// 2. 4-chip quick preset grid
		const presetsGrid = this.document.createElement("div");
		presetsGrid.className = "py-time-presets tc-popup-handle";
		const presets = [
			{label: use12h ? "🌅 9 AM" : "🌅 09:00", time: "09:00", hint: "Morning (9:00 AM)"},
			{label: use12h ? "☀️ 12 PM" : "☀️ 12:00", time: "12:00", hint: "Noon (12:00 PM)"},
			{label: use12h ? "🌤️ 3 PM" : "🌤️ 15:00", time: "15:00", hint: "Afternoon (3:00 PM)"},
			{label: use12h ? "🌙 6 PM" : "🌙 18:00", time: "18:00", hint: "Evening (6:00 PM)"}
		];
		this.presetButtons = [];

		presets.forEach((p) => {
			const btn = this.document.createElement("button");
			btn.setAttribute("type", "button");
			btn.className = "tc-btn-invisible py-time-chip tc-popup-handle";
			btn.textContent = p.label;
			btn.title = p.hint;
			btn.addEventListener("click", (e) => {
				e.preventDefault();
				const currentStr = this.getCurrentTimeString();
				if(currentStr === p.time) {
					this.setSpecificTime("");
				} else {
					this.setSpecificTime(p.time);
				}
				this.syncUiState();
			});
			this.presetButtons.push({btn, time: p.time});
			presetsGrid.appendChild(btn);
		});
		wrap.appendChild(presetsGrid);

		// 3. Unified native <input type="time"> + [-15m] / [+15m] quick-nudge stepper row
		const customRow = this.document.createElement("div");
		customRow.className = "py-time-custom-row tc-popup-handle";

		const stepMinusBtn = this.document.createElement("button");
		stepMinusBtn.setAttribute("type", "button");
		stepMinusBtn.className = "tc-btn-invisible py-time-step-btn tc-popup-handle";
		stepMinusBtn.textContent = "−15m";
		stepMinusBtn.title = "15 minutes earlier";
		stepMinusBtn.setAttribute("aria-label", "15 minutes earlier");
		stepMinusBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.stepTimeByMinutes(-15);
		});

		const timeInput = this.document.createElement("input");
		timeInput.setAttribute("type", "time");
		timeInput.setAttribute("step", "300");
		timeInput.setAttribute("aria-label", timeCaption);
		timeInput.className = "py-input py-time-input tc-popup-handle";
		this.timeInputNode = timeInput;

		const onTimeInputChange = () => {
			const val = (timeInput.value || "").trim();
			this.setSpecificTime(val);
			this.syncUiState();
		};
		timeInput.addEventListener("change", onTimeInputChange);
		timeInput.addEventListener("input", onTimeInputChange);

		const stepPlusBtn = this.document.createElement("button");
		stepPlusBtn.setAttribute("type", "button");
		stepPlusBtn.className = "tc-btn-invisible py-time-step-btn tc-popup-handle";
		stepPlusBtn.textContent = "+15m";
		stepPlusBtn.title = "15 minutes later";
		stepPlusBtn.setAttribute("aria-label", "15 minutes later");
		stepPlusBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.stepTimeByMinutes(15);
		});

		customRow.appendChild(stepMinusBtn);
		customRow.appendChild(timeInput);
		customRow.appendChild(stepPlusBtn);
		wrap.appendChild(customRow);

		this.syncUiState();
		return wrap;
	}
}

function createQuickDateWidget(getDate, cssClass) {
	return class QuickDatePickerWidget extends AbstractDatePickerWidget {
		render(parent, nextSibling) {
			this.parentDomNode = parent;
			this.computeAttributes();
			this.execute();

			this.domNode = this.createDomNode();

			parent.insertBefore(this.domNode, nextSibling);
			this.renderChildren(this.domNode, null);
			this.domNodes.push(this.domNode);
		}

		createDomNode() {
			const btn = this.document.createElement("button");
			btn.setAttribute("type", "button");
			btn.className = `tc-btn-invisible ${cssClass}`;
			btn.addEventListener("click", (event) => {
				event.preventDefault();
				this.setEndOfDate(getDate());
				if($tw.popup) {
					$tw.popup.cancel(0);
				}
			});
			return btn;
		}
	};
}

class CalendarWidget extends AbstractDatePickerWidget {
	render(parent, nextSibling) {
		this.parentDomNode = parent;
		this.computeAttributes();
		this.execute();

		this.domNode = this.renderCalendar();

		parent.insertBefore(this.domNode, nextSibling);
		this.renderChildren(this.domNode, null);
		this.domNodes.push(this.domNode);
	}

	refresh(changedTiddlers) {
		const changedAttributes = this.computeAttributes();
		if(
			changedAttributes.tiddler ||
			changedAttributes.field ||
			changedTiddlers[this.title] ||
			changedTiddlers["$:/config/projectify/FirstDayOfWeek"]
		) {
			this.refreshSelf();
			return true;
		}
		return this.refreshChildren(changedTiddlers);
	}

	removeChildDomNodes() {
		if(this.calendar && typeof this.calendar.destroy === "function") {
			this.calendar.destroy();
			this.calendar = null;
		}
		super.removeChildDomNodes();
	}

	renderCalendar() {
		if(typeof document === "undefined") {
			return this.document.createElement("div");
		}
		const firstDayVal = parseInt(this.wiki.getTiddlerText("$:/config/projectify/FirstDayOfWeek", "1"), 10);
		const firstDay = Number.isNaN(firstDayVal) ? 1 : firstDayVal;

		const markPopupHandles = (rootEl) => {
			if(!rootEl || !rootEl.querySelectorAll) return;
			rootEl.querySelectorAll(".pika-label, .pika-select, .pika-prev, .pika-next").forEach((elt) => {
				elt.classList.add("tc-popup-handle");
			});
		};

		this.calendar = new Pikaday({
			firstDay: firstDay,
			keyboardInput: false,
			i18n: this.getLabels(),
			onSelect: () => {
				this.setEndOfDate(this.calendar.getDate());
				if($tw.popup) {
					$tw.popup.cancel(0);
				}
			},
			onDraw: () => {
				if(this.calendar && this.calendar.el) {
					markPopupHandles(this.calendar.el);
				}
			}
		});

		const currentVal = this.getValue();
		if(currentVal) {
			this.calendar.setDate(currentVal, true);
		}
		markPopupHandles(this.calendar.el);

		return this.calendar.el;
	}

	getLabels() {
		return {
			previousMonth : "Previous Month",
			nextMonth     : "Next Month",
			months        : this.getMonthLabels(),
			monthsShort   : this.getShortMonthLabels(),
			weekdays      : this.getDayLabels(),
			weekdaysShort : this.getShortDayLabels()
		};
	}

	getMonthLabels() {
		return this._mapRange(12, i => this._getDateLabel(`Long/Month/${i + 1}`));
	}

	getShortMonthLabels() {
		return this._mapRange(12, i => this._getDateLabel(`Short/Month/${i + 1}`));
	}

	getDayLabels() {
		return this._mapRange(7, i => this._getDateLabel(`Long/Day/${i}`));
	}

	getShortDayLabels() {
		return this._mapRange(7, i => this._getDateLabel(`Short/Day/${i}`));
	}

	_mapRange(n, f) {
		return Array.from({length: n}, (_, i) => f(i));
	}

	_getDateLabel(title) {
		return this.wiki.getTextReference(`$:/language/Date/${title}`, "", this.title);
	}
}

class ActionToggleTodoWidget extends Widget {
	render(parent, nextSibling) {
		this.computeAttributes();
		this.execute();
	}

	execute() {
		this.tiddlerTitle = this.getAttribute("$tiddler", this.getAttribute("tiddler", this.getVariable("currentTiddler")));
		this.statusAttr = this.getAttribute("$status", this.getAttribute("status", ""));
	}

	refresh(changedTiddlers) {
		const changedAttributes = this.computeAttributes();
		if(Object.keys(changedAttributes).length > 0) {
			this.refreshSelf();
			return true;
		}
		return this.refreshChildren(changedTiddlers);
	}

	allowActionPropagation() {
		return false;
	}

	invokeAction(triggeringWidget, event) {
		this.computeAttributes();
		this.execute();
		const title = this.tiddlerTitle;
		if(!title) {
			return true;
		}
		const existing = this.wiki.getTiddler(title);
		if(!existing) {
			return true;
		}

		const nowStamp = $tw.utils.formatDateString(new Date(), "[UTC]YYYY0MM0DD0hh0mm0ss0XXX");
		const currentTags = (existing.fields.tags || []).slice();
		const isCurrentlyDone = currentTags.includes("done");
		const recurRule = existing.getFieldString("recur").trim();

		// Explicit status transition if $status is provided
		if(this.statusAttr) {
			const targetStatus = this.statusAttr;
			const nextTags = currentTags.filter(t => t !== "done" && t !== "cancelled");
			const updateFields = {
				title: title,
				status: targetStatus
			};
			if(targetStatus === "done" || targetStatus === "cancelled") {
				nextTags.push("done");
				if(targetStatus === "cancelled") {
					nextTags.push("cancelled");
				}
				updateFields.completed = nowStamp;
			} else {
				updateFields.completed = undefined;
			}
			updateFields.tags = nextTags;
			this.wiki.addTiddler(
				new $tw.Tiddler(
					this.wiki.getCreationFields(),
					existing,
					updateFields,
					this.wiki.getModificationFields()
				)
			);
			if((targetStatus === "done" || targetStatus === "cancelled") && $tw.rootWidget) {
				$tw.rootWidget.dispatchEvent({
					type: "tm-pwa-cancel-notification",
					paramObject: {id: `projectify-remind:${title}`}
				});
				$tw.rootWidget.dispatchEvent({
					type: "tm-pwa-cancel-notification",
					paramObject: {id: `projectify-focus:${title}`}
				});
			}
			$tw.rootWidget.dispatchEvent({type: "tm-auto-save-wiki"});
			return true;
		}

		// Standard toggle behavior (with recurring task support)
		if(!isCurrentlyDone && recurRule) {
			const currentDue = existing.getFieldString("due") ? $tw.utils.parseDate(existing.getFieldString("due")) : undefined;
			const nextDueDate = computeNextOccurrenceDate(currentDue, recurRule);
			const updateFields = {
				title: title,
				due: formatDateWithOptionalTime(nextDueDate, currentDue),
				"last-completed": nowStamp,
				status: "todo"
			};
			if(existing.getFieldString("scheduled")) {
				const currentSched = $tw.utils.parseDate(existing.getFieldString("scheduled"));
				const nextSchedDate = computeNextOccurrenceDate(currentSched, recurRule);
				updateFields.scheduled = formatDateWithOptionalTime(nextSchedDate, currentSched);
			}
			this.wiki.addTiddler(
				new $tw.Tiddler(
					this.wiki.getCreationFields(),
					existing,
					updateFields,
					this.wiki.getModificationFields()
				)
			);
		} else if(!isCurrentlyDone) {
			const nextTags = currentTags.concat(["done"]);
			this.wiki.addTiddler(
				new $tw.Tiddler(
					this.wiki.getCreationFields(),
					existing,
					{
						title: title,
						tags: nextTags,
						status: "done",
						completed: nowStamp
					},
					this.wiki.getModificationFields()
				)
			);
		} else {
			const nextTags = currentTags.filter(t => t !== "done" && t !== "cancelled");
			this.wiki.addTiddler(
				new $tw.Tiddler(
					this.wiki.getCreationFields(),
					existing,
					{
						title: title,
						tags: nextTags,
						status: "todo",
						completed: undefined
					},
					this.wiki.getModificationFields()
				)
			);
		}

		if(!isCurrentlyDone && $tw.rootWidget) {
			$tw.rootWidget.dispatchEvent({
				type: "tm-pwa-cancel-notification",
				paramObject: {id: `projectify-remind:${title}`}
			});
			$tw.rootWidget.dispatchEvent({
				type: "tm-pwa-cancel-notification",
				paramObject: {id: `projectify-focus:${title}`}
			});
		}

		$tw.rootWidget.dispatchEvent({type: "tm-auto-save-wiki"});
		return true;
	}
}

class ActionQuickAddTodoWidget extends Widget {
	render(parent, nextSibling) {
		this.computeAttributes();
		this.execute();
	}

	execute() {
		this.stateTiddler = this.getAttribute("$state", this.getAttribute("state", ""));
		this.fieldAttr = this.getAttribute("$field", this.getAttribute("field", "todo-name"));
		this.defaultTags = this.getAttribute("$tags", this.getAttribute("tags", "Inbox todo"));
		this.defaultSection = this.getAttribute("$section", this.getAttribute("section", ""));
		this.defaultStatus = this.getAttribute("$status", this.getAttribute("status", ""));
		this.parentTiddler = this.getAttribute("$parent", this.getAttribute("parent", ""));
	}

	refresh(changedTiddlers) {
		const changedAttributes = this.computeAttributes();
		if(Object.keys(changedAttributes).length > 0) {
			this.refreshSelf();
			return true;
		}
		return this.refreshChildren(changedTiddlers);
	}

	allowActionPropagation() {
		return false;
	}

	invokeAction(triggeringWidget, event) {
		this.computeAttributes();
		this.execute();
		if(!this.stateTiddler) {
			return true;
		}
		const stateTid = this.wiki.getTiddler(this.stateTiddler);
		if(!stateTid) {
			return true;
		}
		const rawInput = stateTid.getFieldString(this.fieldAttr).trim();
		if(!rawInput) {
			return true;
		}

		const parsed = parseSmartQuickAddTokens(rawInput, this.wiki);
		const baseTitle = parsed.title || rawInput;
		const newTitle = this.wiki.generateNewTitle(baseTitle);

		// Combine default tags with any explicit project override
		let tagList = $tw.utils.parseStringArray(this.defaultTags || "Inbox todo") || [];
		const explicitProject = stateTid.getFieldString("project").trim() || parsed.project;
		if(explicitProject) {
			// Replace Inbox with explicit project if Inbox was the default target
			tagList = tagList.filter(t => t !== "Inbox");
			if(!tagList.includes(explicitProject)) {
				tagList.unshift(explicitProject);
			}
		}
		if(!tagList.includes("todo")) {
			tagList.push("todo");
		}

		const dueVal = stateTid.getFieldString("due") || parsed.due || undefined;
		const scheduledVal = stateTid.getFieldString("scheduled") || parsed.scheduled || undefined;
		const priorityVal = stateTid.getFieldString("priority") || parsed.priority || undefined;
		const recurVal = stateTid.getFieldString("recur") || undefined;
		const sectionVal = this.defaultSection || stateTid.getFieldString("section") || undefined;
		const statusVal = this.defaultStatus || stateTid.getFieldString("status") || undefined;

		// Combine contexts from state tiddler and inline tokens
		const stateContexts = $tw.utils.parseStringArray(stateTid.getFieldString("context")) || [];
		const allContexts = stateContexts.slice();
		parsed.contexts.forEach(c => {
			if(!allContexts.includes(c)) {
				allContexts.push(c);
			}
		});
		const contextStr = allContexts.length > 0 ? $tw.utils.stringifyList(allContexts) : undefined;

		if(statusVal === "done" && !tagList.includes("done")) {
			tagList.push("done");
		}

		const fields = {
			title: newTitle,
			tags: tagList
		};
		if(dueVal) fields.due = dueVal;
		if(scheduledVal) fields.scheduled = scheduledVal;
		if(priorityVal) fields.priority = priorityVal;
		if(recurVal) fields.recur = recurVal;
		if(sectionVal) fields.section = sectionVal;
		if(statusVal && statusVal !== "todo") fields.status = statusVal;
		if(statusVal === "done") {
			fields.completed = $tw.utils.formatDateString(new Date(), "[UTC]YYYY0MM0DD0hh0mm0ss0XXX");
		}
		if(contextStr) fields.context = contextStr;

		this.wiki.addTiddler(
			new $tw.Tiddler(
				this.wiki.getCreationFields(),
				fields,
				this.wiki.getModificationFields()
			)
		);

		if(this.parentTiddler) {
			const parentTid = this.wiki.getTiddler(this.parentTiddler);
			const parentTags = parentTid ? (parentTid.fields.tags || []).slice() : [];
			if(!parentTags.includes("SubProject") && !parentTags.includes("Project")) {
				parentTags.push("SubProject");
				this.wiki.addTiddler(
					new $tw.Tiddler(
						this.wiki.getCreationFields(),
						parentTid,
						{title: this.parentTiddler, tags: parentTags},
						this.wiki.getModificationFields()
					)
				);
			}
		}

		this.wiki.deleteTiddler(this.stateTiddler);
		$tw.rootWidget.dispatchEvent({type: "tm-auto-save-wiki"});
		return true;
	}
}

class ActionRescheduleOverdueWidget extends Widget {
	render(parent, nextSibling) {
		this.computeAttributes();
		this.execute();
	}

	execute() {
		this.filterAttr = this.getAttribute("$filter", this.getAttribute("filter", "[all[tiddlers]!tag[done]tag[todo]!has[draft.of]!days:due[-1]]"));
	}

	refresh(changedTiddlers) {
		const changedAttributes = this.computeAttributes();
		if(Object.keys(changedAttributes).length > 0) {
			this.refreshSelf();
			return true;
		}
		return this.refreshChildren(changedTiddlers);
	}

	allowActionPropagation() {
		return false;
	}

	invokeAction(triggeringWidget, event) {
		this.computeAttributes();
		this.execute();
		const todayEnd = formatEndOfDay(getToday());
		const overdueTitles = this.wiki.filterTiddlers(this.filterAttr);
		overdueTitles.forEach(title => {
			const existing = this.wiki.getTiddler(title);
			if(existing) {
				this.wiki.addTiddler(
					new $tw.Tiddler(
						this.wiki.getCreationFields(),
						existing,
						{title: title, due: todayEnd},
						this.wiki.getModificationFields()
					)
				);
			}
		});
		if(overdueTitles.length > 0) {
			$tw.rootWidget.dispatchEvent({type: "tm-auto-save-wiki"});
		}
		return true;
	}
}

class QuickInputWidget extends Widget {
	render(parent, nextSibling) {
		this.parentDomNode = parent;
		this.computeAttributes();
		this.execute();

		this.wrapperNode = this.document.createElement("div");
		this.wrapperNode.className = "py-quick-input-wrapper";

		this.listboxId = "py-autocomplete-list-" + Math.random().toString(36).slice(2, 9);

		this.inputNode = this.document.createElement("input");
		this.inputNode.setAttribute("type", "text");
		this.inputNode.setAttribute("autocomplete", "off");
		this.inputNode.setAttribute("enterkeyhint", "done");
		this.inputNode.setAttribute("role", "combobox");
		this.inputNode.setAttribute("aria-autocomplete", "list");
		this.inputNode.setAttribute("aria-expanded", "false");
		this.inputNode.setAttribute("aria-controls", this.listboxId);
		this.inputNode.setAttribute("aria-label", this.ariaLabel || this.placeholder || "Add task");
		this.inputNode.className = this.inputClass;
		if(this.placeholder) {
			this.inputNode.setAttribute("placeholder", this.placeholder);
		}
		this.inputNode.value = this.getFieldValue();

		this.previewNode = this.document.createElement("div");
		this.previewNode.className = "py-smart-token-preview";
		this.previewNode.setAttribute("aria-live", "polite");
		this.previewNode.hidden = true;

		this.menuNode = this.document.createElement("div");
		this.menuNode.id = this.listboxId;
		this.menuNode.className = "py-autocomplete-menu";
		this.menuNode.setAttribute("role", "listbox");
		this.menuNode.hidden = true;

		this.suggestions = [];
		this.activeIndex = 0;
		this.activeTokenInfo = null;

		this.inputNode.addEventListener("input", () => {
			this.saveFieldValue(this.inputNode.value);
			this.updateTokenPreview();
			this.updateSuggestions();
		});
		this.inputNode.addEventListener("click", () => {
			this.updateSuggestions();
		});
		this.inputNode.addEventListener("keydown", (event) => {
			this.handleKeyDown(event);
		});
		this.inputNode.addEventListener("blur", () => {
			setTimeout(() => {
				this.closeMenu();
			}, 150);
		});

		this.wrapperNode.appendChild(this.inputNode);
		this.wrapperNode.appendChild(this.previewNode);
		this.wrapperNode.appendChild(this.menuNode);
		this.updateTokenPreview();
		parent.insertBefore(this.wrapperNode, nextSibling);
		this.domNodes.push(this.wrapperNode);

		if(this.autoFocus === "true" || this.autoFocus === "yes") {
			setTimeout(() => {
				if(this.inputNode && this.inputNode.focus) {
					this.inputNode.focus();
				}
			}, 20);
		}
	}

	execute() {
		this.stateTiddler = this.getAttribute("tiddler", this.getVariable("currentTiddler"));
		this.fieldAttr = this.getAttribute("field", "todo-name");
		this.placeholder = this.getAttribute("placeholder", "");
		this.ariaLabel = this.getAttribute("aria-label", "");
		this.inputClass = this.getAttribute("class", "py-input");
		this.autoFocus = this.getAttribute("focus", "false");
		this.submitActions = this.getAttribute("actions", "");
	}

	refresh(changedTiddlers) {
		const changedAttributes = this.computeAttributes();
		if(
			changedAttributes.tiddler ||
			changedAttributes.field ||
			changedAttributes.placeholder ||
			changedAttributes["class"]
		) {
			this.refreshSelf();
			return true;
		}
		if(this.stateTiddler && changedTiddlers[this.stateTiddler] && this.inputNode) {
			const newVal = this.getFieldValue();
			if(this.inputNode.value !== newVal) {
				this.inputNode.value = newVal;
				this.updateTokenPreview();
				if(!newVal) {
					this.closeMenu();
				}
			}
		}
		return this.refreshChildren(changedTiddlers);
	}

	updateTokenPreview() {
		if(!this.previewNode || !this.inputNode) return;
		const val = (this.inputNode.value || "").trim();
		if(!val) {
			this.previewNode.hidden = true;
			while(this.previewNode.firstChild) {
				this.previewNode.removeChild(this.previewNode.firstChild);
			}
			return;
		}
		const parsed = parseSmartQuickAddTokens(val, this.wiki);
		const pills = [];
		if(parsed.project) {
			pills.push({text: `#${parsed.project}`, cls: "py-token-project"});
		}
		if(parsed.priority) {
			pills.push({text: `!P${parsed.priority}`, cls: `py-token-priority py-priority-${parsed.priority}`});
		}
		if(parsed.due) {
			const dueDt = $tw.utils.parseDate(parsed.due);
			const dateStr = dueDt ? $tw.utils.formatDateString(dueDt, "DD MMM") : "Due";
			pills.push({text: `📅 ${dateStr}`, cls: "py-token-due"});
		}
		if(parsed.scheduled) {
			const schedDt = $tw.utils.parseDate(parsed.scheduled);
			const schedStr = schedDt ? $tw.utils.formatDateString(schedDt, "DD MMM") : "Start";
			pills.push({text: `☀️ ${schedStr}`, cls: "py-token-scheduled"});
		}
		if(Array.isArray(parsed.contexts) && parsed.contexts.length > 0) {
			parsed.contexts.forEach((ctx) => {
				pills.push({text: ctx, cls: "py-token-context"});
			});
		}
		while(this.previewNode.firstChild) {
			this.previewNode.removeChild(this.previewNode.firstChild);
		}
		if(pills.length === 0) {
			this.previewNode.hidden = true;
			return;
		}
		pills.forEach((p) => {
			const span = this.document.createElement("span");
			span.className = "py-token-pill " + p.cls;
			span.textContent = p.text;
			this.previewNode.appendChild(span);
		});
		this.previewNode.hidden = false;
	}

	getFieldValue() {
		if(!this.stateTiddler) return "";
		const tid = this.wiki.getTiddler(this.stateTiddler);
		return tid ? tid.getFieldString(this.fieldAttr) : "";
	}

	saveFieldValue(val) {
		if(!this.stateTiddler) return;
		this.wiki.setText(this.stateTiddler, this.fieldAttr, undefined, val);
	}

	detectActiveToken() {
		if(!this.inputNode) return null;
		const enabled = this.wiki.getTiddlerText("$:/config/projectify/SmartQuickAdd", "yes") !== "no";
		if(!enabled) return null;

		const val = this.inputNode.value || "";
		const cursor = typeof this.inputNode.selectionStart === "number" ? this.inputNode.selectionStart : val.length;
		const before = val.slice(0, cursor);

		// 1. Bracketed project token: #[Partial Project
		const bracketMatch = before.match(/(?:^|\s)(#\[([^\]]*))$/);
		if(bracketMatch) {
			return {
				trigger: "#",
				query: bracketMatch[2],
				start: cursor - bracketMatch[1].length,
				end: cursor
			};
		}

		// 2. Standard token at cursor: #proj, @ctx/date, ~date, !prio
		const tokenMatch = before.match(/(?:^|\s)([#@~!])([^\s#@~!]*)$/);
		if(tokenMatch) {
			const fullToken = tokenMatch[1] + tokenMatch[2];
			return {
				trigger: tokenMatch[1],
				query: tokenMatch[2],
				start: cursor - fullToken.length,
				end: cursor
			};
		}
		return null;
	}

	getSuggestionsForToken(tokenInfo) {
		const q = (tokenInfo.query || "").toLowerCase();
		const items = [];

		if(tokenInfo.trigger === "#") {
			const projects = this.wiki.filterTiddlers("[all[tiddlers]tag[Project]!has[draft.of]!title[Inbox]!tag[done]sort[title]] [all[tiddlers]tag[SubProject]!has[draft.of]!tag[done]sort[title]] +[unique[]]");
			projects.forEach(proj => {
				const tid = this.wiki.getTiddler(proj);
				const isSub = tid && tid.hasTag("SubProject");
				const cat = tid ? tid.getFieldString("category") : "";
				const tokenStr = /\s/.test(proj) ? `#[${proj}]` : `#${proj}`;
				if(!q || proj.toLowerCase().includes(q)) {
					items.push({
						label: proj,
						badge: isSub ? "Sub-project" : (cat || "Project"),
						token: tokenStr,
						prefix: "#"
					});
				}
			});
		} else if(tokenInfo.trigger === "@") {
			const use12h = is12HourTimePreferred(this.wiki);
			const noonBadge = use12h ? "Due today at 12:00 PM" : "Due today at 12:00";
			const dateSuggestions = [
				{label: "@today", badge: "Due today", token: "@today", prefix: "@"},
				{label: "@today@12:00", badge: noonBadge, token: "@today@12:00", prefix: "@"},
				{label: "@tomorrow", badge: "Due tomorrow", token: "@tomorrow", prefix: "@"},
				{label: "@nextweek", badge: "Due next Monday", token: "@nextweek", prefix: "@"}
			];
			dateSuggestions.forEach(d => {
				if(!q || d.label.slice(1).includes(q) || d.badge.toLowerCase().includes(q)) {
					items.push(d);
				}
			});

			if(this.wiki.getTiddlerText("$:/config/projectify/EnableContexts", "yes") !== "no") {
				const contexts = this.wiki.filterTiddlers("[{$:/config/projectify/DefaultContexts}enlist-input[]] [all[tiddlers]tag[todo]!has[draft.of]get[context]enlist-input[]] +[unique[]sort[title]]");
				contexts.forEach(ctx => {
					const cleanCtx = ctx.startsWith("@") ? ctx : `@${ctx}`;
					if(!q || cleanCtx.slice(1).toLowerCase().includes(q)) {
						items.push({
							label: cleanCtx,
							badge: "Context",
							token: cleanCtx,
							prefix: "@"
						});
					}
				});
			}
		} else if(tokenInfo.trigger === "~") {
			const use12h = is12HourTimePreferred(this.wiki);
			const noonSchedBadge = use12h ? "Start today at 12:00 PM" : "Start today at 12:00";
			const schedSuggestions = [
				{label: "~today", badge: "Start today", token: "~today", prefix: "~"},
				{label: "~today@12:00", badge: noonSchedBadge, token: "~today@12:00", prefix: "~"},
				{label: "~tomorrow", badge: "Start tomorrow", token: "~tomorrow", prefix: "~"},
				{label: "~nextweek", badge: "Start next Monday", token: "~nextweek", prefix: "~"}
			];
			schedSuggestions.forEach(s => {
				if(!q || s.label.slice(1).includes(q) || s.badge.toLowerCase().includes(q)) {
					items.push(s);
				}
			});
		} else if(tokenInfo.trigger === "!") {
			const prioSuggestions = [
				{label: "!3", badge: "High priority", token: "!3", prefix: "!"},
				{label: "!2", badge: "Medium priority", token: "!2", prefix: "!"},
				{label: "!1", badge: "Low priority", token: "!1", prefix: "!"}
			];
			prioSuggestions.forEach(p => {
				if(!q || p.label.slice(1).includes(q) || p.badge.toLowerCase().includes(q)) {
					items.push(p);
				}
			});
		}

		return items.slice(0, 20);
	}

	updateSuggestions() {
		const tokenInfo = this.detectActiveToken();
		if(!tokenInfo) {
			this.closeMenu();
			return;
		}
		const matches = this.getSuggestionsForToken(tokenInfo);
		if(matches.length === 0) {
			this.closeMenu();
			return;
		}
		this.activeTokenInfo = tokenInfo;
		this.suggestions = matches;
		if(this.activeIndex >= matches.length) {
			this.activeIndex = 0;
		}
		this.renderMenu();
	}

	renderMenu() {
		if(!this.menuNode) return;
		while(this.menuNode.firstChild) {
			this.menuNode.removeChild(this.menuNode.firstChild);
		}
		let activeEl = null;
		this.suggestions.forEach((item, idx) => {
			const btn = this.document.createElement("button");
			const optId = `${this.listboxId}-opt-${idx}`;
			btn.id = optId;
			btn.setAttribute("type", "button");
			btn.setAttribute("role", "option");
			btn.setAttribute("aria-selected", idx === this.activeIndex ? "true" : "false");
			btn.className = "tc-btn-invisible py-autocomplete-item tc-popup-handle" + (idx === this.activeIndex ? " py-active" : "");
			if(idx === this.activeIndex) {
				activeEl = btn;
			}

			const mainSpan = this.document.createElement("span");
			mainSpan.className = "py-autocomplete-label";

			const prefixSpan = this.document.createElement("span");
			prefixSpan.className = "py-autocomplete-prefix";
			prefixSpan.textContent = item.prefix;
			mainSpan.appendChild(prefixSpan);

			const textSpan = this.document.createElement("span");
			textSpan.textContent = item.label.startsWith(item.prefix) ? item.label.slice(item.prefix.length) : item.label;
			mainSpan.appendChild(textSpan);

			const badgeSpan = this.document.createElement("span");
			badgeSpan.className = "py-autocomplete-badge";
			badgeSpan.textContent = item.badge;

			btn.appendChild(mainSpan);
			btn.appendChild(badgeSpan);

			btn.addEventListener("mousedown", (e) => {
				// Prevent input blur before selection completes
				e.preventDefault();
				this.applySuggestion(item);
			});
			this.menuNode.appendChild(btn);
		});
		this.menuNode.hidden = false;
		if(this.inputNode) {
			this.inputNode.setAttribute("aria-expanded", "true");
			if(activeEl && activeEl.id) {
				this.inputNode.setAttribute("aria-activedescendant", activeEl.id);
			}
		}
		if(activeEl) {
			if(typeof activeEl.scrollIntoView === "function") {
				activeEl.scrollIntoView({block: "nearest"});
			} else {
				const itemTop = activeEl.offsetTop;
				const itemBottom = itemTop + activeEl.offsetHeight;
				if(itemTop < this.menuNode.scrollTop) {
					this.menuNode.scrollTop = itemTop;
				} else if(itemBottom > this.menuNode.scrollTop + this.menuNode.clientHeight) {
					this.menuNode.scrollTop = itemBottom - this.menuNode.clientHeight;
				}
			}
		}
	}

	closeMenu() {
		this.suggestions = [];
		this.activeTokenInfo = null;
		this.activeIndex = 0;
		if(this.menuNode) {
			this.menuNode.hidden = true;
		}
		if(this.inputNode) {
			this.inputNode.setAttribute("aria-expanded", "false");
			this.inputNode.removeAttribute("aria-activedescendant");
		}
	}

	applySuggestion(item) {
		if(!this.inputNode || !this.activeTokenInfo) return;
		const val = this.inputNode.value || "";
		const before = val.slice(0, this.activeTokenInfo.start);
		const after = val.slice(this.activeTokenInfo.end);
		const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
		const replacement = (needsLeadingSpace ? " " : "") + item.token + " ";
		const nextVal = before + replacement + after.replace(/^\s+/, "");
		const nextCursor = (before + replacement).length;

		this.inputNode.value = nextVal;
		this.saveFieldValue(nextVal);
		this.updateTokenPreview();
		this.closeMenu();
		this.inputNode.focus();
		if(this.inputNode.setSelectionRange) {
			this.inputNode.setSelectionRange(nextCursor, nextCursor);
		}
	}

	handleKeyDown(event) {
		// IME composition guard: do not intercept Enter/Tab/Arrow keys while an IME composition session is active
		if(event.isComposing || event.keyCode === 229) {
			return;
		}
		const isMenuOpen = this.menuNode && !this.menuNode.hidden && this.suggestions.length > 0;
		if(isMenuOpen) {
			if(event.key === "ArrowDown") {
				event.preventDefault();
				event.stopPropagation();
				this.activeIndex = (this.activeIndex + 1) % this.suggestions.length;
				this.renderMenu();
				return;
			}
			if(event.key === "ArrowUp") {
				event.preventDefault();
				event.stopPropagation();
				this.activeIndex = (this.activeIndex - 1 + this.suggestions.length) % this.suggestions.length;
				this.renderMenu();
				return;
			}
			if(event.key === "Enter" || event.key === "Tab") {
				event.preventDefault();
				event.stopPropagation();
				const chosen = this.suggestions[this.activeIndex] || this.suggestions[0];
				if(chosen) {
					this.applySuggestion(chosen);
				}
				return;
			}
			if(event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				this.closeMenu();
				return;
			}
		}

		if(event.key === "Enter" && this.submitActions) {
			event.preventDefault();
			event.stopPropagation();
			this.invokeActionString(this.submitActions, this, event);
		}
	}
}

function handleNotificationActionEvent(event) {
	if(!event || !$tw.wiki) {
		return;
	}
	const action = event.action || "default";
	const data = event.data || {};
	const hookData = event.hookData || data.hookData || {};
	const targetTitle = hookData.tiddler || data.tiddlerTitle || data.navigateTo || event.navigateTo || "";

	if((action === "py-complete-todo" || action === "complete") && targetTitle) {
		const existing = $tw.wiki.getTiddler(targetTitle);
		if(!existing) {
			return;
		}
		const currentTags = (existing.fields.tags || []).slice();
		const isCurrentlyDone = currentTags.includes("done");
		if(!isCurrentlyDone) {
			const toggleWidget = new ActionToggleTodoWidget(
				{
					type: "action-py-toggle-todo",
					attributes: {
						$tiddler: {type: "string", value: targetTitle}
					}
				},
				{wiki: $tw.wiki}
			);
			toggleWidget.invokeAction();
		}
		return;
	}

	if((action === "py-snooze-1h" || action === "snooze-1h") && targetTitle) {
		const existing = $tw.wiki.getTiddler(targetTitle);
		const caption = (existing && existing.getFieldString("caption").trim()) || targetTitle;
		if($tw.rootWidget) {
			$tw.rootWidget.dispatchEvent({
				type: "tm-pwa-schedule-notification",
				paramObject: {
					id: `projectify-remind:${targetTitle}`,
					delaySeconds: "3600",
					title: `🔔 ${caption}`,
					body: $tw.wiki.getTiddlerText("$:/language/projectify/Reminder/SnoozedBody", "Snoozed 1-hour reminder"),
					navigateTo: targetTitle,
					scope: "all",
					actions: JSON.stringify([
						{action: "py-complete-todo", title: "Mark Done"},
						{action: "py-snooze-1h", title: "Snooze 1h"}
					])
				}
			});
		}
		return;
	}

	if(action === "py-open-review") {
		$tw.wiki.addTiddler(
			new $tw.Tiddler({
				title: "$:/state/projects-and-schedule",
				text: "$:/plugins/mblackman/projectify/ui/dashboard/Review"
			})
		);
	}
}

function initTouchDragReorderPolyfill() {
	if(typeof document === "undefined" || !document.addEventListener || $tw._projectifyTouchDragInitialized) {
		return;
	}
	$tw._projectifyTouchDragInitialized = true;

	let activeTouch = null;
	let activeMouseBottomDroppable = null;
	let isForwardingBottomDrop = false;

	function getNextSiblingDroppable(itemWrapper) {
		if(!itemWrapper) return null;
		const nextSibling = itemWrapper.nextElementSibling;
		if(!nextSibling) return null;
		if(nextSibling.classList.contains("tc-droppable")) {
			return nextSibling;
		}
		return nextSibling.querySelector(":scope > .tc-droppable") || nextSibling.querySelector(".tc-droppable");
	}

	function resolveSmartDroppableTarget(rawDroppable, clientY) {
		if(!rawDroppable) return null;
		const listContainer = rawDroppable.closest(".tc-tagged-draggable-list, .tc-links-draggable-list");
		if(!listContainer) return rawDroppable;

		const itemWrapper = rawDroppable.closest(".tc-menu-list-item");
		if(itemWrapper && typeof rawDroppable.getBoundingClientRect === "function") {
			const rect = rawDroppable.getBoundingClientRect();
			const midY = rect.top + rect.height * 0.55;
			if(clientY > midY) {
				const nextDroppable = getNextSiblingDroppable(itemWrapper);
				if(nextDroppable) {
					return nextDroppable;
				}
			}
		}
		return rawDroppable;
	}

	function findDroppableTarget(x, y, ghostEl) {
		if(ghostEl) ghostEl.style.display = "none";
		const el = document.elementFromPoint(x, y);
		if(ghostEl) ghostEl.style.display = "";
		if(!el || !el.closest) return null;
		const rawDroppable = el.closest(".tc-droppable");
		return resolveSmartDroppableTarget(rawDroppable, y);
	}

	function clearMouseBottomPreview() {
		if(activeMouseBottomDroppable) {
			activeMouseBottomDroppable.classList.remove("tc-dragover");
			activeMouseBottomDroppable = null;
		}
	}

	document.addEventListener("dragover", (e) => {
		if(isForwardingBottomDrop) return;
		const target = e.target && e.target.closest ? e.target.closest(".tc-menu-list-item > .tc-droppable") : null;
		if(!target || typeof target.getBoundingClientRect !== "function") {
			clearMouseBottomPreview();
			return;
		}
		const itemWrapper = target.closest(".tc-menu-list-item");
		// Only redirect when hovering the bottom half of the LAST item in the list
		if(!itemWrapper || !itemWrapper.nextElementSibling || itemWrapper.nextElementSibling.classList.contains("tc-menu-list-item")) {
			clearMouseBottomPreview();
			return;
		}
		const endDroppable = getNextSiblingDroppable(itemWrapper);
		if(!endDroppable) {
			clearMouseBottomPreview();
			return;
		}
		const rect = target.getBoundingClientRect();
		if(e.clientY > rect.top + rect.height * 0.55) {
			target.classList.remove("tc-dragover");
			endDroppable.classList.add("tc-dragover");
			activeMouseBottomDroppable = endDroppable;
		} else {
			if(activeMouseBottomDroppable === endDroppable) {
				endDroppable.classList.remove("tc-dragover");
				activeMouseBottomDroppable = null;
			}
			target.classList.add("tc-dragover");
		}
	}, true);

	document.addEventListener("drop", (e) => {
		if(isForwardingBottomDrop || !activeMouseBottomDroppable) return;
		const target = e.target && e.target.closest ? e.target.closest(".tc-menu-list-item > .tc-droppable") : null;
		const endDroppable = activeMouseBottomDroppable;
		clearMouseBottomPreview();
		if(target && endDroppable && target !== endDroppable) {
			e.stopPropagation();
			e.preventDefault();
			target.classList.remove("tc-dragover");
			isForwardingBottomDrop = true;
			try {
				let forwardedDrop;
				try {
					forwardedDrop = new DragEvent("drop", {
						bubbles: true,
						cancelable: true,
						dataTransfer: e.dataTransfer
					});
				} catch(_err) {
					forwardedDrop = document.createEvent("Event");
					forwardedDrop.initEvent("drop", true, true);
					forwardedDrop.dataTransfer = e.dataTransfer;
				}
				endDroppable.dispatchEvent(forwardedDrop);
			} finally {
				isForwardingBottomDrop = false;
			}
		}
	}, true);

	document.addEventListener("dragend", () => {
		clearMouseBottomPreview();
	}, true);

	function createSyntheticDragEvent(type, clientX, clientY, title) {
		const jsonStr = $tw.wiki ? $tw.wiki.getTiddlerAsJson(title) : JSON.stringify({title});
		const dataTransfer = {
			dropEffect: "move",
			effectAllowed: "all",
			types: ["text/vnd.tiddler", "text/plain", "Text"],
			getData(format) {
				if(format === "text/vnd.tiddler") return jsonStr;
				if(format === "text/plain" || format === "Text") return title;
				return "";
			},
			setData() {},
			clearData() {}
		};
		let evt;
		try {
			evt = new Event(type, {bubbles: true, cancelable: true});
		} catch(_e) {
			evt = document.createEvent("Event");
			evt.initEvent(type, true, true);
		}
		evt.clientX = clientX;
		evt.clientY = clientY;
		evt.dataTransfer = dataTransfer;
		return evt;
	}

	function cleanupTouchDrag() {
		if(!activeTouch) return;
		if(activeTouch.currentDroppable) {
			const leaveEvt = createSyntheticDragEvent("dragleave", 0, 0, activeTouch.title);
			activeTouch.currentDroppable.dispatchEvent(leaveEvt);
			activeTouch.currentDroppable.classList.remove("tc-dragover");
		}
		if(activeTouch.handleEl) {
			activeTouch.handleEl.classList.remove("tc-dragging");
		}
		if(activeTouch.ghostEl && activeTouch.ghostEl.parentNode) {
			activeTouch.ghostEl.parentNode.removeChild(activeTouch.ghostEl);
		}
		$tw.dragInProgress = null;
		activeTouch = null;
	}

	document.addEventListener("touchstart", (e) => {
		if(e.touches.length !== 1) return;
		const el = e.target && e.target.closest ? e.target.closest(".py-drag-handle, .py-reorder-projects .tc-draggable, .py-reorder-projects a.tc-tiddlylink") : null;
		if(!el) return;
		let title = el.getAttribute("data-tiddler-title") || (el.dataset && el.dataset.tiddlerTitle);
		if(!title && el.tagName === "A" && el.getAttribute("href")) {
			const href = el.getAttribute("href");
			if(href.startsWith("#")) {
				try {
					title = decodeURIComponent(href.slice(1));
				} catch(_err) {
					title = href.slice(1);
				}
			}
		}
		if(!title) return;

		const touch = e.touches[0];
		activeTouch = {
			handleEl: el,
			title: title,
			startX: touch.clientX,
			startY: touch.clientY,
			started: false,
			currentDroppable: null,
			ghostEl: null
		};
	}, {passive: true});

	document.addEventListener("touchmove", (e) => {
		if(!activeTouch || e.touches.length !== 1) return;
		const touch = e.touches[0];
		const dx = touch.clientX - activeTouch.startX;
		const dy = touch.clientY - activeTouch.startY;

		if(!activeTouch.started) {
			if(Math.hypot(dx, dy) < 6) return;
			activeTouch.started = true;
			$tw.dragInProgress = activeTouch.handleEl;
			activeTouch.handleEl.classList.add("tc-dragging");

			const ghost = document.createElement("div");
			ghost.className = "py-touch-drag-ghost";
			const tid = $tw.wiki && $tw.wiki.getTiddler(activeTouch.title);
			ghost.textContent = (tid && tid.fields.caption) ? tid.fields.caption : activeTouch.title;
			document.body.appendChild(ghost);
			activeTouch.ghostEl = ghost;
		}

		if(e.cancelable) {
			e.preventDefault();
		}

		if(activeTouch.ghostEl) {
			activeTouch.ghostEl.style.left = `${touch.clientX + 12}px`;
			activeTouch.ghostEl.style.top = `${touch.clientY - 18}px`;
		}

		const droppable = findDroppableTarget(touch.clientX, touch.clientY, activeTouch.ghostEl);
		if(droppable !== activeTouch.currentDroppable) {
			if(activeTouch.currentDroppable) {
				const leaveEvt = createSyntheticDragEvent("dragleave", touch.clientX, touch.clientY, activeTouch.title);
				activeTouch.currentDroppable.dispatchEvent(leaveEvt);
				activeTouch.currentDroppable.classList.remove("tc-dragover");
			}
			activeTouch.currentDroppable = droppable;
			if(droppable) {
				const enterEvt = createSyntheticDragEvent("dragenter", touch.clientX, touch.clientY, activeTouch.title);
				droppable.dispatchEvent(enterEvt);
			}
		} else if(droppable) {
			const overEvt = createSyntheticDragEvent("dragover", touch.clientX, touch.clientY, activeTouch.title);
			droppable.dispatchEvent(overEvt);
		}
	}, {passive: false});

	document.addEventListener("touchend", (e) => {
		if(!activeTouch) return;
		if(activeTouch.started) {
			const touch = (e.changedTouches && e.changedTouches[0]) || {clientX: activeTouch.startX, clientY: activeTouch.startY};
			const droppable = findDroppableTarget(touch.clientX, touch.clientY, activeTouch.ghostEl) || activeTouch.currentDroppable;
			if(droppable) {
				const dropEvt = createSyntheticDragEvent("drop", touch.clientX, touch.clientY, activeTouch.title);
				droppable.dispatchEvent(dropEvt);
			}
		}
		cleanupTouchDrag();
	}, {passive: true});

	const positionFixedBoardPopup = (domNode) => {
		if(!domNode || !domNode.isConnected || domNode.hasAttribute("hidden")) return;
		let triggerBtn = domNode._pyTriggerBtn;
		if(!triggerBtn || !triggerBtn.isConnected) {
			const prev = domNode.previousElementSibling;
			if(prev && prev.tagName === "BUTTON" && (prev.offsetWidth > 0 || prev.offsetHeight > 0)) {
				triggerBtn = prev;
			} else if(domNode.parentElement) {
				const buttons = Array.from(domNode.parentElement.querySelectorAll("button"));
				triggerBtn = buttons.slice().reverse().find(b => b.offsetWidth > 0 || b.offsetHeight > 0) || buttons[0];
			}
			domNode._pyTriggerBtn = triggerBtn;
		}
		if(!triggerBtn || typeof triggerBtn.getBoundingClientRect !== "function") return;
		const btnRect = triggerBtn.getBoundingClientRect();
		if(btnRect.width === 0 && btnRect.height === 0) return;

		domNode.style.position = "fixed";
		domNode.style.zIndex = "2000";
		domNode.style.inset = "auto";
		domNode.style.margin = "0";
		domNode.style.left = "0px";
		domNode.style.top = "0px";

		const originRect = typeof domNode.getBoundingClientRect === "function"
			? domNode.getBoundingClientRect()
			: {left: 0, top: 0};

		const dropDown = domNode.querySelector(".tc-drop-down") || domNode;
		const popupWidth = Math.max(dropDown.offsetWidth || 0, domNode.offsetWidth || 0, 180);
		const popupHeight = Math.max(dropDown.offsetHeight || 0, domNode.offsetHeight || 0, 80);
		const vw = window.innerWidth || document.documentElement.clientWidth || 390;
		const vh = window.innerHeight || document.documentElement.clientHeight || 844;
		const margin = 10;

		const posMode = domNode._pyPositionMode || (triggerBtn.closest(".py-todo-menu") ? "belowleft" : "below");
		let left = posMode === "belowleft" ? (btnRect.right - popupWidth) : btnRect.left;
		left = Math.max(margin, Math.min(left, vw - popupWidth - margin));

		let top = btnRect.bottom + 4;
		if(top + popupHeight > vh - margin) {
			const aboveTop = btnRect.top - popupHeight - 4;
			if(aboveTop >= margin) {
				top = aboveTop;
			} else {
				top = Math.max(margin, vh - popupHeight - margin);
			}
		}

		domNode.style.left = `${Math.round(left - (originRect.left || 0))}px`;
		domNode.style.top = `${Math.round(top - (originRect.top || 0))}px`;
	};

	const shouldUseFixedViewportPopup = (domNode) => {
		if(!domNode || !domNode.closest) return false;
		if(domNode.closest(".py-board")) return true;
		if(domNode.classList.contains("py-drop-down") || domNode.querySelector(".py-drop-down")) {
			return true;
		}
		return false;
	};

	const repositionOpenBoardPopups = () => {
		document.querySelectorAll(".tc-reveal.tc-popup:not([hidden])").forEach((el) => {
			if(shouldUseFixedViewportPopup(el)) {
				positionFixedBoardPopup(el);
			}
		});
	};

	try {
		const RevealWidget = require("$:/core/modules/widgets/reveal.js").reveal;
		if(RevealWidget && RevealWidget.prototype && !RevealWidget.prototype._pyBoardPopupPatched) {
			const origPositionPopup = RevealWidget.prototype.positionPopup;
			RevealWidget.prototype._pyBoardPopupPatched = true;
			RevealWidget.prototype.positionPopup = function(domNode) {
				if(typeof origPositionPopup === "function") {
					origPositionPopup.call(this, domNode);
				}
				if(shouldUseFixedViewportPopup(domNode)) {
					domNode._pyPositionMode = this.position || "below";
					if($tw.popup && Array.isArray($tw.popup.popups) && $tw.popup.popups.length > 0) {
						const stateTitle = this.stateTitle || this.state;
						const match = $tw.popup.popups.find(p => p && p.title === stateTitle) ||
							$tw.popup.popups[$tw.popup.popups.length - 1];
						if(match && match.domNode) {
							domNode._pyTriggerBtn = match.domNode;
						}
					}
					positionFixedBoardPopup(domNode);
					requestAnimationFrame(() => {
						positionFixedBoardPopup(domNode);
					});
				}
			};
		}
	} catch(_err) {
		// Ignore if core reveal module is unavailable
	}

	const syncBoardActiveStatus = (container, activeStatus, activeIndex) => {
		if(!container) return;
		const switcher = container.querySelector(".py-board-mobile-switcher");
		const board = container.querySelector(".py-board");
		if(switcher) {
			const tabs = Array.from(switcher.querySelectorAll(".py-board-tab"));
			tabs.forEach((tab, i) => {
				const st = tab.getAttribute("data-col-target");
				const isMatch = activeStatus ? st === activeStatus : i === activeIndex;
				tab.classList.toggle("py-active", Boolean(isMatch));
				tab.setAttribute("aria-selected", isMatch ? "true" : "false");
			});
		}
		if(board) {
			const cols = Array.from(board.querySelectorAll(".py-board-column"));
			cols.forEach((col, i) => {
				const st = col.getAttribute("data-col-status");
				const isMatch = activeStatus ? st === activeStatus : i === activeIndex;
				col.classList.toggle("py-board-col-active", Boolean(isMatch));
			});
		}
	};

	document.addEventListener("toggle", (e) => {
		const details = e.target;
		if(!details || details.tagName !== "DETAILS" || !details.classList.contains("py-menu-disclosure")) {
			return;
		}
		if(details.open) {
			const dropDown = details.closest(".py-drop-down");
			if(dropDown) {
				dropDown.querySelectorAll("details.py-menu-disclosure[open]").forEach((sibling) => {
					if(sibling !== details) {
						sibling.removeAttribute("open");
					}
				});
			}
		}
		repositionOpenBoardPopups();
		requestAnimationFrame(() => {
			repositionOpenBoardPopups();
		});
	}, true);

	if(typeof window !== "undefined" && window.addEventListener) {
		window.addEventListener("resize", () => {
			repositionOpenBoardPopups();
		}, {passive: true});
	}

	document.addEventListener("click", (e) => {
		requestAnimationFrame(() => {
			repositionOpenBoardPopups();
		});
		const tabBtn = e.target && e.target.closest ? e.target.closest(".py-board-mobile-switcher .py-board-tab") : null;
		if(!tabBtn) return;
		const switcher = tabBtn.closest(".py-board-mobile-switcher");
		if(!switcher) return;
		const container = switcher.closest(".py-board-container") || switcher.closest(".tc-tiddler-frame, .tc-tiddler-body") || document.body;
		const tabs = Array.from(switcher.querySelectorAll(".py-board-tab"));
		const idx = tabs.indexOf(tabBtn);
		const targetStatus = tabBtn.getAttribute("data-col-target");
		if(idx < 0 && !targetStatus) return;

		syncBoardActiveStatus(container, targetStatus, idx);

		const board = container.querySelector(".py-board");
		if(!board) return;
		const cols = Array.from(board.querySelectorAll(".py-board-column"));
		const targetCol = (targetStatus && board.querySelector(`.py-board-col-${targetStatus}`)) || cols[idx];
		if(!targetCol) return;

		const targetLeft = Math.max(0, targetCol.offsetLeft - (cols[0] ? cols[0].offsetLeft : 0));
		board._pyProgrammaticScrollUntil = Date.now() + 450;
		if(typeof board.scrollTo === "function") {
			try {
				board.scrollTo({left: targetLeft, behavior: "smooth"});
				return;
			} catch(_err) {
				// Fallback to scrollLeft assignment
			}
		}
		board.scrollLeft = targetLeft;
	}, true);

	document.addEventListener("scroll", (e) => {
		if(e.target && e.target.closest && e.target.closest(".tc-drop-down")) return;
		repositionOpenBoardPopups();
		const board = e.target;
		if(!board || !board.classList || !board.classList.contains("py-board")) return;
		if(board._pyProgrammaticScrollUntil && Date.now() < board._pyProgrammaticScrollUntil) return;
		const container = board.closest(".py-board-container") || board.closest(".tc-tiddler-frame, .tc-tiddler-body");
		if(!container) return;
		const cols = Array.from(board.querySelectorAll(".py-board-column"));
		if(cols.length === 0) return;
		const baseOffset = cols[0].offsetLeft || 0;
		const currentScroll = board.scrollLeft;
		let bestIdx = 0;
		let bestDist = Infinity;
		cols.forEach((col, i) => {
			const colLeft = col.offsetLeft - baseOffset;
			const dist = Math.abs(colLeft - currentScroll);
			if(dist < bestDist) {
				bestDist = dist;
				bestIdx = i;
			}
		});
		const bestStatus = cols[bestIdx].getAttribute("data-col-status");
		syncBoardActiveStatus(container, bestStatus, bestIdx);
	}, {capture: true, passive: true});

	document.addEventListener("touchcancel", () => {
		cleanupTouchDrag();
	}, {passive: true});
}

if($tw.browser) {
	initTouchDragReorderPolyfill();
}

if($tw.wiki && !$tw.wiki.tiddlerExists("$:/temp/projectify/LocaleTimeFormat")) {
	$tw.wiki.addTiddler({
		title: "$:/temp/projectify/LocaleTimeFormat",
		text: detectDeviceLocaleUses12Hour() ? "12h" : "24h"
	});
}

if($tw.hooks && typeof $tw.hooks.addHook === "function" && !$tw._projectifyPushHookRegistered) {
	$tw._projectifyPushHookRegistered = true;
	$tw.hooks.addHook("th-pwa-notification-action", handleNotificationActionEvent);
}

exports["py-date-today"] = createQuickDateWidget(getToday, "py-date-today");
exports["py-date-tomorrow"] = createQuickDateWidget(getTomorrow, "py-date-tomorrow");
exports["py-date-next-week"] = createQuickDateWidget(getNextMonday, "py-date-next-week");
exports["py-date-clear"] = createQuickDateWidget(function() { return undefined; }, "py-date-clear");
exports["py-date-calendar"] = CalendarWidget;
exports["py-time-picker"] = TimePickerWidget;
exports["py-quick-input"] = QuickInputWidget;
exports["action-py-toggle-todo"] = ActionToggleTodoWidget;
exports["action-py-quick-add"] = ActionQuickAddTodoWidget;
exports["action-py-reschedule-overdue"] = ActionRescheduleOverdueWidget;
exports["handleNotificationActionEvent"] = handleNotificationActionEvent;

})();
