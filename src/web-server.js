const http = require("node:http");
const { URL } = require("node:url");
const { getConfig } = require("./config");
const { parseCsv, readCsv } = require("./lib/csv");
const { loadAttendanceStore, saveAttendanceStore } = require("./lib/attendance-store");

const config = getConfig();
const port = Number(process.env.PORT || 3000);

const statusLabels = {
  available: { mark: "〇", label: "参加", className: "available" },
  tentative: { mark: "△", label: "未定", className: "tentative" },
  unavailable: { mark: "×", label: "不参加", className: "unavailable" },
};

function normalizeMember(row) {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    discordUserId: row.discord_user_id,
    role: row.role,
    note: row.note || "",
  };
}

function opponentFromRow(row, index) {
  const suffix = index === 1 ? "" : `_${index}`;
  const team =
    row[`opponent_team_${index}`] ||
    row[`opponent_team${suffix}`] ||
    row[`opponent_${index}`] ||
    row[`team_${index}`] ||
    "";
  if (!team) return null;

  return {
    team,
    points:
      row[`current_points_${index}`] ||
      row[`current_points${suffix}`] ||
      row[`opponent_points_${index}`] ||
      row[`opponent_points${suffix}`] ||
      row[`points_${index}`] ||
      "",
    rank: row[`rank${suffix}`] || row[`rank_${index}`] || "",
  };
}

function normalizeMatch(row) {
  const opponents = [1, 2, 3].map((index) => opponentFromRow(row, index)).filter(Boolean);
  return {
    matchId: row.match_id,
    date: row.date,
    weekday: row.weekday,
    startTime: row.start_time,
    opponents,
    requiredPlayers: Number(row.required_players || 0),
    note: row.note || "",
  };
}

async function readPointsRows() {
  if (config.pointsCsv) return readCsv(config.pointsCsv);
  if (!config.pointsCsvUrl) return [];

  const response = await fetch(config.pointsCsvUrl);
  if (!response.ok) {
    throw new Error(`ポイントCSVを取得できませんでした: ${response.status} ${response.statusText}`);
  }
  return parseCsv(await response.text());
}

function normalizePoints(rows) {
  const map = new Map();
  for (const row of rows) {
    const team = row.team_name || row.opponent_team || row.team || row.name;
    if (!team) continue;
    map.set(team, {
      points: row.current_points || row.points || row.point || "",
      rank: row.rank || "",
      updatedAt: row.updated_at || row.updatedAt || "",
    });
  }
  return map;
}

function applyPointSource(matches, pointMap) {
  return matches.map((match) => ({
    ...match,
    opponents: match.opponents.map((opponent) => {
      const point = pointMap.get(opponent.team);
      if (!point) return opponent;
      return {
        ...opponent,
        points: point.points || opponent.points,
        rank: point.rank || opponent.rank,
        pointUpdatedAt: point.updatedAt,
      };
    }),
  }));
}

async function loadData() {
  const matches = (await readCsv(config.matchDaysCsv)).map(normalizeMatch).filter((row) => row.matchId);
  const members = (await readCsv(config.membersCsv)).map(normalizeMember).filter((row) => row.userId);
  const pointMap = normalizePoints(await readPointsRows());
  return { matches: applyPointSource(matches, pointMap), members };
}

function responseKey(matchId, userId) {
  return `${matchId}:${userId}`;
}

function countForMatch(match, members, store) {
  const counts = {
    available: [],
    tentative: [],
    unavailable: [],
    unanswered: [],
  };

  for (const member of members) {
    const response = store.responses[responseKey(match.matchId, member.userId)];
    if (response?.status === "available") counts.available.push(member.displayName);
    else if (response?.status === "tentative") counts.tentative.push(member.displayName);
    else if (response?.status === "unavailable") counts.unavailable.push(member.displayName);
    else counts.unanswered.push(member.displayName);
  }

  return {
    ...counts,
    shortage: Math.max(0, match.requiredPlayers - counts.available.length),
  };
}

function getConfirmedLineup(match, members, store) {
  const lineup = store.confirmedLineups?.[match.matchId] || { userIds: [], note: "" };
  const names = lineup.userIds
    .map((userId) => members.find((member) => member.userId === userId)?.displayName)
    .filter(Boolean);
  return {
    userIds: lineup.userIds || [],
    names,
    note: lineup.note || "",
    updatedAt: lineup.updatedAt || "",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function opponentCards(opponents) {
  return `<div class="opponents">
    ${opponents.map((opponent, index) => `
      <div class="opponent-card">
        <div class="opponent-label">対戦相手 ${index + 1}</div>
        <div class="opponent-name">${escapeHtml(opponent.team)}</div>
        <div class="opponent-meta">
          <span>${opponent.rank ? `${escapeHtml(opponent.rank)}位` : "順位 -"}</span>
          <span>${opponent.points ? `${escapeHtml(opponent.points)} pt` : "pt -"}</span>
        </div>
      </div>
    `).join("")}
  </div>`;
}

function layout(title, body) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f0e8;
      --ink: #17202a;
      --muted: #69707a;
      --surface: #fffdf8;
      --line: #ded6c8;
      --green: #007a5a;
      --amber: #bd6b00;
      --red: #bf2f24;
      --teal: #0f766e;
      --navy: #12263a;
      --tile: #f7e7d3;
      --accent: #d83b2d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        linear-gradient(135deg, rgba(18,38,58,.94), rgba(15,118,110,.82)),
        radial-gradient(circle at 20% 10%, rgba(255,255,255,.3), transparent 28%),
        var(--bg);
      color: var(--ink);
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      line-height: 1.55;
      min-height: 100vh;
    }
    header {
      color: white;
      padding: 24px;
      border-bottom: 1px solid rgba(255,255,255,.22);
    }
    .header-inner { max-width: 1180px; margin: 0 auto; }
    h1 { margin: 0; font-size: 28px; letter-spacing: 0; }
    .subtitle { margin: 6px 0 0; color: #e7f5ef; }
    nav { margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
    nav a {
      color: white;
      text-decoration: none;
      border: 1px solid rgba(255,255,255,.36);
      border-radius: 999px;
      padding: 7px 12px;
      background: rgba(255,255,255,.10);
      font-weight: 700;
      font-size: 14px;
    }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 12px 30px rgba(18,38,58,.12);
    }
    .match-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
      box-shadow: 0 12px 30px rgba(18,38,58,.12);
    }
    .match-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      background: linear-gradient(90deg, #fff8ed, #eef8f4);
      border-bottom: 1px solid var(--line);
    }
    .match-date { font-size: 20px; font-weight: 800; }
    .match-id { color: var(--muted); font-size: 13px; }
    .needed {
      min-width: 86px;
      text-align: center;
      border-radius: 8px;
      padding: 8px 10px;
      background: var(--navy);
      color: white;
      font-weight: 800;
    }
    .match-body { padding: 16px 18px 18px; }
    .opponents {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .opponent-card {
      border: 1px solid #d6c2a9;
      background: var(--tile);
      border-radius: 8px;
      padding: 12px;
      min-height: 94px;
    }
    .opponent-label { color: var(--muted); font-size: 12px; font-weight: 700; }
    .opponent-name { font-weight: 900; font-size: 17px; margin-top: 3px; }
    .opponent-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; color: #513c2a; font-weight: 800; }
    h2 { margin: 0 0 14px; font-size: 18px; }
    label { display: block; font-weight: 700; margin-bottom: 6px; }
    select, textarea, button {
      font: inherit;
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    select, textarea { width: 100%; padding: 10px 12px; background: white; }
    textarea { min-height: 64px; resize: vertical; }
    button {
      padding: 11px 16px;
      background: var(--accent);
      color: white;
      border: 0;
      font-weight: 800;
      cursor: pointer;
    }
    button:disabled { background: #a6a6a6; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; }
    th { background: #efe6d8; font-size: 13px; }
    .status-options { display: flex; gap: 8px; flex-wrap: wrap; }
    .status-options label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 11px;
      border: 1px solid var(--line);
      border-radius: 999px;
      font-weight: 800;
      background: #fff;
      margin: 0;
    }
    .status-options .available { color: var(--green); }
    .status-options .tentative { color: var(--amber); }
    .status-options .unavailable { color: var(--red); }
    .muted { color: var(--muted); font-size: 13px; }
    .ok { color: var(--green); font-weight: 800; }
    .warn { color: var(--amber); font-weight: 800; }
    .bad { color: var(--red); font-weight: 800; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .actions { display: flex; gap: 10px; align-items: center; margin-top: 14px; }
    .summary-pills { display: flex; gap: 8px; flex-wrap: wrap; }
    .pill { border-radius: 999px; padding: 5px 9px; background: #f4efe7; font-weight: 800; }
    .lineup-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 8px;
    }
    .lineup-member {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      background: #fffdf8;
      margin: 0;
    }
    .lineup-member small { color: var(--muted); font-weight: 800; }
    @media (max-width: 820px) {
      header, main { padding: 16px; }
      .match-head { flex-direction: column; }
      .opponents { grid-template-columns: 1fr; }
      .grid { grid-template-columns: 1fr; }
      table { font-size: 13px; }
      th, td { padding: 8px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <h1>麻雀チーム 出欠ボード</h1>
      <p class="subtitle">対戦予定を見ながら、各日の参加可否をまとめて回答できます。</p>
      <nav>
        <a href="/">回答する</a>
        <a href="/summary">集計を見る</a>
        <a href="/lineup">登板確定</a>
        <a href="/admin/lineup">登板編集</a>
      </nav>
    </div>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

function renderAnswerPage(data, store, selectedUserId = "", saved = false) {
  const selectedMember = data.members.find((member) => member.userId === selectedUserId);
  const memberOptions = [
    '<option value="">名前を選択してください</option>',
    ...data.members.map((member) => {
      const selected = member.userId === selectedUserId ? " selected" : "";
      return `<option value="${escapeHtml(member.userId)}"${selected}>${escapeHtml(member.displayName)}</option>`;
    }),
  ].join("");

  const cards = data.matches.map((match) => {
    const response = selectedMember ? store.responses[responseKey(match.matchId, selectedMember.userId)] : null;
    const current = response?.status || "";
    return `<section class="match-card">
      <div class="match-head">
        <div>
          <div class="match-date">${escapeHtml(match.date)} ${escapeHtml(match.weekday)} ${escapeHtml(match.startTime)}</div>
          <div class="match-id">${escapeHtml(match.matchId)}${match.note ? ` / ${escapeHtml(match.note)}` : ""}</div>
        </div>
        <div class="needed">必要<br>${escapeHtml(match.requiredPlayers)}人</div>
      </div>
      <div class="match-body">
        ${opponentCards(match.opponents)}
        <div class="grid">
          <div>
            <label>回答</label>
            <div class="status-options">
              ${Object.entries(statusLabels).map(([status, info]) => `
                <label class="${info.className}">
                  <input type="radio" name="status_${escapeHtml(match.matchId)}" value="${status}"${current === status ? " checked" : ""}>
                  ${info.mark} ${info.label}
                </label>
              `).join("")}
              <label>
                <input type="radio" name="status_${escapeHtml(match.matchId)}" value=""${current === "" ? " checked" : ""}>
                未回答
              </label>
            </div>
          </div>
          <div>
            <label>メモ</label>
            <textarea name="comment_${escapeHtml(match.matchId)}" placeholder="遅刻、条件付き参加、調整中など">${escapeHtml(response?.comment || "")}</textarea>
          </div>
        </div>
      </div>
    </section>`;
  }).join("");

  return layout("出欠回答", `
    ${saved ? '<div class="panel ok">保存しました。</div>' : ""}
    <section class="panel">
      <h2>回答者</h2>
      <form method="get" action="/">
        <label for="userId">名前</label>
        <select id="userId" name="userId" onchange="this.form.submit()">${memberOptions}</select>
      </form>
    </section>
    <form method="post" action="/responses">
      <input type="hidden" name="userId" value="${escapeHtml(selectedUserId)}">
      ${cards}
      <div class="panel actions">
        <button type="submit"${selectedMember ? "" : " disabled"}>回答を保存</button>
        ${selectedMember ? `<span class="muted">${escapeHtml(selectedMember.displayName)} として回答します。</span>` : '<span class="muted">先に名前を選択してください。</span>'}
      </div>
    </form>
  `);
}

function renderSummaryPage(data, store) {
  const rows = data.matches.map((match) => {
    const counts = countForMatch(match, data.members, store);
    const shortageClass = counts.shortage > 0 ? "bad" : "ok";
    const teams = match.opponents.map((opponent) => `${opponent.team} (${opponent.points || "-"} pt)`).join("<br>");
    return `<tr>
      <td>
        <strong>${escapeHtml(match.date)} ${escapeHtml(match.weekday)}</strong><br>
        <span class="muted">${escapeHtml(match.startTime)} / ${escapeHtml(match.matchId)}</span>
      </td>
      <td>${teams}</td>
      <td>${escapeHtml(match.requiredPlayers)}</td>
      <td class="ok">${counts.available.length}</td>
      <td class="warn">${counts.tentative.length}</td>
      <td class="bad">${counts.unavailable.length}</td>
      <td>${counts.unanswered.length}</td>
      <td class="${shortageClass}">${counts.shortage}</td>
    </tr>`;
  }).join("");

  const detail = data.matches.map((match) => {
    const counts = countForMatch(match, data.members, store);
    return `<section class="panel">
      <h2>${escapeHtml(match.date)} ${escapeHtml(match.startTime)}</h2>
      ${opponentCards(match.opponents)}
      <div class="summary-pills">
        <span class="pill ok">〇 ${counts.available.length}</span>
        <span class="pill warn">△ ${counts.tentative.length}</span>
        <span class="pill bad">× ${counts.unavailable.length}</span>
        <span class="pill">未回答 ${counts.unanswered.length}</span>
        <span class="pill ${counts.shortage > 0 ? "bad" : "ok"}">不足 ${counts.shortage}</span>
      </div>
      <div class="grid" style="margin-top: 14px;">
        <div><strong>〇 参加</strong><br>${escapeHtml(counts.available.join(", ") || "-")}</div>
        <div><strong>△ 未定</strong><br>${escapeHtml(counts.tentative.join(", ") || "-")}</div>
        <div><strong>× 不参加</strong><br>${escapeHtml(counts.unavailable.join(", ") || "-")}</div>
        <div><strong>未回答</strong><br>${escapeHtml(counts.unanswered.join(", ") || "-")}</div>
      </div>
    </section>`;
  }).join("");

  return layout("出欠集計", `
    <section class="panel">
      <h2>日別集計</h2>
      <table>
        <thead>
          <tr>
            <th>開催日</th>
            <th>対戦相手</th>
            <th>必要</th>
            <th>〇</th>
            <th>△</th>
            <th>×</th>
            <th>未回答</th>
            <th>不足</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
    ${detail}
  `);
}

function renderLineupPage(data, store) {
  const cards = data.matches.map((match) => {
    const lineup = getConfirmedLineup(match, data.members, store);
    const counts = countForMatch(match, data.members, store);
    return `<section class="match-card">
      <div class="match-head">
        <div>
          <div class="match-date">${escapeHtml(match.date)} ${escapeHtml(match.weekday)} ${escapeHtml(match.startTime)}</div>
          <div class="match-id">${escapeHtml(match.matchId)}${lineup.updatedAt ? ` / 更新: ${escapeHtml(lineup.updatedAt.slice(0, 16).replace("T", " "))}` : ""}</div>
        </div>
        <div class="needed">確定<br>${lineup.names.length}人</div>
      </div>
      <div class="match-body">
        ${opponentCards(match.opponents)}
        <div class="summary-pills">
          <span class="pill ok">〇 ${counts.available.length}</span>
          <span class="pill warn">△ ${counts.tentative.length}</span>
          <span class="pill bad">× ${counts.unavailable.length}</span>
          <span class="pill">未回答 ${counts.unanswered.length}</span>
        </div>
        <div class="panel" style="box-shadow:none; margin:14px 0 0; background:#fffaf0;">
          <h2>登板確定メンバー</h2>
          <p style="font-size:20px; font-weight:900; margin:0 0 8px;">${escapeHtml(lineup.names.join(" / ") || "未確定")}</p>
          ${lineup.note ? `<p class="muted">${escapeHtml(lineup.note)}</p>` : ""}
        </div>
      </div>
    </section>`;
  }).join("");

  return layout("登板確定", cards);
}

function renderLineupAdminPage(data, store, selectedMatchId = "", saved = false) {
  const selectedMatch = data.matches.find((match) => match.matchId === selectedMatchId) || data.matches[0];
  const lineup = selectedMatch ? getConfirmedLineup(selectedMatch, data.members, store) : { userIds: [], note: "" };
  const counts = selectedMatch ? countForMatch(selectedMatch, data.members, store) : null;

  const matchOptions = data.matches.map((match) => {
    const selected = selectedMatch?.matchId === match.matchId ? " selected" : "";
    const label = `${match.date} ${match.startTime} ${match.matchId}`;
    return `<option value="${escapeHtml(match.matchId)}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");

  const memberRows = data.members.map((member) => {
    const response = selectedMatch ? store.responses[responseKey(selectedMatch.matchId, member.userId)] : null;
    const checked = lineup.userIds.includes(member.userId) ? " checked" : "";
    const responseLabel = response?.status ? `${statusLabels[response.status]?.mark || ""} ${statusLabels[response.status]?.label || ""}` : "未回答";
    return `<label class="lineup-member">
      <input type="checkbox" name="userIds" value="${escapeHtml(member.userId)}"${checked}>
      <span>${escapeHtml(member.displayName)}</span>
      <small>${escapeHtml(responseLabel)}</small>
    </label>`;
  }).join("");

  return layout("登板編集", `
    ${saved ? '<div class="panel ok">登板確定を保存しました。</div>' : ""}
    <section class="panel">
      <h2>対象日</h2>
      <form method="get" action="/admin/lineup">
        <label for="matchId">開催日</label>
        <select id="matchId" name="matchId" onchange="this.form.submit()">${matchOptions}</select>
      </form>
    </section>
    ${selectedMatch ? `<form method="post" action="/admin/lineup">
      <input type="hidden" name="matchId" value="${escapeHtml(selectedMatch.matchId)}">
      <section class="match-card">
        <div class="match-head">
          <div>
            <div class="match-date">${escapeHtml(selectedMatch.date)} ${escapeHtml(selectedMatch.weekday)} ${escapeHtml(selectedMatch.startTime)}</div>
            <div class="match-id">${escapeHtml(selectedMatch.matchId)}</div>
          </div>
          <div class="needed">必要<br>${escapeHtml(selectedMatch.requiredPlayers)}人</div>
        </div>
        <div class="match-body">
          ${opponentCards(selectedMatch.opponents)}
          ${counts ? `<div class="summary-pills">
            <span class="pill ok">〇 ${counts.available.length}</span>
            <span class="pill warn">△ ${counts.tentative.length}</span>
            <span class="pill bad">× ${counts.unavailable.length}</span>
            <span class="pill">未回答 ${counts.unanswered.length}</span>
          </div>` : ""}
          <div class="panel" style="box-shadow:none; margin:14px 0 0;">
            <h2>登板メンバー</h2>
            <div class="lineup-grid">${memberRows}</div>
            <label style="margin-top:14px;">メモ</label>
            <textarea name="note" placeholder="卓割、補欠、連絡事項など">${escapeHtml(lineup.note)}</textarea>
            <div class="actions">
              <button type="submit">登板確定を保存</button>
              <span class="muted">出欠の〇△×を見ながら確定メンバーを選べます。</span>
            </div>
          </div>
        </div>
      </section>
    </form>` : '<section class="panel">開催日がありません。</section>'}
  `);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function send(response, status, content, contentType = "text/html; charset=utf-8") {
  response.writeHead(status, { "content-type": contentType });
  response.end(content);
}

async function handleRequest(request, response) {
  const data = await loadData();
  const store = await loadAttendanceStore(config);
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/") {
    send(response, 200, renderAnswerPage(data, store, url.searchParams.get("userId") || "", url.searchParams.get("saved") === "1"));
    return;
  }

  if (request.method === "GET" && url.pathname === "/summary") {
    send(response, 200, renderSummaryPage(data, store));
    return;
  }

  if (request.method === "GET" && url.pathname === "/lineup") {
    send(response, 200, renderLineupPage(data, store));
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin/lineup") {
    send(response, 200, renderLineupAdminPage(data, store, url.searchParams.get("matchId") || "", url.searchParams.get("saved") === "1"));
    return;
  }

  if (request.method === "POST" && url.pathname === "/responses") {
    const form = new URLSearchParams(await readBody(request));
    const userId = form.get("userId");
    const member = data.members.find((item) => item.userId === userId);

    if (!member) {
      send(response, 400, layout("エラー", '<section class="panel bad">名前を選択してください。</section>'));
      return;
    }

    for (const match of data.matches) {
      const status = form.get(`status_${match.matchId}`);
      const comment = form.get(`comment_${match.matchId}`) || "";
      const key = responseKey(match.matchId, member.userId);

      if (status) {
        store.responses[key] = {
          matchId: match.matchId,
          userId: member.userId,
          displayName: member.displayName,
          status,
          comment,
          updatedAt: new Date().toISOString(),
        };
      } else {
        delete store.responses[key];
      }
    }

    await saveAttendanceStore(config, store);
    response.writeHead(303, { location: `/?userId=${encodeURIComponent(member.userId)}&saved=1` });
    response.end();
    return;
  }

  if (request.method === "POST" && url.pathname === "/admin/lineup") {
    const form = new URLSearchParams(await readBody(request));
    const matchId = form.get("matchId");
    const selected = form.getAll("userIds");
    if (!data.matches.some((match) => match.matchId === matchId)) {
      send(response, 400, layout("エラー", '<section class="panel bad">対象日が見つかりません。</section>'));
      return;
    }

    store.confirmedLineups = store.confirmedLineups || {};
    store.confirmedLineups[matchId] = {
      matchId,
      userIds: selected,
      note: form.get("note") || "",
      updatedAt: new Date().toISOString(),
    };
    await saveAttendanceStore(config, store);
    response.writeHead(303, { location: `/admin/lineup?matchId=${encodeURIComponent(matchId)}&saved=1` });
    response.end();
    return;
  }

  send(response, 404, layout("Not Found", '<section class="panel">ページが見つかりません。</section>'));
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(error);
    send(response, 500, layout("Error", '<section class="panel bad">サーバーエラーが発生しました。</section>'));
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Attendance web app: http://localhost:${port}`);
});
