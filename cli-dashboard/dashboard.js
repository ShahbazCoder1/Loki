import blessed from "blessed";
import contrib from "blessed-contrib";
import { EventSource } from "eventsource";

const SERVER_URL =
    process.env.ULPF_SERVER_URL || "http://localhost:3000";

const screen = blessed.screen({
    smartCSR: true,
    title: "ULPF Terminal Dashboard",
    fullUnicode: true,
});

/* -------------------------------------------------------------------------- */
/*                              GRID LAYOUT                                   */
/* -------------------------------------------------------------------------- */

/*
 * 12 rows total:
 *
 * Row 0-6   : Live Events       | Throughput
 * Row 4-6   :                  | Source Distribution
 * Row 7-10  : Status            | ULPF System
 * Row 11    : Footer
 *
 * IMPORTANT:
 * Every panel has its own rectangle.
 * No panel overlaps another panel.
 */

const FOOTER_ROWS = 1;
const GRID_ROWS = 12;

const grid = new contrib.grid({
    rows: GRID_ROWS,
    cols: 12,
    screen,
});

/* -------------------------------------------------------------------------- */
/*                              MAIN PANELS                                   */
/* -------------------------------------------------------------------------- */

const eventFeed = grid.set(0, 0, 7, 8, contrib.log, {
    label: " Live Event Feed ",
    fg: "white",
    selectedFg: "white",

    tags: true,

    border: {
        type: "line",
        fg: "cyan",
    },

    scrollable: true,
    alwaysScroll: true,
});

const throughput = grid.set(0, 8, 4, 4, blessed.box, {
    label: " Throughput ",

    border: {
        type: "line",
        fg: "green",
    },

    padding: {
        top: 1,
        left: 2,
        right: 2,
    },

    tags: true,
});

const sourceChart = grid.set(4, 8, 3, 4, blessed.box, {
    label: " Source Distribution ",

    border: {
        type: "line",
        fg: "yellow",
    },

    padding: {
        top: 1,
        left: 1,
        right: 1,
    },

    tags: true,

    scrollable: true,
});

const statusChart = grid.set(7, 0, 4, 6, contrib.donut, {
    label: " Log Processing Status ",

    stroke: "green",
    fill: "white",

    border: {
        type: "line",
        fg: "magenta",
    },

    /*
     * Keep the donut itself clean.
     * The labels are rendered by a child box below
     * inside the SAME panel.
     */
    data: [
        {
            label: "Exported",
            percent: 0,
        },
        {
            label: "Quarantined",
            percent: 0,
        },
        {
            label: "Dead Letter",
            percent: 0,
        },
    ],
});

const statusLabels = blessed.text({
    parent: statusChart,

    bottom: 0,
    left: 0,

    width: "100%",
    height: 1,

    tags: true,

    align: "center",
    valign: "middle",

    style: {
        fg: "white",
    },
});
/*
 * blessed-contrib's donut renders the percentages nicely,
 * but its data labels are not reliably visible depending on
 * terminal size/font.
 *
 * So we add an explicit legend directly underneath it.
 */


const systemInfo = grid.set(7, 6, 4, 6, blessed.box, {
    label: " ULPF System ",

    border: {
        type: "line",
        fg: "cyan",
    },

    padding: {
        top: 1,
        left: 2,
        right: 2,
    },

    tags: true,
});

/* -------------------------------------------------------------------------- */
/*                                  FOOTER                                    */
/* -------------------------------------------------------------------------- */

const footer = grid.set(11, 0, FOOTER_ROWS, 12, blessed.box, {
    tags: true,

    align: "center",
    valign: "middle",

    border: {
        type: "line",
        fg: "gray",
    },

    style: {
        fg: "white",
    },
});

const FOOTER_TEXT_NORMAL =
    "↑↓←→ Navigate   x Expand   Esc Back   r Reset   q Quit";

const FOOTER_TEXT_EXPANDED =
    "↑↓ Scroll   x/Esc Back   r Reset   q Quit";

const FOOTER_TEXT_NARROW =
    "Arrows Nav   x Expand   Esc Back   r Reset   q Quit";

function renderFooter() {
    const width =
        typeof screen.width === "number"
            ? screen.width
            : 80;

    let text =
        expandedPanel !== null
            ? FOOTER_TEXT_EXPANDED
            : FOOTER_TEXT_NORMAL;

    if (width < 55) {
        text = FOOTER_TEXT_NARROW;
    }

    footer.setContent(text);
}

/* -------------------------------------------------------------------------- */
/*                                   STATE                                    */
/* -------------------------------------------------------------------------- */

const stats = {
    exported: 0,
    quarantined: 0,
    deadLetter: 0,
    total: 0,
};

const sources = {};
const recentEvents = [];
const seenEventIds = new Set();

const liveEventTimes = [];

let lastEventTime = null;
let sseConnected = false;
let activeSSE = null;

/* -------------------------------------------------------------------------- */
/*                              PANEL NAVIGATION                              */
/* -------------------------------------------------------------------------- */

const panels = [
    {
        name: "events",
        widget: eventFeed,
        color: "cyan",
    },
    {
        name: "throughput",
        widget: throughput,
        color: "green",
    },
    {
        name: "source",
        widget: sourceChart,
        color: "yellow",
    },
    {
        name: "status",
        widget: statusChart,
        color: "magenta",
    },
    {
        name: "system",
        widget: systemInfo,
        color: "cyan",
    },
];

let focusedPanel = 0;
let expandedPanel = null;

const NAVIGATION_MAP = {
    events: {
        right: "throughput",
        down: "status",
    },

    throughput: {
        left: "events",
        down: "source",
    },

    source: {
        left: "events",
        up: "throughput",
        down: "system",
    },

    status: {
        up: "events",
        right: "system",
    },

    system: {
        up: "source",
        left: "status",
    },
};

function getPanelTitle(name) {
    switch (name) {
        case "events":
            return "Live Event Feed";

        case "throughput":
            return "Throughput";

        case "source":
            return "Source Distribution";

        case "status":
            return "Log Processing Status";

        case "system":
            return "ULPF System";

        default:
            return name;
    }
}

function updatePanelFocus() {
    panels.forEach((panel, index) => {
        const focused = index === focusedPanel;

        if (!panel.widget.options.border) {
            panel.widget.options.border = {
                type: "line",
            };
        }

        panel.widget.options.border.fg =
            focused
                ? "white"
                : panel.color;

        const label = focused
            ? ` ${getPanelTitle(panel.name)} [FOCUSED] `
            : ` ${getPanelTitle(panel.name)} `;

        panel.widget.options.label = label;

        if (
            typeof panel.widget.setLabel === "function"
        ) {
            panel.widget.setLabel(label);
        }
    });
}

function moveFocus(direction) {
    if (expandedPanel !== null) {
        return;
    }

    const currentName =
        panels[focusedPanel].name;

    const targetName =
        NAVIGATION_MAP[currentName]?.[direction];

    if (!targetName) {
        return;
    }

    const targetIndex =
        panels.findIndex(
            (panel) =>
                panel.name === targetName
        );

    if (targetIndex === -1) {
        return;
    }

    focusedPanel = targetIndex;

    updatePanelFocus();

    screen.render();
}

/* -------------------------------------------------------------------------- */
/*                            STATUS / DONUT                                  */
/* -------------------------------------------------------------------------- */

function buildStatusData() {
    const total =
        stats.exported +
        stats.quarantined +
        stats.deadLetter;

    if (total === 0) {
        return [
            {
                label: "Exported",
                percent: 0,
            },
            {
                label: "Quarantined",
                percent: 0,
            },
            {
                label: "Dead Letter",
                percent: 0,
            },
        ];
    }

    return [
        {
            label: "Exported",
            percent: Math.round(
                (stats.exported / total) * 100
            ),
        },

        {
            label: "Quarantined",
            percent: Math.round(
                (stats.quarantined / total) * 100
            ),
        },

        {
            label: "Dead Letter",
            percent: Math.round(
                (stats.deadLetter / total) * 100
            ),
        },
    ];
}

function updateStatusChart() {
    statusChart.setData(
        buildStatusData()
    );

    const total =
        stats.exported +
        stats.quarantined +
        stats.deadLetter;

    const exportedPct =
        total > 0
            ? Math.round(
                (stats.exported / total) * 100
            )
            : 0;

    const quarantinedPct =
        total > 0
            ? Math.round(
                (stats.quarantined / total) * 100
            )
            : 0;

    const deadPct =
        total > 0
            ? Math.round(
                (stats.deadLetter / total) * 100
            )
            : 0;

    statusLabels.setContent(
        `{green-fg}●{/green-fg} Exported ${stats.exported} (${exportedPct}%)   ` +
        `{yellow-fg}●{/yellow-fg} Quarantined ${stats.quarantined} (${quarantinedPct}%)   ` +
        `{red-fg}●{/red-fg} Dead Letter ${stats.deadLetter} (${deadPct}%)`
    );
}

/* -------------------------------------------------------------------------- */
/*                         SOURCE DISTRIBUTION                                */
/* -------------------------------------------------------------------------- */

function getSourceLabel(source) {
    if (!source) {
        return "Unknown";
    }

    const value =
        typeof source === "string"
            ? source
            : source.type ||
              source.parser_id ||
              source.parserId ||
              "Unknown";

    switch (value) {
        case "fortinet_v1.0":
            return "Fortinet";

        case "cisco_asa_v1.0":
            return "Cisco ASA";

        case "generic_cef_v1.0":
            return "CEF";

        default:
            return value;
    }
}

function renderSourceChartLines({
    entries,
    barWidth,
    showPercent,
}) {
    if (entries.length === 0) {
        return "{gray-fg}No exported events yet{/gray-fg}";
    }

    const totalExported =
        Math.max(stats.exported, 1);

    const lines = [];

    entries.forEach(
        ([source, count], index) => {
            const percent =
                (count / totalExported) * 100;

            const filled =
                Math.round(
                    (percent / 100) *
                    barWidth
                );

            const empty =
                barWidth - filled;

            const bar =
                "█".repeat(
                    Math.max(0, filled)
                ) +
                "░".repeat(
                    Math.max(0, empty)
                );

            const percentText =
                showPercent
                    ? ` ${percent.toFixed(0)}%`
                    : "";

            lines.push(
                `{bold}${source}{/bold}\n` +
                `${bar}  ${count}${percentText}`
            );

            if (
                index <
                entries.length - 1
            ) {
                lines.push("");
            }
        }
    );

    return lines.join("\n");
}

function updateSourceChart() {
    const entries =
        Object.entries(sources)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            )
            .slice(0, 3);

    sourceChart.setContent(
        renderSourceChartLines({
            entries,
            barWidth: 15,
            showPercent: true,
        })
    );
}

/* -------------------------------------------------------------------------- */
/*                              THROUGHPUT                                    */
/* -------------------------------------------------------------------------- */

function pruneLiveEventTimes(windowMs) {
    const now = Date.now();

    const cutoff =
        now - windowMs;

    while (
        liveEventTimes.length > 0 &&
        liveEventTimes[0] < cutoff
    ) {
        liveEventTimes.shift();
    }
}

function updateThroughput() {
    pruneLiveEventTimes(10_000);

    const eventsInWindow =
        liveEventTimes.length;

    const eventsPerSecond =
        eventsInWindow / 10;

    throughput.setContent(
        `{bold}${eventsPerSecond.toFixed(
            1
        )}{/bold}\n` +
        `events/sec\n\n` +
        `Rolling 10 seconds\n` +
        `Events: ${eventsInWindow}`
    );
}

/* -------------------------------------------------------------------------- */
/*                              SYSTEM INFO                                   */
/* -------------------------------------------------------------------------- */

function updateSystemInfo() {
    const connection =
        sseConnected
            ? "{green-fg}● Connected{/green-fg}"
            : "{red-fg}● Disconnected{/red-fg}";

    const lastEvent =
        lastEventTime
            ? new Date(
                lastEventTime
            ).toLocaleTimeString()
            : "—";

    systemInfo.setContent(
        `{bold}Server{/bold}\n` +
        `${SERVER_URL}\n\n` +

        `{bold}Events{/bold}\n` +
        `Total:       ${stats.total}\n` +
        `Exported:    ${stats.exported}\n` +
        `Quarantined: ${stats.quarantined}\n` +
        `Dead Letter: ${stats.deadLetter}\n\n` +

        `{bold}Stream{/bold}\n` +
        `${connection}\n` +
        `Last event: ${lastEvent}`
    );
}

/* -------------------------------------------------------------------------- */
/*                            EXPANDED OVERLAY                                */
/* -------------------------------------------------------------------------- */

const expandedContainer = blessed.box({
    top: 0,
    left: 0,

    width: "100%",
    height: "100%-1",

    border: {
        type: "line",
        fg: "white",
    },

    label: " ULPF Expanded View ",

    tags: true,

    hidden: true,
});

screen.append(
    expandedContainer
);

const expandedWidgets = {};

let expandedEventsRendered = 0;

/* -------------------------------------------------------------------------- */
/*                         EXPANDED EVENT FEED                                */
/* -------------------------------------------------------------------------- */

function getOrCreateExpandedEvents() {
    if (!expandedWidgets.events) {
        expandedWidgets.events =
            blessed.log({
                parent:
                    expandedContainer,

                top: 1,
                left: 2,

                width: "100%-4",
                height: "100%-3",

                tags: true,

                fg: "white",

                scrollable: true,
                alwaysScroll: true,

                keys: true,
                vi: true,
                mouse: true,

                border: {
                    type: "line",
                    fg: "cyan",
                },

                label: " Events ",
            });
    }

    return expandedWidgets.events;
}

/* -------------------------------------------------------------------------- */
/*                     EXPANDED THROUGHPUT                                   */
/* -------------------------------------------------------------------------- */

function getOrCreateExpandedThroughput() {
    if (!expandedWidgets.throughput) {
        expandedWidgets.throughput =
            blessed.box({
                parent:
                    expandedContainer,

                top: 2,
                left: 4,

                width: "100%-8",
                height: "100%-5",

                tags: true,

                border: {
                    type: "line",
                    fg: "green",
                },

                padding: {
                    top: 2,
                    left: 3,
                    right: 3,
                },

                scrollable: true,
                keys: true,
                vi: true,
                mouse: true,

                label:
                    " Throughput Details ",
            });
    }

    return expandedWidgets.throughput;
}

/* -------------------------------------------------------------------------- */
/*                     EXPANDED SOURCE DISTRIBUTION                           */
/* -------------------------------------------------------------------------- */

function getOrCreateExpandedSource() {
    if (!expandedWidgets.source) {
        expandedWidgets.source =
            blessed.box({
                parent:
                    expandedContainer,

                top: 1,
                left: 2,

                width: "100%-4",
                height: "100%-3",

                tags: true,

                border: {
                    type: "line",
                    fg: "yellow",
                },

                padding: {
                    top: 1,
                    left: 3,
                    right: 3,
                },

                scrollable: true,

                keys: true,
                vi: true,
                mouse: true,

                label:
                    " Source Distribution ",
            });
    }

    return expandedWidgets.source;
}

/* -------------------------------------------------------------------------- */
/*                    EXPANDED STATUS                                        */
/* -------------------------------------------------------------------------- */

/*
 * DO NOT give the donut a parent here.
 *
 * blessed-contrib donut uses a canvas internally.
 * It must be appended to the screen/container and rendered
 * before setData() is called.
 */
function createExpandedStatusWidgets() {
    if (expandedWidgets.statusDonut) {
        return;
    }

    expandedWidgets.statusDonut =
        contrib.donut({
            top: 1,
            left: 2,

            width: "50%-2",
            height: "100%-3",

            label: " Status ",

            stroke: "green",
            fill: "white",

            border: {
                type: "line",
                fg: "magenta",
            },
        });

    expandedContainer.append(
        expandedWidgets.statusDonut
    );

    expandedWidgets.statusSummary =
        blessed.box({
            parent:
                expandedContainer,

            top: 1,
            left: "50%",

            width: "50%-3",
            height: "100%-3",

            tags: true,

            border: {
                type: "line",
                fg: "magenta",
            },

            padding: {
                top: 2,
                left: 3,
                right: 3,
            },

            label:
                " Processing Summary ",
        });
}

/* -------------------------------------------------------------------------- */
/*                         EXPANDED SYSTEM                                   */
/* -------------------------------------------------------------------------- */

function getOrCreateExpandedSystem() {
    if (!expandedWidgets.system) {
        expandedWidgets.system =
            blessed.box({
                parent:
                    expandedContainer,

                top: 1,
                left: 2,

                width: "100%-4",
                height: "100%-3",

                tags: true,

                border: {
                    type: "line",
                    fg: "cyan",
                },

                padding: {
                    top: 2,
                    left: 3,
                    right: 3,
                },

                scrollable: true,

                keys: true,
                vi: true,
                mouse: true,

                label:
                    " System Details ",
            });
    }

    return expandedWidgets.system;
}

/* -------------------------------------------------------------------------- */
/*                       EXPANDED VISIBILITY                                 */
/* -------------------------------------------------------------------------- */

function setActiveExpandedWidget(name) {
    Object.entries(
        expandedWidgets
    ).forEach(
        ([key, widget]) => {
            if (
                !widget ||
                typeof widget.show !==
                    "function"
            ) {
                return;
            }

            let shouldShow = false;

            if (name === "events") {
                shouldShow =
                    key === "events";
            }

            if (name === "throughput") {
                shouldShow =
                    key === "throughput";
            }

            if (name === "source") {
                shouldShow =
                    key === "source";
            }

            if (name === "status") {
                shouldShow =
                    key ===
                        "statusDonut" ||
                    key ===
                        "statusSummary";
            }

            if (name === "system") {
                shouldShow =
                    key === "system";
            }

            if (shouldShow) {
                widget.show();
            } else {
                widget.hide();
            }
        }
    );
}

/* -------------------------------------------------------------------------- */
/*                       EXPANDED CONTENT                                    */
/* -------------------------------------------------------------------------- */

function updateExpandedEvents() {
    const widget =
        getOrCreateExpandedEvents();

    while (
        expandedEventsRendered <
        recentEvents.length
    ) {
        const event =
            recentEvents[
                expandedEventsRendered
            ];

        widget.log(
            event.message
        );

        expandedEventsRendered++;
    }
}

function updateExpandedThroughput() {
    const widget =
        getOrCreateExpandedThroughput();

    pruneLiveEventTimes(
        10_000
    );

    const events10s =
        liveEventTimes.length;

    const rate10s =
        events10s / 10;

    const now = Date.now();

    const events60s =
        liveEventTimes.filter(
            (time) =>
                time >=
                now - 60_000
        ).length;

    const rate60s =
        events60s / 60;

    widget.setContent(
        `{bold}{green-fg}${rate10s.toFixed(
            2
        )} events/sec{/green-fg}{/bold}\n\n` +

        `Rolling 10 seconds\n` +
        `Events: ${events10s}\n` +
        `Rate:   ${rate10s.toFixed(
            2
        )} events/sec\n\n` +

        `Rolling 60 seconds\n` +
        `Events: ${events60s}\n` +
        `Rate:   ${rate60s.toFixed(
            2
        )} events/sec\n\n` +

        `{bold}Totals{/bold}\n` +
        `Processed:  ${stats.total}\n` +
        `Exported:   ${stats.exported}\n` +
        `Quarantine: ${stats.quarantined}\n` +
        `Dead Letter: ${stats.deadLetter}`
    );
}

function updateExpandedSource() {
    const widget =
        getOrCreateExpandedSource();

    const entries =
        Object.entries(sources)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );

    widget.setContent(
        renderSourceChartLines({
            entries,
            barWidth: 45,
            showPercent: true,
        })
    );
}

function updateExpandedStatus() {
    createExpandedStatusWidgets();

    const donut =
        expandedWidgets.statusDonut;

    const summary =
        expandedWidgets.statusSummary;

    donut.setData(
        buildStatusData()
    );

    const total =
        stats.exported +
        stats.quarantined +
        stats.deadLetter;

    const exportedPct =
        total
            ? (
                (stats.exported /
                    total) *
                100
            ).toFixed(1)
            : "0.0";

    const quarantinePct =
        total
            ? (
                (stats.quarantined /
                    total) *
                100
            ).toFixed(1)
            : "0.0";

    const deadPct =
        total
            ? (
                (stats.deadLetter /
                    total) *
                100
            ).toFixed(1)
            : "0.0";

    summary.setContent(
        `{bold}Processing Overview{/bold}\n\n` +

        `{green-fg}●{/green-fg} ` +
        `{bold}Exported{/bold}\n` +
        `  ${stats.exported} events\n` +
        `  ${exportedPct}% of processed\n\n` +

        `{yellow-fg}●{/yellow-fg} ` +
        `{bold}Quarantined{/bold}\n` +
        `  ${stats.quarantined} events\n` +
        `  ${quarantinePct}% of processed\n\n` +

        `{red-fg}●{/red-fg} ` +
        `{bold}Dead Letter{/bold}\n` +
        `  ${stats.deadLetter} events\n` +
        `  ${deadPct}% of processed\n\n` +

        `{bold}Total{/bold}\n` +
        `${total} processed events`
    );
}

function updateExpandedSystem() {
    const widget =
        getOrCreateExpandedSystem();

    const connection =
        sseConnected
            ? "{green-fg}● Connected{/green-fg}"
            : "{red-fg}● Disconnected{/red-fg}";

    const lastEvent =
        lastEventTime
            ? new Date(
                lastEventTime
            ).toLocaleString()
            : "—";

    widget.setContent(
        `{bold}ULPF Runtime{/bold}\n\n` +

        `Server URL\n` +
        `  ${SERVER_URL}\n\n` +

        `Event Stream\n` +
        `  ${connection}\n\n` +

        `Last Event\n` +
        `  ${lastEvent}\n\n` +

        `{bold}Processing State{/bold}\n\n` +

        `Total events\n` +
        `  ${stats.total}\n\n` +

        `Exported\n` +
        `  ${stats.exported}\n\n` +

        `Quarantined\n` +
        `  ${stats.quarantined}\n\n` +

        `Dead Letter\n` +
        `  ${stats.deadLetter}\n\n` +

        `{bold}Sources{/bold}\n` +
        `  ${Object.keys(
            sources
        ).length} detected`
    );
}

function updateExpandedView() {
    if (!expandedPanel) {
        return;
    }

    if (
        expandedPanel === "events"
    ) {
        updateExpandedEvents();
    }

    if (
        expandedPanel ===
        "throughput"
    ) {
        updateExpandedThroughput();
    }

    if (
        expandedPanel === "source"
    ) {
        updateExpandedSource();
    }

    if (
        expandedPanel === "status"
    ) {
        if (
            expandedWidgets.statusDonut
        ) {
            updateExpandedStatus();
        }
    }

    if (
        expandedPanel === "system"
    ) {
        updateExpandedSystem();
    }

    setActiveExpandedWidget(
        expandedPanel
    );
}

/* -------------------------------------------------------------------------- */
/*                        EXPAND / CLOSE                                      */
/* -------------------------------------------------------------------------- */

function expandedTitle(name) {
    return ` ULPF / ${getPanelTitle(
        name
    )} `;
}

function showExpandedPanel(name) {
    expandedPanel = name;

    expandedContainer.setLabel(
        expandedTitle(name)
    );

    expandedContainer.show();

    /*
     * Status donut gets created only after the overlay becomes visible.
     */
    if (name === "status") {
        createExpandedStatusWidgets();
    }

    setActiveExpandedWidget(
        name
    );

    renderFooter();

    /*
     * FIRST render:
     * Gives blessed-contrib's canvas a rendering context.
     */
    screen.render();

    /*
     * SECOND stage:
     * Now setData() is safe.
     */
    updateExpandedView();

    screen.render();
}

function closeExpandedPanel() {
    expandedPanel = null;

    expandedContainer.hide();

    renderFooter();

    updatePanelFocus();

    screen.render();
}

function toggleExpandedPanel() {
    if (expandedPanel !== null) {
        closeExpandedPanel();
        return;
    }

    const panel =
        panels[focusedPanel];

    if (!panel) {
        return;
    }

    showExpandedPanel(
        panel.name
    );
}

/* -------------------------------------------------------------------------- */
/*                              SCROLLING                                     */
/* -------------------------------------------------------------------------- */

function scrollExpandedContent(
    direction
) {
    if (!expandedPanel) {
        return;
    }

    let widget = null;

    if (
        expandedPanel === "events"
    ) {
        widget =
            expandedWidgets.events;
    }

    if (
        expandedPanel === "source"
    ) {
        widget =
            expandedWidgets.source;
    }

    if (
        expandedPanel ===
        "throughput"
    ) {
        widget =
            expandedWidgets.throughput;
    }

    if (
        expandedPanel === "system"
    ) {
        widget =
            expandedWidgets.system;
    }

    if (
        widget &&
        typeof widget.scroll ===
            "function"
    ) {
        widget.scroll(
            direction * 2
        );

        screen.render();
    }
}

/* -------------------------------------------------------------------------- */
/*                              EVENT PROCESSING                              */
/* -------------------------------------------------------------------------- */

function extractEventId(event) {
    return (
        event?.event_id ||
        event?.eventId ||
        event?.id ||
        null
    );
}

function addEvent(
    event,
    options = {}
) {
    const {
        live = false,
    } = options;

    const eventId =
        extractEventId(event);

    if (
        eventId &&
        seenEventIds.has(eventId)
    ) {
        return;
    }

    if (eventId) {
        seenEventIds.add(
            eventId
        );
    }

    stats.total++;

    lastEventTime =
        Date.now();

    if (live) {
        liveEventTimes.push(
            Date.now()
        );
    }

    let message =
        `{gray-fg}[${new Date()
            .toLocaleTimeString()}]{/gray-fg} `;

    if (
        event.type === "exported"
    ) {
        stats.exported++;

        const source =
            getSourceLabel(
                event.source
            );

        sources[source] =
            (sources[source] || 0) +
            1;

        message +=
            `{green-fg}[EXPORTED]{/green-fg} ` +
            `${source}`;

        if (event.event_id) {
            message +=
                ` id=${event.event_id}`;
        }
    }

    else if (
        event.type ===
        "quarantined"
    ) {
        stats.quarantined++;

        message +=
            `{yellow-fg}[QUARANTINED]{/yellow-fg} ` +
            `reason=${event.reason || "Unknown"}`;

        if (event.event_id) {
            message +=
                ` id=${event.event_id}`;
        }
    }

    else if (
        event.type ===
        "dead-letter"
    ) {
        stats.deadLetter++;

        message +=
            `{red-fg}[DEAD LETTER]{/red-fg} ` +
            `${event.error || "Unknown error"}`;

        if (event.event_id) {
            message +=
                ` id=${event.event_id}`;
        }
    }

    else {
        message +=
            `{gray-fg}[EVENT]{/gray-fg} ` +
            `${event.type || "unknown"}`;
    }

    recentEvents.push({
        message,
        event,
    });

    if (
        recentEvents.length > 100
    ) {
        recentEvents.shift();

        if (
            expandedEventsRendered >
            0
        ) {
            expandedEventsRendered--;
        }
    }

    eventFeed.log(
        message
    );

    refresh();
}

/* -------------------------------------------------------------------------- */
/*                                  RESET                                     */
/* -------------------------------------------------------------------------- */

function resetState() {
    stats.exported = 0;
    stats.quarantined = 0;
    stats.deadLetter = 0;
    stats.total = 0;

    Object.keys(
        sources
    ).forEach(
        (key) => {
            delete sources[key];
        }
    );

    recentEvents.length = 0;

    seenEventIds.clear();

    liveEventTimes.length = 0;

    lastEventTime = null;

    expandedEventsRendered = 0;

    eventFeed.setContent("");

    if (
        expandedWidgets.events
    ) {
        expandedWidgets.events.setContent(
            ""
        );
    }

    refresh();
}

/* -------------------------------------------------------------------------- */
/*                                  REFRESH                                   */
/* -------------------------------------------------------------------------- */

function refresh() {
    updateThroughput();

    updateSourceChart();

    updateStatusChart();

    updateSystemInfo();

    updatePanelFocus();

    renderFooter();

    if (
        expandedPanel !== null
    ) {
        updateExpandedView();
    }

    screen.render();
}

/* -------------------------------------------------------------------------- */
/*                          HISTORICAL EVENTS                                 */
/* -------------------------------------------------------------------------- */

async function loadHistoricalEvents() {
    try {
        const response =
            await fetch(
                `${SERVER_URL}/api/events`
            );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        const events =
            Array.isArray(data)
                ? data
                : data.events || [];

        events.forEach(
            (event) => {
                addEvent({
                    ...event,
                    type: "exported",
                });
            }
        );

    } catch (error) {
        eventFeed.log(
            `{red-fg}[HISTORY ERROR]{/red-fg} ` +
            `${error.message}`
        );
    }
}

/* -------------------------------------------------------------------------- */
/*                        HISTORICAL QUARANTINE                               */
/* -------------------------------------------------------------------------- */

async function loadHistoricalQuarantine() {
    try {
        const response =
            await fetch(
                `${SERVER_URL}/api/quarantine`
            );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        const events =
            Array.isArray(data)
                ? data
                : data.events ||
                  data.items ||
                  [];

        events.forEach(
            (event) => {
                addEvent({
                    ...event,
                    type: "quarantined",
                });
            }
        );

    } catch (error) {
        eventFeed.log(
            `{yellow-fg}[QUARANTINE HISTORY]{/yellow-fg} ` +
            `${error.message}`
        );
    }
}

/* -------------------------------------------------------------------------- */
/*                                  SSE                                       */
/* -------------------------------------------------------------------------- */

function connectSSE() {
    const streamURL =
        `${SERVER_URL}/api/stream`;

    eventFeed.log(
        `{gray-fg}Connecting to ${streamURL}...{/gray-fg}`
    );

    const source =
        new EventSource(
            streamURL
        );

    activeSSE = source;

    source.onopen = () => {
        sseConnected = true;

        eventFeed.log(
            `{green-fg}SSE connection established{/green-fg}`
        );

        refresh();
    };

    source.onmessage = (
        message
    ) => {
        try {
            const event =
                JSON.parse(
                    message.data
                );

            addEvent(event, {
                live: true,
            });

        } catch (error) {
            eventFeed.log(
                `{red-fg}[SSE PARSE ERROR]{/red-fg} ` +
                `${error.message}`
            );
        }
    };

    source.onerror = () => {
        sseConnected = false;

        eventFeed.log(
            `{yellow-fg}SSE connection lost; retrying...{/yellow-fg}`
        );

        refresh();
    };
}

/* -------------------------------------------------------------------------- */
/*                              KEYBOARD                                      */
/* -------------------------------------------------------------------------- */

screen.key(
    [
        "up",
        "down",
        "left",
        "right",
    ],
    (ch, key) => {
        if (!key) {
            return;
        }

        if (expandedPanel !== null) {
            if (key.name === "up") {
                scrollExpandedContent(-1);
            }

            if (key.name === "down") {
                scrollExpandedContent(1);
            }

            return;
        }

        moveFocus(key.name);
    }
);

screen.key(
    ["x"],
    () => {
        toggleExpandedPanel();
    }
);

screen.key(
    ["escape"],
    () => {
        if (
            expandedPanel !== null
        ) {
            closeExpandedPanel();
        }
    }
);

screen.key(
    ["r"],
    () => {
        resetState();
    }
);

screen.key(
    ["q", "C-c"],
    () => {
        if (activeSSE) {
            activeSSE.close();
        }

        process.exit(0);
    }
);

/* -------------------------------------------------------------------------- */
/*                                  RESIZE                                    */
/* -------------------------------------------------------------------------- */

screen.on(
    "resize",
    () => {
        renderFooter();

        updatePanelFocus();

        screen.render();
    }
);

/* -------------------------------------------------------------------------- */
/*                                  STARTUP                                   */
/* -------------------------------------------------------------------------- */

systemInfo.setContent(
    `{bold}ULPF Runtime{/bold}\n\n` +
    `Server: ${SERVER_URL}\n\n` +
    `{yellow-fg}Connecting to event stream...{/yellow-fg}`
);

updatePanelFocus();

renderFooter();

screen.render();

(async () => {
    await loadHistoricalEvents();

    await loadHistoricalQuarantine();

    connectSSE();

    refresh();
})();

setInterval(
    () => {
        refresh();
    },
    1000
);