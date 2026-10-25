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
      "$:/plugins/mblackman/projectify/ui/NextActions",
      "$:/plugins/mblackman/projectify/ui/Everything",
      "$:/plugins/mblackman/projectify/ui/inbox/Inbox",
      "$:/plugins/mblackman/projectify/ui/project/Project",
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
});
