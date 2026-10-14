# Awan · Version 1 · Client status page

A small website where the client follows the Awan Version 1 plan without opening Notion.

- **Source:** the "Awan V1 Timeline" database in Notion. Progress comes from the User Stories (a story marked Done moves the bars).
- **Refresh:** GitHub Actions reads Notion every 30 minutes and republishes the page. Use **Actions → Update status site → Run workflow** for an instant refresh.
- **What is public:** only timeline rows ticked **Client sees**, plus progress per feature. Team names, team notes, prices and GitHub issues are not published.
- **Search engines:** the page asks not to be indexed, but anyone with the link can open it.

## Setup (once)

1. **Notion:** create an internal integration with *Read content* only, at notion.so/profile/integrations. Then open **Awan V1 Timeline** and **User Stories** in Notion and add the integration under ••• → Connections.
2. **GitHub secret:** in this repo, Settings → Secrets and variables → Actions → New repository secret. Name: `NOTION_TOKEN`. Value: the integration's token.
3. **Optional:** Settings → Secrets and variables → Actions → Variables → `CLIENT_NAME` (shown under the title).
4. **Pages:** Settings → Pages → Source: **GitHub Actions**.
5. **First run:** Actions → Update status site → Run workflow. The link appears in the run summary.

## Change what the client sees

Everything is edited in Notion, not here:

- Tick or untick **Client sees** on a timeline row.
- Change **Dates** or **Status** on a row. A late milestone can be set to **Late**.
- Mark user stories **Done** to move the progress bars.

## Files

- `scripts/build.mjs` reads Notion and writes `site/data.json`.
- `site/index.html` draws the page from `data.json`.
- `.github/workflows/status-site.yml` runs both every 30 minutes and publishes to GitHub Pages.
