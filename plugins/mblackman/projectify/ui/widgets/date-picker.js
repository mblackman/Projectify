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

function formatEndOfDay(date) {
	const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
	return $tw.utils.formatDateString(endOfDay, "[UTC]YYYY0MM0DD0hh0mm0ss0XXX");
}

function computeNextOccurrenceDate(baseDate, recurRule) {
	const today = getToday();
	const start = (baseDate && !Number.isNaN(baseDate.getTime()) && baseDate > today) ? new Date(baseDate) : new Date(today);
	const next = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
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

	// Parse due date tokens: @today, @tomorrow, @nextweek, @YYYY-MM-DD
	text = text.replace(/(?:^|\s)@(today|tomorrow|nextweek|\d{4}-\d{2}-\d{2})(?=\s|$)/gi, (match, token) => {
		const lower = token.toLowerCase();
		if(lower === "today") {
			result.due = formatEndOfDay(getToday());
		} else if(lower === "tomorrow") {
			result.due = formatEndOfDay(getTomorrow());
		} else if(lower === "nextweek") {
			result.due = formatEndOfDay(getNextMonday());
		} else {
			const parts = token.split("-");
			const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
			if(!Number.isNaN(dt.getTime())) {
				result.due = formatEndOfDay(dt);
			}
		}
		return " ";
	});

	// Parse start/scheduled tokens: ~today, ~tomorrow, ~nextweek, ~YYYY-MM-DD
	text = text.replace(/(?:^|\s)~(today|tomorrow|nextweek|\d{4}-\d{2}-\d{2})(?=\s|$)/gi, (match, token) => {
		const lower = token.toLowerCase();
		if(lower === "today") {
			result.scheduled = formatEndOfDay(getToday());
		} else if(lower === "tomorrow") {
			result.scheduled = formatEndOfDay(getTomorrow());
		} else if(lower === "nextweek") {
			result.scheduled = formatEndOfDay(getNextMonday());
		} else {
			const parts = token.split("-");
			const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
			if(!Number.isNaN(dt.getTime())) {
				result.scheduled = formatEndOfDay(dt);
			}
		}
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
		const updateFields = {
			title: this.title,
			[this.field]: date ? this.endOfDate(date) : undefined
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
			$tw.rootWidget.dispatchEvent({type: "tm-auto-save-wiki"});
			return true;
		}

		// Standard toggle behavior (with recurring task support)
		if(!isCurrentlyDone && recurRule) {
			const currentDue = existing.getFieldString("due") ? $tw.utils.parseDate(existing.getFieldString("due")) : undefined;
			const nextDueDate = computeNextOccurrenceDate(currentDue, recurRule);
			const updateFields = {
				title: title,
				due: formatEndOfDay(nextDueDate),
				"last-completed": nowStamp,
				status: "todo"
			};
			if(existing.getFieldString("scheduled")) {
				const currentSched = $tw.utils.parseDate(existing.getFieldString("scheduled"));
				const nextSchedDate = computeNextOccurrenceDate(currentSched, recurRule);
				updateFields.scheduled = formatEndOfDay(nextSchedDate);
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
		const sectionVal = this.defaultSection || stateTid.getFieldString("section") || undefined;

		// Combine contexts from state tiddler and inline tokens
		const stateContexts = $tw.utils.parseStringArray(stateTid.getFieldString("context")) || [];
		const allContexts = stateContexts.slice();
		parsed.contexts.forEach(c => {
			if(!allContexts.includes(c)) {
				allContexts.push(c);
			}
		});
		const contextStr = allContexts.length > 0 ? $tw.utils.stringifyList(allContexts) : undefined;

		const fields = {
			title: newTitle,
			tags: tagList
		};
		if(dueVal) fields.due = dueVal;
		if(scheduledVal) fields.scheduled = scheduledVal;
		if(priorityVal) fields.priority = priorityVal;
		if(sectionVal) fields.section = sectionVal;
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

		this.inputNode = this.document.createElement("input");
		this.inputNode.setAttribute("type", "text");
		this.inputNode.setAttribute("autocomplete", "off");
		this.inputNode.className = this.inputClass;
		if(this.placeholder) {
			this.inputNode.setAttribute("placeholder", this.placeholder);
		}
		this.inputNode.value = this.getFieldValue();

		this.menuNode = this.document.createElement("div");
		this.menuNode.className = "py-autocomplete-menu";
		this.menuNode.setAttribute("role", "listbox");
		this.menuNode.hidden = true;

		this.suggestions = [];
		this.activeIndex = 0;
		this.activeTokenInfo = null;

		this.inputNode.addEventListener("input", () => {
			this.saveFieldValue(this.inputNode.value);
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
		this.wrapperNode.appendChild(this.menuNode);
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
				if(!newVal) {
					this.closeMenu();
				}
			}
		}
		return this.refreshChildren(changedTiddlers);
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
			const dateSuggestions = [
				{label: "@today", badge: "Due today", token: "@today", prefix: "@"},
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
			const schedSuggestions = [
				{label: "~today", badge: "Start today", token: "~today", prefix: "~"},
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
			btn.setAttribute("type", "button");
			btn.setAttribute("role", "option");
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
		this.closeMenu();
		this.inputNode.focus();
		if(this.inputNode.setSelectionRange) {
			this.inputNode.setSelectionRange(nextCursor, nextCursor);
		}
	}

	handleKeyDown(event) {
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

exports["py-date-today"] = createQuickDateWidget(getToday, "py-date-today");
exports["py-date-tomorrow"] = createQuickDateWidget(getTomorrow, "py-date-tomorrow");
exports["py-date-next-week"] = createQuickDateWidget(getNextMonday, "py-date-next-week");
exports["py-date-clear"] = createQuickDateWidget(function() { return undefined; }, "py-date-clear");
exports["py-date-calendar"] = CalendarWidget;
exports["py-quick-input"] = QuickInputWidget;
exports["action-py-toggle-todo"] = ActionToggleTodoWidget;
exports["action-py-quick-add"] = ActionQuickAddTodoWidget;
exports["action-py-reschedule-overdue"] = ActionRescheduleOverdueWidget;

})();
