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
    expect(pluginTiddler.fields.version).toBe("0.15.0");
    expect(pluginTiddler.fields["plugin-type"]).toBe("plugin");
    expect(pluginTiddler.fields.list).toEqual(["doc/Help", "changelog", "LICENSE"]);
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

    // Kanban board view renders all 4 status columns
    $tw.wiki.addTiddler({ title: "TestScaleProject", tags: ["Project"], "project-view": "board" });
    const boardHtml = renderWithGlobals(
      "{{||$:/plugins/mblackman/projectify/ui/project/Project}}",
      "TestScaleProject"
    );
    expect(boardHtml).toContain("py-board");
    expect(boardHtml).toContain("py-board-col-todo");
    expect(boardHtml).toContain("py-board-col-in-progress");
    expect(boardHtml).toContain("py-board-col-waiting");
    expect(boardHtml).toContain("py-board-col-done");

    // Matrix and Review dashboard tabs render cleanly
    const matrixHtml = renderWithGlobals("{{$:/plugins/mblackman/projectify/ui/dashboard/Matrix}}");
    expect(matrixHtml).toContain("py-matrix-grid");
    expect(matrixHtml).toContain("Urgent &amp; Important");

    const reviewHtml = renderWithGlobals("{{$:/plugins/mblackman/projectify/ui/dashboard/Review}}");
    expect(reviewHtml).toContain("py-review-dashboard");
    expect(reviewHtml).toContain("BlockedTask");

    $tw.wiki.deleteTiddler("TestScaleProject");
    $tw.wiki.deleteTiddler("Phase 1 Subproject");
    $tw.wiki.deleteTiddler("Subtask 1Done");
    $tw.wiki.deleteTiddler("Subtask 2Open");
    $tw.wiki.deleteTiddler("BlockedTask");
    $tw.wiki.deleteTiddler("FutureScheduledTask");
    $tw.wiki.deleteTiddler("PastScheduledTask");
  });
});
