const fs = require("node:fs");
const path = require("node:path");

const owner = "FastXSkyline";
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

async function api(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${url}`);
  return response.json();
}

const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
}[c]));

const palette = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", C: "#555555",
  "C++": "#f34b7d", CSharp: "#178600", Python: "#3572A5",
  HTML: "#e34c26", CSS: "#663399", Java: "#b07219",
  Rust: "#dea584", Go: "#00ADD8", PHP: "#4F5D95",
  Shell: "#89e051", Lua: "#000080", Kotlin: "#A97BFF",
  Swift: "#F05138", Dart: "#00B4AB", Ruby: "#701516",
};

async function main() {
  const user = await api(`https://api.github.com/users/${owner}`);
  let repos = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await api(`https://api.github.com/users/${owner}/repos?per_page=100&sort=updated&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  repos = repos.filter((repo) => !repo.fork && !repo.archived);
  const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const forks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);

  const totals = new Map();
  for (const repo of repos) {
    if (!repo.languages_url) continue;
    const languages = await api(repo.languages_url);
    for (const [name, bytes] of Object.entries(languages)) {
      totals.set(name, (totals.get(name) || 0) + bytes);
    }
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalBytes = top.reduce((sum, item) => sum + item[1], 0) || 1;

  const darkStyles = `
    .bg{fill:#ffffff;stroke:#d0d7de}.title{fill:#1f2328}
    .muted{fill:#59636e}.value{fill:#1f2328}
    @media(prefers-color-scheme:dark){
      .bg{fill:#0d1117;stroke:#30363d}.title,.value{fill:#e6edf3}
      .muted{fill:#8b949e}
    }`;
  const stats = `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="190" viewBox="0 0 860 190" role="img" aria-label="GitHub profile statistics">
<style>${darkStyles}text{font-family:Arial,Helvetica,sans-serif}.title{font-size:19px;font-weight:700}.muted{font-size:12px}.value{font-size:25px;font-weight:700}</style>
<rect class="bg" x="1" y="1" width="858" height="188" rx="10"/>
<text class="title" x="28" y="38">GitHub overview</text>
<g transform="translate(28 76)">
<text class="muted" y="0">PUBLIC REPOSITORIES</text><text class="value" y="38">${repos.length}</text>
<text class="muted" x="210" y="0">STARS EARNED</text><text class="value" x="210" y="38">${stars}</text>
<text class="muted" x="420" y="0">FORKS</text><text class="value" x="420" y="38">${forks}</text>
<text class="muted" x="630" y="0">FOLLOWERS</text><text class="value" x="630" y="38">${user.followers}</text>
</g>
<text class="muted" x="28" y="164">Updated automatically from public GitHub data</text>
</svg>`;

  let x = 28;
  const bars = top.map(([name, bytes]) => {
    const width = (bytes / totalBytes) * 804;
    const segment = `<rect x="${x}" y="68" width="${Math.max(width, 1)}" height="9" fill="${palette[name] || "#8b949e"}"/>`;
    x += width;
    return segment;
  }).join("");
  const rows = top.map(([name, bytes], index) => {
    const y = 108 + index * 25;
    const pct = (bytes / (totalBytes + [...totals.entries()].filter(([n]) => !top.some(([t]) => t === n)).reduce((s, [, b]) => s + b, 0))) * 100;
    const color = palette[name] || "#8b949e";
    return `<circle cx="34" cy="${y - 4}" r="5" fill="${color}"/><text class="label" x="48" y="${y}">${esc(name)}</text><text class="muted" x="820" y="${y}" text-anchor="end">${pct.toFixed(1)}%</text>`;
  }).join("");
  const langs = `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="${Math.max(150, 124 + top.length * 25)}" viewBox="0 0 860 ${Math.max(150, 124 + top.length * 25)}" role="img" aria-label="Most used programming languages">
<style>${darkStyles}text{font-family:Arial,Helvetica,sans-serif}.title{font-size:19px;font-weight:700}.label{fill:#1f2328;font-size:13px}@media(prefers-color-scheme:dark){.label{fill:#e6edf3}}</style>
<rect class="bg" x="1" y="1" width="858" height="${Math.max(148, 122 + top.length * 25)}" rx="10"/>
<text class="title" x="28" y="38">Most used languages</text>
<defs><clipPath id="bar"><rect x="28" y="63" width="804" height="9" rx="4"/></clipPath></defs>
<g clip-path="url(#bar)">${bars}</g>${rows}
</svg>`;

  const out = path.join(process.cwd(), "assets");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "github-stats.svg"), stats);
  fs.writeFileSync(path.join(out, "top-languages.svg"), langs);
  console.log(`Generated stats for ${owner}: ${repos.length} repositories, ${top.length} languages.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
