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

exports["py-date-today"] = createQuickDateWidget(getToday, "py-date-today");
exports["py-date-tomorrow"] = createQuickDateWidget(getTomorrow, "py-date-tomorrow");
exports["py-date-next-week"] = createQuickDateWidget(getNextMonday, "py-date-next-week");
exports["py-date-clear"] = createQuickDateWidget(function() { return undefined; }, "py-date-clear");
exports["py-date-calendar"] = CalendarWidget;

})();
