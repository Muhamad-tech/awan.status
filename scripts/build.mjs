// Builds site/data.json from the "Awan V1 Timeline" database in Notion.
// GitHub Actions runs this every 30 minutes. Only rows ticked "Client sees"
// are published, plus progress per feature. Team names and team notes stay private.
import { mkdirSync, writeFileSync } from "node:fs";

const TOKEN = process.env.NOTION_TOKEN;
const DATA_SOURCE = process.env.TIMELINE_DATA_SOURCE_ID || "11518589-e176-429d-908d-ab949f0c5845";
if (!TOKEN) {
  console.error("NOTION_TOKEN is missing. Add it under Settings → Secrets and variables → Actions.");
  process.exit(1);
}

async function notion(path, body) {
  const res = await fetch(`https://api.notion.com${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function allPages() {
  const pages = [];
  let cursor;
  do {
    const r = await notion(`/v1/data_sources/${DATA_SOURCE}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    pages.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return pages;
}

const plain = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text).join("");

function toRow(page) {
  const p = page.properties;
  const date = p.Dates?.date;
  return {
    name: plain(p.Name),
    start: date?.start?.slice(0, 10) || null,
    end: (date?.end || date?.start || "").slice(0, 10) || null,
    type: p.Type?.select?.name || "",
    milestone: p.Milestone?.select?.name || "",
    owner: p.Owner?.select?.name || "",
    status: p.Status?.status?.name || "Not started",
    client: Boolean(p["Client sees"]?.checkbox),
    progress: p.Progress?.rollup?.number ?? null,
    stories: (p["User stories"]?.relation || []).length,
    notes: plain(p.Notes),
  };
}

const rows = (await allPages()).map(toRow).filter((r) => r.name && r.start);
const byDate = (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end);

const milestones = rows
  .filter((r) => r.client && r.type === "Milestone")
  .sort(byDate)
  .map((r) => ({
    key: r.milestone || r.name,
    name: r.name,
    start: r.start,
    end: r.end,
    status: r.status,
    progress: r.stories ? r.progress : null,
    stories: r.stories,
    notes: r.notes,
  }));

// Progress per feature, from the team's build rows (App and Server together).
const featureMap = new Map();
for (const r of rows.filter((x) => x.type === "Build")) {
  const name = r.name.replace(/ · (App|Server)$/, "").replace(/ \(done before start\)$/, "");
  const f = featureMap.get(name) || { name, milestone: r.milestone, start: r.start, end: r.end, statuses: [], done: 0, total: 0 };
  if (r.start < f.start) f.start = r.start;
  if (r.end > f.end) f.end = r.end;
  f.statuses.push(r.status);
  f.total += r.stories;
  f.done += (r.progress || 0) * r.stories;
  featureMap.set(name, f);
}
const features = [...featureMap.values()].sort(byDate).map((f) => ({
  name: f.name,
  milestone: f.milestone,
  start: f.start,
  end: f.end,
  status: f.statuses.every((s) => s === "Done")
    ? "Done"
    : f.statuses.includes("Late")
      ? "Late"
      : f.statuses.some((s) => s !== "Not started")
        ? "In progress"
        : "Not started",
  progress: f.total ? f.done / f.total : null,
}));

const items = rows
  .filter((r) => r.client && r.type !== "Milestone")
  .sort(byDate)
  .map((r) => ({
    name: r.name,
    type: r.type,
    who: r.owner === "Client" ? "client" : "team",
    milestone: r.milestone,
    start: r.start,
    end: r.end,
    status: r.status,
    notes: r.notes,
  }));

const counted = milestones.filter((m) => m.stories);
const total = counted.reduce((n, m) => n + m.stories, 0);
const done = Math.round(counted.reduce((n, m) => n + (m.progress || 0) * m.stories, 0));

const data = {
  generatedAt: new Date().toISOString(),
  project: {
    title: "Awan · Version 1",
    client: process.env.CLIENT_NAME || "",
    refreshMinutes: 30,
  },
  overall: { done, total, progress: total ? done / total : 0 },
  milestones,
  features,
  items,
};

const out = new URL("../site/data.json", import.meta.url);
mkdirSync(new URL("../site/", import.meta.url), { recursive: true });
writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`Wrote ${milestones.length} milestones, ${features.length} features, ${items.length} dates. ${done}/${total} stories done.`);
