const path = require("path");
const { TiddlyWiki } = require("tiddlywiki");

const ROOT_DIR = path.resolve(__dirname, "..");

describe("Projectify Plugin ($:/plugins/mblackman/projectify)", () => {
  let $tw;

  beforeAll(() => {
    process.env.TIDDLYWIKI_PLUGIN_PATH = path.join(ROOT_DIR, "plugins");
    $tw = TiddlyWiki();
    $tw.boot.argv = [path.join(ROOT_DIR, "demo")];
    $tw.boot.boot();
    global.$tw = $tw;
    if ($tw.syncer) {
      if ($tw.syncer.pollTimerId) {
        clearInterval($tw.syncer.pollTimerId);
      }
      $tw.syncer.syncadaptor = { isReady: () => false };
    }
  });

  afterAll(() => {
    delete global.$tw;
  });

  function renderWithGlobals(wikitext, currentTiddler = "Dashboard") {
    return $tw.wiki.renderText(
      "text/html",
      "text/vnd.tiddlywiki",
      `\\import [all[tiddlers+shadows]tag[$:/tags/Macro]] [all[tiddlers+shadows]tag[$:/tags/Global]]\n<$tiddler tiddler="${currentTiddler}">\n${wikitext}\n</$tiddler>`
    );
  }

  test("loads plugin manifest with >=5.4.0 core-version", () => {
    const pluginTiddler = $tw.wiki.getTiddler("$:/plugins/mblackman/projectify");
    expect(pluginTiddler).toBeDefined();
    expect(pluginTiddler.fields.name).toBe("Projectify");
    expect(pluginTiddler.fields["core-version"]).toBe(">=5.4.0");
    expect(pluginTiddler.fields.version).toBe("0.21.0");
    expect(pluginTiddler.fields["plugin-type"]).toBe("plugin");
    expect(pluginTiddler.fields.list).toEqual(["readme", "doc/Help", "changelog", "LICENSE"]);
  });

  test("registers all expected shadow tiddlers with corrected dashboard paths", () => {
    const expectedShadows = [
      "$:/plugins/mblackman/projectify/QuickCapture",
      "$:/plugins/mblackman/projectify/quick-capture",
      "$:/plugins/mblackman/projectify/macros/filters",
      "$:/plugins/mblackman/projectify/macros/schedule",
      "$:/plugins/mblackman/projectify/macros/todo-list",
      "$:/plugins/mblackman/projectify/macros/utils",
      "$:/plugins/mblackman/projectify/ui/dashboard/Dashboard",
      "$:/plugins/mblackman/projectify/ui/dashboard/InboxAndProjects",
      "$:/plugins/mblackman/projectify/ui/dashboard/Projects",
      "$:/plugins/mblackman/projectify/ui/dashboard/Today",
      "$:/plugins/mblackman/projectify/ui/dashboard/TodayCount",
      "$:/plugins/mblackman/projectify/ui/dashboard/Upcoming",
      "$:/plugins/mblackman/projectify/ui/dashboard/Matrix",
      "$:/plugins/mblackman/projectify/ui/dashboard/Review",
      "$:/plugins/mblackman/projectify/ui/NextActions",
      "$:/plugins/mblackman/projectify/ui/Everything",
      "$:/plugins/mblackman/projectify/ui/inbox/Inbox",
      "$:/plugins/mblackman/projectify/ui/project/Project",
      "$:/plugins/mblackman/projectify/ui/project/ProjectBoard",
      "$:/plugins/mblackman/projectify/ui/forms/TodoStatus",
      "$:/plugins/mblackman/projectify/ui/forms/TodoContext",
      "$:/plugins/mblackman/projectify/ui/forms/TodoProject",
      "$:/plugins/mblackman/projectify/ui/forms/TodoDelete",
      "$:/plugins/mblackman/projectify/ui/forms/TodoReminder",
      "$:/plugins/mblackman/projectify/ui/config/Notifications",
      "$:/config/projectify/notifications/TodoDueRule",
      "$:/config/projectify/notifications/TodoScheduledRule",
      "$:/plugins/mblackman/projectify/ui/todo/TodoItem",
      "$:/plugins/mblackman/projectify/ui/widgets/date-picker.js",
      "$:/plugins/mblackman/projectify/lib/pikaday.js",
      "$:/plugins/mblackman/projectify/styles/stylesheet",
      "$:/plugins/mblackman/projectify/styles/cards",
      "$:/plugins/mblackman/projectify/styles/form-control",
      "$:/plugins/mblackman/projectify/styles/utils",
    ];

    for (const title of expectedShadows) {
      expect($tw.wiki.isShadowTiddler(title)).toBe(true);
    }

    // Ensure the legacy misspelled "dashbaord" titles no longer exist
    expect($tw.wiki.isShadowTiddler("$:/plugins/mblackman/projectify/ui/dashbaord/Today")).toBe(false);
    expect($tw.wiki.isShadowTiddler("$:/plugins/mblackman/projectify/ui/dashbaord/TodayCount")).toBe(false);
    expect($tw.wiki.isShadowTiddler("$:/plugins/mblackman/projectify/ui/dashbaord/Upcoming")).toBe(false);
  });

  test("stylesheets use TW 5.4 --tpc-* custom properties and contain no stray header lines", () => {
    const stylesheet = $tw.wiki.getTiddler("$:/plugins/mblackman/projectify/styles/stylesheet");
    const cardsStyle = $tw.wiki.getTiddler("$:/plugins/mblackman/projectify/styles/cards");
    const utilsStyle = $tw.wiki.getTiddler("$:/plugins/mblackman/projectify/styles/utils");

    expect(stylesheet.fields.text).toContain("var(--tpc-");
    expect(cardsStyle.fields.text).toContain("display: grid;");
    expect(utilsStyle.fields.text).toContain("var(--tpc-");
    expect(utilsStyle.fields.text).not.toContain("modified:");
  });

  test("evaluates project and todo filters accurately against demo data", () => {
    const activeProjects = renderWithGlobals(
      "<$list filter=<<py-active-projects>>><$text text=<<currentTiddler>>/>|</$list>"
    );
    expect(activeProjects).toContain("Product roadmap|");
    expect(activeProjects).toContain("Book vacation trip|");
    expect(activeProjects).toContain("Reading list|");
    expect(activeProjects).not.toContain("Inbox|");

    const openInboxTodos = renderWithGlobals(
      "<$list filter=<<py-open-todos>>><$text text=<<currentTiddler>>/>|</$list>",
      "Inbox"
    );
    expect(openInboxTodos).toContain("Buy milk|");
    expect(openInboxTodos).toContain("Water plants|");

    const roadmapOpen = renderWithGlobals(
      "<$list filter=<<py-open-todos>>><$text text=<<currentTiddler>>/>|</$list>",
      "Product roadmap"
    );
    expect(roadmapOpen).toContain("Schedule meeting with John|");
    expect(roadmapOpen).not.toContain("Design first prototype|");

    const roadmapCompleted = renderWithGlobals(
      "<$list filter=<<py-completed-todos>>><$text text=<<currentTiddler>>/>|</$list>",
      "Product roadmap"
    );
    expect(roadmapCompleted).toContain("Design first prototype|");
  });

  test("renders Dashboard, Project ViewTemplate, and Scheduled PageControl button without errors", () => {
    const dashboardHtml = renderWithGlobals(
      "{{$:/plugins/mblackman/projectify/ui/dashboard/Dashboard}}"
    );
    expect(dashboardHtml).toContain("tc-tab-set py-tabs");
    expect(dashboardHtml).toContain("Inbox");
    expect(dashboardHtml).toContain("Product roadmap");
    expect(dashboardHtml).toContain("Need help?");

    const projectViewHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/project/Project}}",
      "Product roadmap"
    );
    expect(projectViewHtml).toContain("Schedule meeting with John");
    expect(projectViewHtml).toContain("Archive project");
    expect(projectViewHtml).toContain("1 Completed");

    // Verify fixed <<lingo TodayAndOverdue>> and toolbar icon in Scheduled.tid
    const scheduledBtnHtml = renderWithGlobals(
      "<$let tv-config-toolbar-icons='yes'>{{$:/plugins/mblackman/projectify/ui/buttons/Scheduled}}</$let>"
    );
    expect(scheduledBtnHtml).toContain("py-pill-container");
  });

  test("renders ControlPanel Dashboard config without malformed nested <select>", () => {
    const dashboardConfigHtml = renderWithGlobals(
      "{{$:/plugins/mblackman/projectify/ui/config/Dashboard}}"
    );
    const selectMatches = dashboardConfigHtml.match(/<select/g) || [];
    const closeSelectMatches = dashboardConfigHtml.match(/<\/select>/g) || [];
    expect(selectMatches.length).toBe(2);
    expect(closeSelectMatches.length).toBe(2);
  });

  test("renders EmptyNextActions and EmptyInbox welcome screens with distinct, non-colliding language strings", () => {
    const emptyNextHtml = renderWithGlobals(
      "{{$:/plugins/mblackman/projectify/ui/welcome/EmptyNextActions}}"
    );
    expect(emptyNextHtml).toContain("All clear!");
    expect(emptyNextHtml).toContain("The first task of each active project will appear here");

    // Verify EmptyInboxDescription was not overwritten by EmptyNextActionsTitle!
    expect(
      $tw.wiki.getTiddlerText("$:/language/projectify/EmptyInboxDescription")
    ).toContain("Everything is well organized");
  });

  test("date-picker widgets do not mutate the wiki when rendering against a non-existent temp tiddler", () => {
    const nonExistentTitle = "$:/temp/projectify/test-non-existent-form";
    expect($tw.wiki.getTiddler(nonExistentTitle)).toBeUndefined();

    const html = renderWithGlobals(
      "{{$:/plugins/mblackman/projectify/ui/forms/TodoDueDate}}",
      nonExistentTitle
    );
    expect(html).toContain("py-date-today");
    expect(html).toContain("py-date-tomorrow");
    expect(html).toContain("py-date-next-week");
    expect(html).toContain("py-date-clear");

    // Must NOT have created the tiddler as a side effect of rendering!
    expect($tw.wiki.getTiddler(nonExistentTitle)).toBeUndefined();
  });

  test("pie chart SVG computes valid numeric stroke-dasharray for both empty and non-empty projects", () => {
    const emptyPie = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/images/pie}}",
      "NonExistentEmptyProject"
    );
    expect(emptyPie).toContain('stroke-dasharray="0 31.42"');
    expect(emptyPie).not.toContain("NaN");

    const roadmapPie = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/images/pie}}",
      "Product roadmap"
    );
    expect(roadmapPie).not.toContain("NaN");
    expect(roadmapPie).toMatch(/stroke-dasharray="7\.85\d* 31\.42"/);
  });

  test("action-py-toggle-todo handles multi-status transitions, completion timestamps, and recurring tasks", () => {
    const ToggleWidget = $tw.modules.applyMethods("widget")["action-py-toggle-todo"];

    // 1. Standard task toggle (marks done + stamps completed + sets status=done)
    $tw.wiki.addTiddler({
      title: "TestTaskToggle",
      tags: ["Inbox", "todo"]
    });

    const toggle1 = new ToggleWidget(
      { type: "action-py-toggle-todo", attributes: { $tiddler: { type: "string", value: "TestTaskToggle" } } },
      { wiki: $tw.wiki }
    );
    toggle1.invokeAction();

    let tid = $tw.wiki.getTiddler("TestTaskToggle");
    expect(tid.fields.tags).toContain("done");
    expect(tid.fields.status).toBe("done");
    expect(tid.fields.completed).toBeDefined();

    // 2. Toggle back to open (removes done + clears completed + sets status=todo)
    toggle1.invokeAction();
    tid = $tw.wiki.getTiddler("TestTaskToggle");
    expect(tid.fields.tags).not.toContain("done");
    expect(tid.fields.status).toBe("todo");
    expect(tid.fields.completed).toBeUndefined();

    // 3. Explicit multi-status transition (in-progress, waiting, cancelled)
    const statusInProgress = new ToggleWidget(
      {
        type: "action-py-toggle-todo",
        attributes: {
          $tiddler: { type: "string", value: "TestTaskToggle" },
          $status: { type: "string", value: "in-progress" }
        }
      },
      { wiki: $tw.wiki }
    );
    statusInProgress.invokeAction();
    tid = $tw.wiki.getTiddler("TestTaskToggle");
    expect(tid.fields.status).toBe("in-progress");
    expect(tid.fields.tags).not.toContain("done");

    const statusCancelled = new ToggleWidget(
      {
        type: "action-py-toggle-todo",
        attributes: {
          $tiddler: { type: "string", value: "TestTaskToggle" },
          $status: { type: "string", value: "cancelled" }
        }
      },
      { wiki: $tw.wiki }
    );
    statusCancelled.invokeAction();
    tid = $tw.wiki.getTiddler("TestTaskToggle");
    expect(tid.fields.status).toBe("cancelled");
    expect(tid.fields.tags).toContain("done");
    expect(tid.fields.tags).toContain("cancelled");

    // 4. Recurring task advances due date instead of closing permanently
    $tw.wiki.addTiddler({
      title: "TestRecurringTask",
      tags: ["Inbox", "todo"],
      due: "20261025235959999",
      recur: "weekly"
    });
    const recurToggle = new ToggleWidget(
      { type: "action-py-toggle-todo", attributes: { $tiddler: { type: "string", value: "TestRecurringTask" } } },
      { wiki: $tw.wiki }
    );
    recurToggle.invokeAction();
    const recurTid = $tw.wiki.getTiddler("TestRecurringTask");
    expect(recurTid.fields.tags).not.toContain("done");
    expect(recurTid.fields.status).toBe("todo");
    expect(recurTid.fields["last-completed"]).toBeDefined();
    expect(recurTid.fields.due > "20261025235959999").toBe(true);

    $tw.wiki.deleteTiddler("TestTaskToggle");
    $tw.wiki.deleteTiddler("TestRecurringTask");
  });

  test("action-py-quick-add parses inline smart tokens (!1-!3, @today, #Project, @context)", () => {
    const QuickAddWidget = $tw.modules.applyMethods("widget")["action-py-quick-add"];

    $tw.wiki.addTiddler({
      title: "$:/temp/projectify/test-quick-add",
      "todo-name": "Draft Q4 Architecture Spec !3 @today #[Product roadmap] @work @computer"
    });

    const quickAdd = new QuickAddWidget(
      {
        type: "action-py-quick-add",
        attributes: {
          $state: { type: "string", value: "$:/temp/projectify/test-quick-add" },
          $field: { type: "string", value: "todo-name" },
          $tags: { type: "string", value: "Inbox todo" }
        }
      },
      { wiki: $tw.wiki }
    );
    quickAdd.invokeAction();

    const created = $tw.wiki.getTiddler("Draft Q4 Architecture Spec");
    expect(created).toBeDefined();
    expect(created.fields.priority).toBe("3");
    expect(created.fields.due).toBeDefined();
    expect(created.fields.tags).toContain("Product roadmap");
    expect(created.fields.tags).toContain("todo");
    expect(created.fields.tags).not.toContain("Inbox");
    expect(created.fields.context).toContain("@work");
    expect(created.fields.context).toContain("@computer");
    expect($tw.wiki.getTiddler("$:/temp/projectify/test-quick-add")).toBeUndefined();

    $tw.wiki.deleteTiddler("Draft Q4 Architecture Spec");
  });

  test("py-quick-input provides live autocomplete suggestions for #, @, ~, and ! tokens", () => {
    const QuickInputWidget = $tw.modules.applyMethods("widget")["py-quick-input"];
    expect(QuickInputWidget).toBeDefined();

    const widget = new QuickInputWidget(
      {
        type: "py-quick-input",
        attributes: {
          tiddler: { type: "string", value: "$:/temp/projectify/test-autocomplete" },
          field: { type: "string", value: "todo-name" }
        }
      },
      { wiki: $tw.wiki }
    );
    widget.computeAttributes();
    widget.execute();

    // 1. Project suggestions on #
    const projSuggestions = widget.getSuggestionsForToken({ trigger: "#", query: "prod" });
    expect(projSuggestions.length).toBeGreaterThan(0);
    expect(projSuggestions[0].label).toBe("Product roadmap");
    expect(projSuggestions[0].token).toBe("#[Product roadmap]");

    // 2. Date & Context suggestions on @
    const atSuggestions = widget.getSuggestionsForToken({ trigger: "@", query: "" });
    expect(atSuggestions.some(s => s.token === "@today")).toBe(true);
    expect(atSuggestions.some(s => s.token === "@work")).toBe(true);

    // 3. Start date suggestions on ~
    const tildeSuggestions = widget.getSuggestionsForToken({ trigger: "~", query: "tom" });
    expect(tildeSuggestions.length).toBe(1);
    expect(tildeSuggestions[0].token).toBe("~tomorrow");

    // 4. Priority suggestions on !
    const prioSuggestions = widget.getSuggestionsForToken({ trigger: "!", query: "" });
    expect(prioSuggestions.map(s => s.token)).toEqual(["!3", "!2", "!1"]);
  });

  test("supports recursive sub-project rollups, dependencies (blocked-by), and Kanban / Matrix / Review views", () => {
    // Set up a parent project with a sub-project and a blocked task
    $tw.wiki.addTiddler({ title: "TestScaleProject", tags: ["Project"] });
    $tw.wiki.addTiddler({ title: "Phase 1 Subproject", tags: ["TestScaleProject", "SubProject", "todo"] });
    $tw.wiki.addTiddler({ title: "Subtask 1Done", tags: ["Phase 1 Subproject", "todo", "done"] });
    $tw.wiki.addTiddler({ title: "Subtask 2Open", tags: ["Phase 1 Subproject", "todo"], status: "in-progress" });
    $tw.wiki.addTiddler({
      title: "BlockedTask",
      tags: ["TestScaleProject", "todo"],
      "blocked-by": "[[Subtask 2Open]]"
    });

    // Recursive descendant count: Phase 1 Subproject + Subtask 1Done + Subtask 2Open + BlockedTask = 4 total, 3 open, 1 completed
    const totalCount = renderWithGlobals(
      "<$count filter='[function[py.descendant-todos],[TestScaleProject]]'/>",
      "TestScaleProject"
    );
    expect(totalCount).toContain("4");

    const openCount = renderWithGlobals(
      "<$count filter='[function[py.open-descendant-todos],[TestScaleProject]]'/>",
      "TestScaleProject"
    );
    expect(openCount).toContain("3");

    // BlockedTask should be excluded from py-next-open-todo while Subtask 2Open is open
    // Future-scheduled tasks should also be deferred from py-parallel-open-todos
    $tw.wiki.addTiddler({
      title: "FutureScheduledTask",
      tags: ["TestScaleProject", "todo"],
      scheduled: "20991231235959999"
    });
    $tw.wiki.addTiddler({
      title: "PastScheduledTask",
      tags: ["TestScaleProject", "todo"],
      scheduled: "20200101235959999",
      section: "Phase 1: Research"
    });

    const nextOpen = renderWithGlobals(
      "<$list filter=<<py-parallel-open-todos>>><$text text=<<currentTiddler>>/>|</$list>",
      "TestScaleProject"
    );
    expect(nextOpen).toContain("Phase 1 Subproject|");
    expect(nextOpen).toContain("PastScheduledTask|");
    expect(nextOpen).not.toContain("BlockedTask|");
    expect(nextOpen).not.toContain("FutureScheduledTask|");

    // Project sections render without filter syntax errors
    $tw.wiki.addTiddler({
      title: "TestScaleProject",
      tags: ["Project"],
      sections: "[[Phase 1: Research]]"
    });
    const sectionedHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/project/Project}}",
      "TestScaleProject"
    );
    expect(sectionedHtml).toContain("Phase 1: Research");
    expect(sectionedHtml).toContain("PastScheduledTask");
    expect(sectionedHtml).not.toContain("Filter error");

    // Kanban board view renders all 4 status columns, whole-card draggable, mobile column switcher, and in-column quick add
    $tw.wiki.addTiddler({ title: "TestScaleProject", tags: ["Project"], "project-view": "board" });
    const boardHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/project/Project}}",
      "TestScaleProject"
    );
    expect(boardHtml).toContain("py-board-container");
    expect(boardHtml).toContain("py-board");
    expect(boardHtml).toContain("py-board-mobile-switcher");
    expect(boardHtml).toContain('data-col-target="in-progress"');
    expect(boardHtml).toContain('data-col-status="in-progress"');
    expect(boardHtml).toContain("py-board-card-draggable");
    expect(boardHtml).toContain("py-board-add-trigger");
    expect(boardHtml).toContain("py-board-col-todo");
    expect(boardHtml).toContain("py-board-col-in-progress");
    expect(boardHtml).toContain("py-board-col-waiting");
    expect(boardHtml).toContain("py-board-col-done");
    expect(boardHtml).toContain("py-omnibar");

    // Verify section inline quick-add trigger in List View
    expect(sectionedHtml).toContain("py-section-add-trigger");
    expect(sectionedHtml).toContain("py-omnibar");

    // Verify modernized TodoItem layout: priority chip and subtask 1/2 pill live in .py-todo-actions, keeping .py-todo-title-row clean
    const subProjectItemHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/todo/TodoItem}}",
      "Phase 1 Subproject"
    );
    expect(subProjectItemHtml).toContain("py-subtask-pill");
    expect(subProjectItemHtml).toContain("1/2");

    // Matrix and Review dashboard tabs render cleanly
    const matrixHtml = renderWithGlobals("{{$:/plugins/mblackman/projectify/ui/dashboard/Matrix}}");
    expect(matrixHtml).toContain("py-matrix-grid");
    expect(matrixHtml).toContain("Urgent &amp; Important");

    const reviewHtml = renderWithGlobals("{{$:/plugins/mblackman/projectify/ui/dashboard/Review}}");
    expect(reviewHtml).toContain("py-review-dashboard");
    expect(reviewHtml).toContain("BlockedTask");
    expect(reviewHtml).toContain("Subtask 2Open");

    // TodoHeading renders blocked-by and blocking banners clearly
    const blockedHeadingHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/todo/TodoHeading}}",
      "BlockedTask"
    );
    expect(blockedHeadingHtml).toContain("py-banner-blocked");
    expect(blockedHeadingHtml).toContain("Subtask 2Open");

    const blockerHeadingHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/todo/TodoHeading}}",
      "Subtask 2Open"
    );
    expect(blockerHeadingHtml).toContain("py-banner-blocking");
    expect(blockerHeadingHtml).toContain("BlockedTask");

    $tw.wiki.deleteTiddler("TestScaleProject");
    $tw.wiki.deleteTiddler("Phase 1 Subproject");
    $tw.wiki.deleteTiddler("Subtask 1Done");
    $tw.wiki.deleteTiddler("Subtask 2Open");
    $tw.wiki.deleteTiddler("BlockedTask");
    $tw.wiki.deleteTiddler("FutureScheduledTask");
    $tw.wiki.deleteTiddler("PastScheduledTask");
  });

  test("integrates TiddlyPWA Web Push notification rules (Tier 2), reminders/timers (Tier 3), and action hooks", () => {
    // 1. Verify Tier 2 $:/tags/NotificationRule tiddlers
    const rules = $tw.wiki.filterTiddlers("[all[tiddlers+shadows]tag[$:/tags/NotificationRule]!has[draft.of]]");
    expect(rules).toContain("$:/config/projectify/notifications/TodoDueRule");
    expect(rules).toContain("$:/config/projectify/notifications/TodoScheduledRule");

    const dueRule = $tw.wiki.getTiddler("$:/config/projectify/notifications/TodoDueRule");
    expect(dueRule.fields["rule-id"]).toBe("projectify.todo-due");
    expect(dueRule.fields["date-field"]).toBe("due");
    expect(dueRule.fields["offset-minutes"]).toBe("-719");
    expect(dueRule.fields["default-time"]).toBe("12:00");
    expect(dueRule.fields.enabled).toBe("yes");

    const schedRule = $tw.wiki.getTiddler("$:/config/projectify/notifications/TodoScheduledRule");
    expect(schedRule.fields["rule-id"]).toBe("projectify.todo-scheduled");
    expect(schedRule.fields["offset-minutes"]).toBe("-719");
    expect(schedRule.fields["default-time"]).toBe("12:00");

    const matchedDueTodos = $tw.wiki.filterTiddlers(dueRule.fields.filter);
    expect(matchedDueTodos).toContain("Schedule meeting with John");
    expect(matchedDueTodos).toContain("Book flights");
    expect(matchedDueTodos).not.toContain("Design first prototype");

    const renderedDueTitle = $tw.wiki
      .renderText("text/plain", "text/vnd.tiddlywiki", dueRule.fields["title-template"], {
        variables: { currentTiddler: "Schedule meeting with John" },
      })
      .trim();
    expect(renderedDueTitle).toBe("📋 Schedule meeting with John");

    const renderedDueBody = $tw.wiki
      .renderText("text/plain", "text/vnd.tiddlywiki", dueRule.fields["body-template"], {
        variables: { currentTiddler: "Schedule meeting with John" },
      })
      .trim();
    expect(renderedDueBody).toContain("Product roadmap");
    expect(renderedDueBody).toContain("(P3)");

    // 2. Verify Tier 3 UI in TodoDueDate / TodoReminder, py-time-picker, and Notifications Config
    const dueFormOnExistingHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/forms/TodoDueDate}}",
      "Schedule meeting with John"
    );
    expect(dueFormOnExistingHtml).toContain("py-reminder-section");
    expect(dueFormOnExistingHtml).toContain("py-time-picker-control");
    expect(dueFormOnExistingHtml).toContain("+15m");
    expect(dueFormOnExistingHtml).toContain("🍅 25m");

    const notifConfigHtml = renderWithGlobals(
      "{{$:/plugins/mblackman/projectify/ui/config/Notifications}}"
    );
    expect(notifConfigHtml).toContain("Automatic Due &amp; Start Date Rules");
    expect(notifConfigHtml).toMatch(/12:00(\s+PM)?\s+\(Noon\)/);

    // 2b. Verify Smart Quick-Add with specific times (@today@14:30, ~tomorrow@09:15), py-time-picker, and 12h/24h TimeFormat setting
    const QuickAddWidget = $tw.modules.applyMethods("widget")["action-py-quick-add"];
    $tw.wiki.addTiddler({
      title: "$:/temp/projectify/test-timed-quick-add",
      "todo-name": "Timed Call with Client @today@14:30 ~today@09:15 #Inbox",
    });
    const timedQuickAdd = new QuickAddWidget(
      {
        type: "action-py-quick-add",
        attributes: {
          $state: { type: "string", value: "$:/temp/projectify/test-timed-quick-add" },
          $field: { type: "string", value: "todo-name" },
          $tags: { type: "string", value: "Inbox todo" },
        },
      },
      { wiki: $tw.wiki }
    );
    timedQuickAdd.invokeAction();
    const timedTid = $tw.wiki.getTiddler("Timed Call with Client");
    expect(timedTid).toBeDefined();
    const parsedDue = $tw.utils.parseDate(timedTid.fields.due);
    expect(parsedDue.getHours()).toBe(14);
    expect(parsedDue.getMinutes()).toBe(30);
    const parsedSched = $tw.utils.parseDate(timedTid.fields.scheduled);
    expect(parsedSched.getHours()).toBe(9);
    expect(parsedSched.getMinutes()).toBe(15);

    // 2c. Verify action-py-quick-add supports $status, $section, and recur for Kanban column & Section quick-add
    $tw.wiki.addTiddler({
      title: "$:/temp/projectify/test-board-col-add",
      "todo-name": "In Progress Board Task !2",
      recur: "weekly",
    });
    const boardColAdd = new QuickAddWidget(
      {
        type: "action-py-quick-add",
        attributes: {
          $state: { type: "string", value: "$:/temp/projectify/test-board-col-add" },
          $field: { type: "string", value: "todo-name" },
          $tags: { type: "string", value: "[[Product roadmap]] todo" },
          $status: { type: "string", value: "in-progress" },
          $section: { type: "string", value: "Design" },
        },
      },
      { wiki: $tw.wiki }
    );
    boardColAdd.invokeAction();
    const boardAddedTid = $tw.wiki.getTiddler("In Progress Board Task");
    expect(boardAddedTid).toBeDefined();
    expect(boardAddedTid.fields.status).toBe("in-progress");
    expect(boardAddedTid.fields.section).toBe("Design");
    expect(boardAddedTid.fields.priority).toBe("2");
    expect(boardAddedTid.fields.recur).toBe("weekly");
    $tw.wiki.deleteTiddler("In Progress Board Task");

    // 2d. Verify TodoReminder does not render inside system/temp form state tiddlers
    $tw.wiki.addTiddler({ title: "$:/temp/projectify/test-omnibar-state", "todo-name": "Draft" });
    const tempDueFormHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/forms/TodoDueDate}}",
      "$:/temp/projectify/test-omnibar-state"
    );
    expect(tempDueFormHtml).not.toContain("py-reminder-section");
    $tw.wiki.deleteTiddler("$:/temp/projectify/test-omnibar-state");

    // Test 24h explicit setting
    $tw.wiki.addTiddler({ title: "$:/config/projectify/TimeFormat", text: "24h" });
    const renderedTimedDueBody24 = $tw.wiki
      .renderText("text/plain", "text/vnd.tiddlywiki", dueRule.fields["body-template"], {
        variables: { currentTiddler: "Timed Call with Client" },
      })
      .trim();
    expect(renderedTimedDueBody24).toContain("at 14:30");

    const dueBtnHtml24 = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/buttons/TodoDueDate}}",
      "Timed Call with Client"
    );
    expect(dueBtnHtml24).toContain("14:30");
    const dueFormHtml24 = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/forms/TodoDueDate}}",
      "Timed Call with Client"
    );
    expect(dueFormHtml24).toContain("🌅 09:00");

    // Test 12h explicit setting
    $tw.wiki.addTiddler({ title: "$:/config/projectify/TimeFormat", text: "12h" });
    const renderedTimedDueBody12 = $tw.wiki
      .renderText("text/plain", "text/vnd.tiddlywiki", dueRule.fields["body-template"], {
        variables: { currentTiddler: "Timed Call with Client" },
      })
      .trim();
    expect(renderedTimedDueBody12).toContain("at 2:30 pm");

    const dueBtnHtml12 = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/buttons/TodoDueDate}}",
      "Timed Call with Client"
    );
    expect(dueBtnHtml12).toContain("2:30 pm");
    const dueFormHtml12 = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/forms/TodoDueDate}}",
      "Timed Call with Client"
    );
    expect(dueFormHtml12).toContain("🌅 9 AM");

    // Restore default auto setting
    $tw.wiki.addTiddler({ title: "$:/config/projectify/TimeFormat", text: "auto" });
    $tw.wiki.deleteTiddler("Timed Call with Client");

    // 3. Verify th-pwa-notification-action hook handler (Mark Done, Snooze 1h, Open Review)
    const dispatchedEvents = [];
    const origDispatch = $tw.rootWidget.dispatchEvent.bind($tw.rootWidget);
    $tw.rootWidget.dispatchEvent = (evt) => {
      dispatchedEvents.push(evt);
      return origDispatch(evt);
    };

    try {
      $tw.wiki.addTiddler({
        title: "TestPushActionTask",
        tags: ["Inbox", "todo"],
        caption: "Call Dentist",
      });

      // Test snooze-1h action
      $tw.hooks.invokeHook("th-pwa-notification-action", {
        action: "py-snooze-1h",
        data: { tiddlerTitle: "TestPushActionTask" },
      });
      const snoozeEvt = dispatchedEvents.find(e => e.type === "tm-pwa-schedule-notification");
      expect(snoozeEvt).toBeDefined();
      expect(snoozeEvt.paramObject.id).toBe("projectify-remind:TestPushActionTask");
      expect(snoozeEvt.paramObject.delaySeconds).toBe("3600");
      expect(snoozeEvt.paramObject.title).toBe("🔔 Call Dentist");

      // Test complete action (also cancels pending reminders/timers)
      dispatchedEvents.length = 0;
      $tw.hooks.invokeHook("th-pwa-notification-action", {
        action: "py-complete-todo",
        data: { tiddlerTitle: "TestPushActionTask" },
      });
      const completedTid = $tw.wiki.getTiddler("TestPushActionTask");
      expect(completedTid.fields.tags).toContain("done");
      expect(completedTid.fields.status).toBe("done");
      expect(
        dispatchedEvents.some(
          e => e.type === "tm-pwa-cancel-notification" && e.paramObject?.id === "projectify-remind:TestPushActionTask"
        )
      ).toBe(true);

      // Test open-review action
      $tw.hooks.invokeHook("th-pwa-notification-action", {
        action: "py-open-review",
        data: { navigateTo: "Dashboard" },
      });
      expect($tw.wiki.getTiddlerText("$:/state/projects-and-schedule")).toBe(
        "$:/plugins/mblackman/projectify/ui/dashboard/Review"
      );
    } finally {
      $tw.rootWidget.dispatchEvent = origDispatch;
      $tw.wiki.deleteTiddler("TestPushActionTask");
      $tw.wiki.deleteTiddler("$:/state/projects-and-schedule");
    }
  });

  test("preserves task list order when reordering tasks with varying priorities and renders project card descriptions as plain text", () => {
    // 1. Create a test project with 3 unscheduled tasks of different priorities
    $tw.wiki.addTiddler({
      title: "TestReorderProject",
      tags: ["Project"],
      description: "Card description with WikiWord and [[link]] that should render as plain text",
      list: ["Task Low", "Task High", "Task Medium"],
    });
    $tw.wiki.addTiddler({ title: "Task Low", tags: ["TestReorderProject", "todo"], priority: "1" });
    $tw.wiki.addTiddler({ title: "Task High", tags: ["TestReorderProject", "todo"], priority: "3" });
    $tw.wiki.addTiddler({ title: "Task Medium", tags: ["TestReorderProject", "todo"], priority: "2" });

    // Verify todo-list-filtered respects the project's list field order instead of overriding with !nsort[priority]
    const initialOrder = renderWithGlobals(
      "<$transclude $variable='todo-list-filtered' subFilter=<<py-unscheduled-todos-subfilter>>/>",
      "TestReorderProject"
    );
    const lowIdx = initialOrder.indexOf("Task Low");
    const highIdx = initialOrder.indexOf("Task High");
    const medIdx = initialOrder.indexOf("Task Medium");
    expect(lowIdx).toBeGreaterThan(-1);
    expect(lowIdx).toBeLessThan(highIdx);
    expect(highIdx).toBeLessThan(medIdx);

    // 2. Simulate todo-list-drop-actions moving "Task Medium" before "Task Low"
    const container = $tw.fakeDocument.createElement("div");
    const widgetNode = $tw.wiki.makeTranscludeWidget(undefined, {
      document: $tw.fakeDocument,
      parseAsInline: false,
      variables: {
        currentTiddler: "Task Low",
        actionTiddler: "Task Medium",
      },
      importPageMacros: true,
    });
    // Invoke todo-list-drop-actions via a temporary button trigger
    const dropTestWikitext = `\\import [all[tiddlers+shadows]tag[$:/tags/Macro]] [all[tiddlers+shadows]tag[$:/tags/Global]]\n<$let currentTiddler="Task Low" actionTiddler="Task Medium">\n<$button id="drop-btn"><$transclude $variable="todo-list-drop-actions" tag="TestReorderProject"/></$button>\n</$let>`;
    const parser = $tw.wiki.parseText("text/vnd.tiddlywiki", dropTestWikitext);
    const widgetTree = $tw.wiki.makeWidget(parser, { document: $tw.fakeDocument });
    widgetTree.render(container, null);
    // Find button widget and invoke actions
    function findButton(w) {
      if (w.parseTreeNode && w.parseTreeNode.type === "button") return w;
      for (const child of w.children || []) {
        const found = findButton(child);
        if (found) return found;
      }
      return null;
    }
    const btnWidget = findButton(widgetTree);
    expect(btnWidget).not.toBeNull();
    btnWidget.invokeActions(btnWidget, {});

    const updatedProj = $tw.wiki.getTiddler("TestReorderProject");
    expect(Array.from(updatedProj.fields.list)).toEqual(["Task Medium", "Task Low", "Task High"]);

    // 2b. Simulate dropping onto the trailing end-of-list dropzone (currentTiddler="") to move "Task Medium" to the last position
    const dropEndWikitext = `\\import [all[tiddlers+shadows]tag[$:/tags/Macro]] [all[tiddlers+shadows]tag[$:/tags/Global]]\n<$let currentTiddler="" actionTiddler="Task Medium">\n<$button id="drop-end-btn"><$transclude $variable="todo-list-drop-actions" tag="TestReorderProject"/></$button>\n</$let>`;
    const endParser = $tw.wiki.parseText("text/vnd.tiddlywiki", dropEndWikitext);
    const endWidgetTree = $tw.wiki.makeWidget(endParser, { document: $tw.fakeDocument });
    const endContainer = $tw.fakeDocument.createElement("div");
    endWidgetTree.render(endContainer, null);
    const endBtnWidget = findButton(endWidgetTree);
    expect(endBtnWidget).not.toBeNull();
    endBtnWidget.invokeActions(endBtnWidget, {});

    const endUpdatedProj = $tw.wiki.getTiddler("TestReorderProject");
    expect(Array.from(endUpdatedProj.fields.list)).toEqual(["Task Low", "Task High", "Task Medium"]);
    expect(initialOrder).toContain("py-list-end-dropzone");

    // 2c. Simulate Kanban board-card-drop-actions (dropping "Task Medium" onto "Task Low" in "in-progress" column)
    const boardDropWikitext = `\\import [all[tiddlers+shadows]tag[$:/tags/Macro]] [all[tiddlers+shadows]tag[$:/tags/Global]] [[$:/plugins/mblackman/projectify/ui/project/ProjectBoard]]\n<$let projectTag="TestReorderProject" actionTiddler="Task Medium">\n<$button id="board-card-drop-btn"><$transclude $variable="board-card-drop-actions" targetStatus="in-progress" targetCard="Task Low"/></$button>\n</$let>`;
    const boardDropParser = $tw.wiki.parseText("text/vnd.tiddlywiki", boardDropWikitext);
    const boardDropTree = $tw.wiki.makeWidget(boardDropParser, { document: $tw.fakeDocument });
    const boardDropContainer = $tw.fakeDocument.createElement("div");
    boardDropTree.render(boardDropContainer, null);
    const boardDropBtn = findButton(boardDropTree);
    expect(boardDropBtn).not.toBeNull();
    boardDropBtn.invokeActions(boardDropBtn, {});

    const boardUpdatedProj = $tw.wiki.getTiddler("TestReorderProject");
    expect(Array.from(boardUpdatedProj.fields.list)).toEqual(["Task Medium", "Task Low", "Task High"]);
    const movedMedium = $tw.wiki.getTiddler("Task Medium");
    expect(movedMedium.fields.status).toBe("in-progress");
    expect(movedMedium.fields.tags).toContain("TestReorderProject");
    expect(movedMedium.fields.tags).not.toContain("Task Low");

    // 3. Verify ProjectCard renders description as plain text without nested <a> tags inside <a class="py-card">
    const cardHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/dashboard/ProjectCard}}",
      "TestReorderProject"
    );
    expect(cardHtml).toContain("Card description with WikiWord");
    // Should only have 1 <a> tag in ProjectCard (the outer <a class="py-card">, no nested WikiWord/link <a> tags inside description)
    const anchorMatches = cardHtml.match(/<a /g) || [];
    expect(anchorMatches.length).toBe(1);

    // 4. Verify checkbox CSS and card CSS include mobile sizing and legibility fixes
    const formControlCss = $tw.wiki.getTiddlerText("$:/plugins/mblackman/projectify/styles/form-control");
    expect(formControlCss).toContain(".tc-tiddler-frame .py-checkbox svg");
    expect(formControlCss).toContain("max-width: none;");

    const cardsCss = $tw.wiki.getTiddlerText("$:/plugins/mblackman/projectify/styles/cards");
    expect(cardsCss).toContain("a.py-card");
    expect(cardsCss).toContain("-webkit-line-clamp: 3;");

    $tw.wiki.deleteTiddler("TestReorderProject");
    $tw.wiki.deleteTiddler("Task Low");
    $tw.wiki.deleteTiddler("Task High");
    $tw.wiki.deleteTiddler("Task Medium");
  });

  test("renders streamlined TodoActions and TodoDueDate dropdown menus with mutually exclusive <details name> disclosures and labeled priorities", () => {
    const dueFormHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/forms/TodoDueDate}}",
      "Schedule meeting with John"
    );
    // Standalone TodoDueDate has 2 mutually exclusive <details> (Calendar open by default, Time/Repeat closed)
    const standaloneDetails = dueFormHtml.match(/<details [^>]*class="py-menu-disclosure[^"]*"[^>]*>/g) || [];
    expect(standaloneDetails.length).toBe(2);
    expect(standaloneDetails[0]).toContain("open");
    expect(standaloneDetails[0]).toContain('name="');
    expect(standaloneDetails[1]).not.toContain("open");

    // Verify unified time picker (presets, -15m/+15m steppers, native <input type="time">) and recurrence chips
    expect(dueFormHtml).toContain('type="time"');
    expect(dueFormHtml).toContain("py-time-input");
    expect(dueFormHtml).toContain("py-time-step-btn");
    expect(dueFormHtml).toContain("−15m");
    expect(dueFormHtml).toContain("+15m");
    expect(dueFormHtml).toContain("py-recur-chips");
    expect(dueFormHtml).toContain("Weekdays");

    // Verify stepTimeByMinutes helper on TimePickerWidget
    const TimePickerWidget = $tw.modules.applyMethods("widget")["py-time-picker"];
    const tpInstance = new TimePickerWidget(
      {
        type: "py-time-picker",
        attributes: {
          tiddler: { type: "string", value: "Schedule meeting with John" },
          field: { type: "string", value: "due" }
        }
      },
      { wiki: $tw.wiki }
    );
    tpInstance.computeAttributes();
    tpInstance.execute();
    tpInstance.setSpecificTime("14:50");
    tpInstance.stepTimeByMinutes(15);
    expect(tpInstance.getCurrentTimeString()).toBe("15:05");
    tpInstance.setSpecificTime("");
    expect(tpInstance.getCurrentTimeString()).toBe("");

    // Compact TodoActions menu renders 3 mutually exclusive <details> with the same name attribute, all closed by default
    const compactMenuHtml = renderWithGlobals(
      `<$let disclosureGroup="shared-menu-acc" compactCalendar="yes">{{||$:/plugins/mblackman/projectify/ui/forms/TodoPriority}}{{||$:/plugins/mblackman/projectify/ui/forms/TodoDueDate}}<details class="py-menu-disclosure tc-popup-handle" name=<<disclosureGroup>>><summary>Context</summary></details></$let>`,
      "Schedule meeting with John"
    );
    expect(compactMenuHtml).toContain('<span class="py-priority-label">P3</span>');
    expect(compactMenuHtml).toContain('<span class="py-priority-label">P2</span>');
    expect(compactMenuHtml).toContain('<span class="py-priority-label">P1</span>');

    const compactDetails = compactMenuHtml.match(/<details [^>]*name="shared-menu-acc"[^>]*>/g) || [];
    expect(compactDetails.length).toBe(3);
    compactDetails.forEach((tag) => {
      expect(tag).not.toContain("open");
    });

    const stylesheetText = $tw.wiki.getTiddlerText("$:/plugins/mblackman/projectify/styles/stylesheet");
    const datePickerCss = $tw.wiki.getTiddlerText("$:/plugins/mblackman/projectify/styles/date-picker");
    expect(stylesheetText).toContain("overflow-x: hidden;");
    expect(datePickerCss).toContain("table-layout: fixed;");
  });

  test("enforces ARIA combobox/toggle semantics, IME-safe Enter submit, live smart token preview, temp locale status, and one-click project refiling", () => {
    // 1. Startup locale time status uses $:/temp/ so it does not dirty the wiki saver
    expect($tw.wiki.tiddlerExists("$:/temp/projectify/LocaleTimeFormat")).toBe(true);
    expect($tw.wiki.tiddlerExists("$:/status/projectify/LocaleTimeFormat")).toBe(false);

    // 2. TodoItem checkbox, TodoStatus, and TodoPriority expose aria-pressed and aria-label
    const todoItemHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/todo/TodoItem}}",
      "Schedule meeting with John"
    );
    expect(todoItemHtml).toContain('aria-label="Toggle Schedule meeting with John"');
    expect(todoItemHtml).toContain('aria-pressed="false"');

    const statusFormHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/forms/TodoStatus}}",
      "Schedule meeting with John"
    );
    expect(statusFormHtml).toContain('aria-pressed="true"');
    expect(statusFormHtml).toContain('aria-pressed="false"');

    // 3. QuickInputWidget renders combobox ARIA attributes, live smart token preview, and guards IME composition on Enter
    const QuickInputWidget = $tw.modules.applyMethods("widget")["py-quick-input"];
    $tw.wiki.addTiddler({
      title: "$:/temp/projectify/test-ime-input",
      "todo-name": "Ship v1.0 !3 @today #Inbox @work"
    });
    let submitted = false;
    const widget = new QuickInputWidget(
      {
        type: "py-quick-input",
        attributes: {
          tiddler: { type: "string", value: "$:/temp/projectify/test-ime-input" },
          field: { type: "string", value: "todo-name" },
          actions: { type: "string", value: "<$action-setfield $tiddler='$:/temp/projectify/test-ime-submitted' text='yes'/>" }
        }
      },
      { wiki: $tw.wiki, document: $tw.fakeDocument }
    );
    const parent = $tw.fakeDocument.createElement("div");
    widget.render(parent, null);

    expect(widget.inputNode.getAttribute("role")).toBe("combobox");
    expect(widget.inputNode.getAttribute("aria-autocomplete")).toBe("list");
    expect(widget.inputNode.getAttribute("aria-expanded")).toBe("false");
    expect(widget.inputNode.getAttribute("enterkeyhint")).toBe("done");
    expect(widget.previewNode.hidden).toBe(false);
    expect(widget.previewNode.children.length).toBeGreaterThanOrEqual(4);

    // IME composing Enter must NOT trigger submitActions
    widget.handleKeyDown({
      key: "Enter",
      isComposing: true,
      preventDefault: () => { submitted = true; },
      stopPropagation: () => {}
    });
    expect(submitted).toBe(false);
    expect($tw.wiki.getTiddler("$:/temp/projectify/test-ime-submitted")).toBeUndefined();

    // Non-composing Enter triggers submitActions
    widget.handleKeyDown({
      key: "Enter",
      isComposing: false,
      preventDefault: () => { submitted = true; },
      stopPropagation: () => {}
    });
    expect(submitted).toBe(true);
    expect($tw.wiki.getTiddlerText("$:/temp/projectify/test-ime-submitted")).toBe("yes");

    // 4. TodoProject form refiles a task from Inbox to a Project without side effects on render
    const refileHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/forms/TodoProject}}",
      "Buy milk"
    );
    expect(refileHtml).toContain("py-project-refile-inline");
    expect(refileHtml).toContain("Product roadmap");

    $tw.wiki.deleteTiddler("$:/temp/projectify/test-ime-input");
    $tw.wiki.deleteTiddler("$:/temp/projectify/test-ime-submitted");
  });

  test("renders Delete task action in TodoActions and TodoHeading dropdowns and cleans up references on action-py-delete-todo", () => {
    const deleteFormHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/forms/TodoDelete}}",
      "Schedule meeting with John"
    );
    expect(deleteFormHtml).toContain("py-menu-action-danger");
    expect(deleteFormHtml).toContain("Delete task");

    const todoActionsTiddler = $tw.wiki.getTiddlerText("$:/plugins/mblackman/projectify/ui/buttons/TodoActions");
    const todoHeadingTiddler = $tw.wiki.getTiddlerText("$:/plugins/mblackman/projectify/ui/todo/TodoHeading");
    expect(todoActionsTiddler).toContain("$:/plugins/mblackman/projectify/ui/forms/TodoDelete");
    expect(todoHeadingTiddler).toContain("$:/plugins/mblackman/projectify/ui/forms/TodoDelete");

    // Set up a recurring task inside a project that also blocks another task
    $tw.wiki.addTiddler({
      title: "DeleteCleanupProject",
      tags: ["Project"],
      list: ["RecurringToRemove", "DependentTask"]
    });
    $tw.wiki.addTiddler({
      title: "RecurringToRemove",
      tags: ["DeleteCleanupProject", "todo"],
      due: "20261030235959999",
      recur: "daily"
    });
    $tw.wiki.addTiddler({
      title: "DependentTask",
      tags: ["DeleteCleanupProject", "todo"],
      "blocked-by": "[[RecurringToRemove]]"
    });

    const DeleteWidget = $tw.modules.applyMethods("widget")["action-py-delete-todo"];
    expect(DeleteWidget).toBeDefined();

    const dispatchedEvents = [];
    const origDispatch = $tw.rootWidget.dispatchEvent.bind($tw.rootWidget);
    $tw.rootWidget.dispatchEvent = (evt) => {
      dispatchedEvents.push(evt);
      return origDispatch(evt);
    };

    try {
      const deleteAction = new DeleteWidget(
        {
          type: "action-py-delete-todo",
          attributes: { $tiddler: { type: "string", value: "RecurringToRemove" } }
        },
        { wiki: $tw.wiki }
      );
      deleteAction.invokeAction();

      expect($tw.wiki.getTiddler("RecurringToRemove")).toBeUndefined();
      const updatedProj = $tw.wiki.getTiddler("DeleteCleanupProject");
      expect(Array.from(updatedProj.fields.list)).toEqual(["DependentTask"]);
      const updatedDep = $tw.wiki.getTiddler("DependentTask");
      expect(updatedDep.fields["blocked-by"]).toBeUndefined();
      expect(
        dispatchedEvents.some(
          (e) => e.type === "tm-pwa-cancel-notification" && e.paramObject?.id === "projectify-remind:RecurringToRemove"
        )
      ).toBe(true);
      expect(
        dispatchedEvents.some(
          (e) => e.type === "tm-close-tiddler" && e.param === "RecurringToRemove"
        )
      ).toBe(true);
    } finally {
      $tw.rootWidget.dispatchEvent = origDispatch;
      $tw.wiki.deleteTiddler("DeleteCleanupProject");
      $tw.wiki.deleteTiddler("RecurringToRemove");
      $tw.wiki.deleteTiddler("DependentTask");
    }
  });
});
