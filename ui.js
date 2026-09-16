import {
  teams,
  opposite,
  fmt,
  spot,
  zone,
  remaining,
  direction,
  positions,
  statistics,
} from "./engine.js";
export const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const opt = (vals, selected) =>
  vals
    .map((v) => {
      let [value, label] = Array.isArray(v) ? v : [v, v];
      return `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(label)}</option>`;
    })
    .join("");
export const sel = (name, label, vals, value) =>
  `<label>${label}<select name="${name}">${opt(vals, value)}</select></label>`;
export const num = (name, label, value, min, max, step = "1") =>
  `<label>${label}<input name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`;
export const restartOptions = [
  ["snap", "On legal snap"],
  ["ready", "On referee ready"],
  ["touch", "On legal kick touch"],
  ["hold", "Keep stopped"],
];
export const b = (action, text, cls = "", extra = "") =>
  `${action === "export-csv" ? '<button type="button" data-cloud-open>Shared recordings</button><button type="button" data-evidence-open>Video evidence</button><button type="button" data-action="pilot-report" class="primary">Pilot report</button><button type="button" data-action="feedback">Send test feedback</button><button type="button" data-action="feedback-admin">View feedback</button>' : ""}<button type="button" data-action="${action}" class="${cls}" ${extra}>${text}</button>`;
export const flagButton = () =>
  b(
    "flag",
    '<i class="flag-icon" aria-hidden="true"></i><strong>FLAG</strong><span>Record a call<br>Timestamp now</span>',
    "flag-button",
  );
export function field(s) {
  const x = (v) => 7 + v * 0.86,
    dir = direction(s),
    crew = positions(s),
    map = {
      R: [-13, 50],
      U: [6, 50],
      HL: [0, 89],
      DJ: [0, 89],
      LJ: [0, 11],
      BJ: [21, 50],
      FJ: [18, 84],
      SJ: [18, 16],
      CJ: [-8, 72],
    };
  return `<article class="card field-card"><header class="card-head"><div><h2>Live field</h2><small>${s.crewSize}-person crew · ${s.phase === "live" ? "Live ball" : "Pre-snap reference"}</small></div><b>${spot(s.position)}</b></header><div class="field" role="img" aria-label="Ball at ${spot(s.position)}; ${s.possession} moving ${dir === 1 ? "right" : "left"}; line to gain ${spot(s.lineToGain)}"><div class="field-inner"></div><span class="field-label left">NORTHVIEW</span><span class="field-label right">CENTRAL</span><div class="yardnums">${[10, 20, 30, 40, 50, 40, 30, 20, 10].map((n) => `<span>${n}</span>`).join("")}</div><div class="los" style="left:${x(s.position)}%"></div><div class="ltg" style="left:${x(s.lineToGain)}%"></div>${crew.map((c) => `<span class="official" title="${esc(s.crew[c] || "Down judge")}" style="left:${x(Math.max(2, Math.min(98, s.position + map[c][0] * dir)))}%;top:${map[c][1]}%">${c}</span>`).join("")}<span class="ball-marker" style="left:${x(s.position)}%"></span></div><div class="field-legend"><b>${s.possession} ${dir === 1 ? "→" : "←"}</b><span><i class="legend-line"></i>Ball / LOS &nbsp; <i class="legend-line gain"></i>Line to gain</span></div><div class="field-facts"><div><small>Down & distance</small><strong>${s.down} & ${Number(Math.abs(s.lineToGain - s.position).toFixed(2)) || "goal"}</strong></div><div><small>Line to gain</small><strong>${spot(s.lineToGain)}</strong></div><div><small>Field zone</small><strong>${zone(s.position)}</strong></div></div><details><summary>Crew position key</summary><p class="muted">${crew.map((c) => `${c}: ${esc(s.crew[c] || "Down judge")}`).join(" · ")}</p><p class="footer-note">Illustrative pre-snap positions. Apply your association’s formation and crew mechanics.</p></details></article>`;
}
export function clocks(s) {
  return `<article class="card"><header class="card-head"><h2>Timing</h2><small data-clock-status></small></header><div class="clock-panel"><div class="clock-tile"><small>PLAY CLOCK</small><strong data-play-clock>40</strong><small data-play-status></small></div><div class="clock-tile"><small>DEAD BALL</small><strong data-dead-clock>0:00</strong><small data-admin-clock></small></div></div><div class="signal"><span>Game clock restart</span><b>${esc(restartOptions.find((x) => x[0] === s.restart)?.[1])}</b></div></article>`;
}
export function queue(s) {
  let f = s.flags.filter((f) => f.outcome === "pending");
  return `<article class="card" id="flag-inbox"><header class="card-head"><h2>Flag inbox</h2><span class="count-badge">${f.length}</span></header>${f.length ? f.map((f) => `<div class="queue-row"><div><b>${esc(f.name)}</b><p>${esc(f.team)} · ${esc(f.official)}${f.player ? " · #" + esc(f.player) : ""}</p><small>${f.phase} ball · ${fmt(f.game)} · play ${f.playId}</small></div>${b("edit-flag", "Edit", "small-button", `data-id="${f.id}"`)}</div>`).join("") : `<p class="empty">No pending flags.<br>Calls from this browser appear here for crew review.</p>`}${f.length ? b("enforce", "Review & enforce", "primary wide") + b("ai", "Ask AI about this play", "wide") : ""}${s.flags
    .filter((f) => f.outcome === "kickoff")
    .map(
      (f) =>
        '<div class="queue-row"><span>Kickoff carryover: ' +
        esc(f.name) +
        "</span>" +
        b("carryover", "Review", "small-button", 'data-id="' + f.id + '"') +
        "</div>",
    )
    .join("")}</article>`;
}
export function timeline(items) {
  return items.length
    ? `<div class="event-list">${items
        .slice()
        .reverse()
        .map(
          (e) =>
            `<div class="event"><time>${new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}<br>Q${e.quarter} ${fmt(e.game)}</time><div><b>${esc(e.type.replaceAll("_", " "))}</b><small>${esc(e.description)}</small></div></div>`,
        )
        .join("")}</div>`
    : '<p class="empty">No events yet. Start with a legal snap or a flag.</p>';
}
export function referee(s, doc, assigned) {
  const mine = s.flags.filter(
    (f) => f.official === assigned && f.outcome === "pending",
  );
  return `<div class="officiating-console"><section class="console-pitch" aria-label="Live field position"><header class="pitch-heading"><div><span class="console-kicker">FIELD POSITION</span><h1>${spot(s.position)}</h1></div><div class="series-chip"><strong>${s.down} & ${Number(Math.abs(s.lineToGain - s.position).toFixed(2)) || "goal"}</strong><span>${s.possession} ${direction(s) === 1 ? "→" : "←"}</span></div></header><div class="console-field">${field(s)}</div><footer class="pitch-footer"><span><i></i>Crew reference positions</span><span>Illustrative · not live tracking</span></footer></section><aside class="console-controls" aria-label="Official controls"><div class="official-assignment"><span class="console-kicker">YOUR POSITION</span><label><span class="sr-only">Official position</span><select id="assigned">${opt(positions(s), assigned)}</select></label></div><div class="console-clock"><span class="console-kicker">PLAY CLOCK</span><strong data-play-clock>${Math.ceil(remaining(s.play))}</strong><span>${s.phase === "live" ? "Live ball" : "Dead ball"}</span></div><button type="button" data-action="flag" class="console-flag"><i class="flag-icon" aria-hidden="true"></i><strong>FLAG</strong><span>Report a foul</span></button>${mine.length ? `<details class="console-reports" open><summary>Finish flag details <b>${mine.length}</b></summary>${mine.map((f) => `<div class="queue-row"><b>${esc(f.name)}</b>${b("edit-flag", f.callId ? "Review" : "Add details", "small-button", `data-id="${f.id}"`)}</div>`).join("")}</details>` : ""}</aside></div>`;
}
export function keeper(s, doc) {
  const pending = s.flags.filter((f) => f.outcome === "pending"),
    unfinished = pending.filter((f) => !f.callId);
  return (
    `<section class="work-summary" aria-label="Next game action"><div><span class="console-kicker">NEXT STEP</span><h2>${s.phase === "live" ? "Play in progress" : s.currentPlay ? "Record the play result" : pending.length ? "Resolve pending flags" : "Prepare the next play"}</h2><p>${pending.length ? pending.length + " pending flag(s) · " + unfinished.length + " need a call selected" : "No pending flags"} · ${s.currentPlay ? "Play " + s.currentPlay.id : "Ball at " + spot(s.position)}</p></div><div class="toolbar">${s.phase === "live" ? b("whistle", "Whistle / stop", "primary") : s.currentPlay ? b("result-view", "Enter play result", "primary") : pending.length ? b("pending-view", "Open flag inbox", "primary") : b("ready", "Ready for play", "primary")}${b("export-json", "Save game backup")}</div></section>` +
    `<div class="page-title"><div><div class="eyebrow">Scorekeeper portal</div><h1>Game control</h1></div><div class="toolbar">${b("undo", "Undo last action", "", !doc.undo.length ? "disabled" : "")}${b("redo", "Redo", "", !doc.redo.length ? "disabled" : "")}</div></div><div class="layout keeper-layout"><div class="stack">${flagButton()}${clocks(s)}<article class="card"><div class="action-grid">${b("game-clock", "Start / pause game", "primary")}${b("play-clock", "Start / pause play")}${b("snap", "Legal snap")}${b("whistle", "Whistle / stop")}${b("ready", "Ready for play")}${b("kick-touch", "Legal kick touch")}${b("live-possession", "Live possession change", "wide")}</div><details><summary>Correct clocks</summary><form id="clock-form" class="form-grid">${sel("target", "Clock", ["game", "play"], "game")}${num("seconds", "Set seconds", Math.ceil(remaining(s.game)), 0, 3600)}<label class="wide">Reason<input name="reason" required placeholder="Example: stopped 3 seconds late"></label><button class="wide">Apply correction & pause</button></form></details></article><article class="card" id="play-result-card"><header class="card-head"><h2>Play result</h2><small>${s.currentPlay ? "Play " + s.currentPlay.id : "Waiting for a snap"}</small></header><form id="result-form" class="form-grid">${sel("result", "Result", ["Run", "Incomplete", "Out of bounds", "Turnover", "Touchdown", "Field goal", "Safety", "Touchback", "Try good (1)", "Try good (2)", "Try no good", "No play"], "Run")}<div class="action-grid gain-presets wide">${[-5, -1, 1, 3, 5, 7, 10, 15].map((g) => `<button type="button" data-gain-preset="${g}">${g > 0 ? "+" + g : g}</button>`).join("")}</div>${num("gain", "Net gain / loss", 0, -100, 100)}<details class="wide"><summary>Touchback options</summary><div class="form-grid">${sel("receiving", "Team receiving possession", teams, opposite(s.possession))}${num("touchbackSpot", "Final spot (NTH goal = 0)", 20, 1, 99)}</div><p class="muted">Confirm the touchback spot under the selected rules and kick type.</p></details><button class="primary wide" ${!s.currentPlay ? "disabled" : ""}>Record result</button></form></article>${queue(s)}${field(s)}</div><div class="stack"><article class="card"><header class="card-head"><h2>Ball & series</h2><small>Coordinates: NTH goal 0, CTL goal 100</small></header><form id="game-form" class="form-grid">${sel("possession", "Possession", teams, s.possession)}${sel(
      "northDirection",
      "Northview attacks",
      [
        [1, "Right →"],
        [-1, "Left ←"],
      ],
      s.northDirection,
    )}${num("position", "Ball position", s.position, 0, 100, ".01")}${num("lineToGain", "Line to gain", s.lineToGain, 0, 100, ".01")}${num("down", "Down", s.down, 1, 4)}${sel("playType", "Play type", ["scrimmage", "kickoff", "punt", "try"], s.playType)}${sel("restart", "Game clock restart", restartOptions, s.restart)}<label class="checkbox"><input type="checkbox" name="untimed" ${s.untimed ? "checked" : ""}>Untimed down</label><button class="primary wide">Update game state</button></form></article><article class="card"><header class="card-head"><h2>Score & timeouts</h2></header>${teams.map((t) => `<form class="score-form" data-team="${t}"><h3>${t}</h3><div class="form-grid">${num("score", "Score", s.score[t], 0, 199)}${num("count", "Timeouts left", s.timeouts[t], 0, 3)}<button class="wide">Save ${t}</button></div></form>`).join("<hr>")}<p class="footer-note">Scoring play results add points automatically. Use these fields for corrections.</p></article><article class="card"><header class="card-head"><h2>Stoppages</h2><small data-stoppage-clock></small></header>${s.activeStop ? `<p class="info">${esc(s.activeStop.reason)} · ${esc(s.activeStop.team)}</p><br>${b("end-stoppage", "End stoppage", "primary wide")}` : `<form id="stoppage-form" class="form-grid">${sel("reason", "Reason", ["Team timeout", "Injury", "Equipment", "Measurement", "Official timeout", "Media timeout", ...(s.ruleset === "NCAA" ? ["Two-minute timeout", "Replay review"] : [])], "Team timeout")}${sel("team", "Team", [...teams, "Neither"], s.possession)}<button class="wide">Start stoppage</button></form>`}</article><article class="card"><h2>Period</h2><p class="muted">The referee must declare the period over before the clock is reset. A tied game after Q4 requires the adopted overtime procedure.</p><br>${b("period", "Confirm end of period", "wide")}<hr>${b("setup", "Rules & crew setup", "wide")}${b("reset", "Reset Demo", "wide danger-text")}</article></div></div>`
  );
}
export function bars(rows) {
  const max = Math.max(1, ...rows.map((x) => x[1]));
  return rows.length
    ? rows
        .map(
          ([label, n]) =>
            `<div class="chart-row"><span>${esc(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${(n / max) * 100}%"></div></div><b>${n}</b></div>`,
        )
        .join("")
    : '<p class="empty">No calls match these filters.</p>';
}
export function reports(s, doc, filters) {
  let st = statistics(s, filters),
    metric = (label, n, note) =>
      `<article class="metric"><span class="muted">${label}</span><strong>${n === null ? "—" : Math.round(n) + "s"}</strong><small>${note}</small></article>`,
    filter = (k, label, values) =>
      `<label>${label}<select data-filter="${k}">${opt([["", "All"], ...values], filters[k] || "")}</select></label>`,
    outcomes = Object.entries(st.outcomes),
    repeats = st.groups("name").filter((x) => x[1] > 1);
  return `<div class="page-title"><div><div class="eyebrow">Football statistics & reports</div><h1>The game, in perspective.</h1></div><div class="toolbar">${b("export-csv", "Penalty CSV")}${b("export-json", "Game JSON")}${b("export-report", "Crew report")}</div></div><section class="card" style="margin-bottom:20px"><div class="filters">${filter("quarter", "Quarter", [1, 2, 3, 4])}${filter("team", "Team", [...teams, "Neither"])}${filter("official", "Official", positions(s))}${filter(
    "outcome",
    "Result",
    outcomes.map((x) => x[0]),
  )}${filter("category", "Category", [...new Set(s.flags.map((f) => f.category).filter(Boolean))])}${filter("down", "Down", [1, 2, 3, 4])}${filter("fieldZone", "Field zone", ["North red zone", "Between 20s", "Central red zone"])}${filter("player", "Player", [...new Set(s.flags.map((f) => f.player).filter(Boolean))])}</div><p class="muted">Flag filters apply to calls and crew counts. Pace, plays and stoppages use the quarter filter. Administration is measured once per whistle-to-next-legal-snap interval.</p></section><div class="metric-grid">${metric("Penalty administration", st.adminAverage, `${st.admins.length} completed intervals`)}${metric("Between legal snaps", st.snapAverage, `${st.plays.length} completed plays`)}${metric("Dead-ball time", st.deadAverage, "Whistle / down end to snap")}${metric("Team timeout length", st.timeoutAverage, "Start to explicit end / ready")}</div><div class="layout"><div class="stack"><section class="card"><header class="card-head"><h2>Calls by outcome</h2><b>${st.flags.length} flags / rulings</b></header>${bars(outcomes)}<p class="muted">No-play downs: ${s.plays.filter((p) => p.noPlay && (!filters.quarter || String(p.quarter) === filters.quarter)).length}. Kickoff carryovers stay separate from completed enforcement.</p></section><section class="card"><header class="card-head"><h2>Quarter-by-quarter</h2><small>All game plays</small></header><div class="quarters">${[1, 2, 3, 4].map((q) => `<div class="quarter-column"><small>QUARTER ${q}</small><strong>${s.plays.filter((p) => p.quarter === q && !p.noPlay).length}</strong><small>plays · ${s.flags.filter((f) => f.quarter === q).length} calls</small></div>`).join("")}</div></section><section class="card"><h2>Category patterns</h2>${bars(st.groups("category"))}</section><section class="card"><h2>Crew observations</h2>${bars(st.groups("official"))}<p class="muted">${repeats.length ? repeats.map(([n, c]) => `${esc(n)}: ${c} reports`).join("; ") + "." : "No repeated call types in this selection."} Counts and durations describe this game; they do not establish accuracy, bias, or official performance.</p><br><p class="muted">${st.admins.length ? "Longest completed administration: " + Math.round(Math.max(...st.admins.map((a) => a.seconds))) + " seconds. Review play complexity and footage before drawing conclusions." : "Record completed administration intervals before reviewing pace."}</p></section></div><div class="stack"><section class="card"><h2>Team split</h2>${bars(st.groups("team"))}</section><section class="card"><header class="card-head"><h2>Game timeline</h2><small>${doc.audit.length} audit events</small></header>${timeline(doc.audit.filter((e) => !filters.quarter || String(e.quarter) === filters.quarter))}</section><section class="card"><h2>Administration intervals</h2>${st.admins.length ? st.admins.map((a) => `<div class="queue-row"><span>Q${a.quarter} · ${a.flagIds.length} flags</span><b>${Math.round(a.seconds)}s</b></div>`).join("") : '<p class="empty">An interval completes at the next legal snap.</p>'}${s.activeAdmin !== null ? '<p class="info">An administration interval is still open.</p>' : ""}</section><section class="card"><h2>Rulebook library</h2><p class="muted">NCAA 2026: supplied full book and case interpretations. NFHS 2025: clock guide only; penalty entries require full-book validation.</p><br><p><a href="https://store.nfhsdigital.org/" target="_blank" rel="noopener">Official NFHS rules & case books</a></p><p><a href="https://www.ncaa.org/championships/playing-rules/football-playing-rules/" target="_blank" rel="noopener">Official NCAA rules resources</a></p><br>${b("library", "Search supplied rulebooks", "primary wide")}${b("ai", "Ask AI about this play", "wide")}${b("export-review", "Export ruling review packet", "wide")}<p class="footer-note">AI analysis requires the optional server connection. Search works locally; the review packet preserves facts and citations for further analysis.</p></section></div></div><section class="card" style="margin-top:22px"><h2>Penalty log</h2><div class="table-wrap"><table><thead><tr><th>Play / clock</th><th>Call</th><th>Team / player</th><th>Official</th><th>Result</th><th>Ruling</th></tr></thead><tbody>${st.flags.map((f) => `<tr><td>${f.playId}<small>Q${f.quarter} ${fmt(f.game)}</small></td><td>${esc(f.name)}<small>${esc(f.citation || "Select call")} · ${f.phase}</small></td><td>${esc(f.team)}<small>${esc(f.player || "—")} · ${spot(f.position)}</small></td><td>${esc(f.official)}<small>${esc(f.officialName)}</small></td><td>${esc(f.outcome)}</td><td>${esc(f.ruling || f.note || "—")}</td></tr>`).join("") || '<tr><td colspan="6">No calls recorded.</td></tr>'}</tbody></table></div></section><section class="card" style="margin-top:22px"><h2>Play-by-play</h2><div class="table-wrap"><table><thead><tr><th>Play</th><th>Clock</th><th>Possession</th><th>Result</th><th>Spot</th><th>Dead time</th></tr></thead><tbody>${
    s.plays
      .filter((p) => !filters.quarter || String(p.quarter) === filters.quarter)
      .map(
        (p) =>
          `<tr><td>${p.id}${p.noPlay ? " · NO PLAY" : ""}</td><td>Q${p.quarter} ${fmt(p.game)}</td><td>${p.possession}</td><td>${esc(p.result)}</td><td>${spot(p.position)} → ${spot(p.endPosition)}</td><td>${p.deadSeconds === null ? "—" : Math.round(p.deadSeconds) + "s"}</td></tr>`,
      )
      .join("") || '<tr><td colspan="6">No completed plays.</td></tr>'
  }</tbody></table></div></section>`;
}
