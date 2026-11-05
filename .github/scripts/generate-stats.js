const fs = require("node:fs");
const path = require("node:path");

const owner = "FastXSkyline";
const accent = "#FF2323";
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
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
    const languages = await api(repo.languages_url);
    for (const [name, bytes] of Object.entries(languages)) {
      totals.set(name, (totals.get(name) || 0) + bytes);
    }
  }

  const allLanguages = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = allLanguages.slice(0, 8);
  const totalBytes = allLanguages.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
  const redShades = ["#FF2323", "#E51F1F", "#C91B1B", "#AD1717", "#922020", "#7A2929", "#653333", "#503B3B"];

  const styles = `
    text{font-family:Arial,Helvetica,sans-serif}
    .bg{fill:#ffffff;stroke:#d0d7de}
    .title{fill:#1f2328;font-size:27px;font-weight:700}
    .muted{fill:#59636e;font-size:16px}
    .value{fill:#1f2328;font-size:36px;font-weight:700}
    .label{fill:#1f2328;font-size:19px;font-weight:600}
    .accent{fill:${accent}}
    @media(prefers-color-scheme:dark){
      .bg{fill:#0d1117;stroke:#30363d}
      .title,.value,.label{fill:#f0f2f5}
      .muted{fill:#a1aab5}
    }`;

  const statsWidth = 1200;
  const statsHeight = 250;
  const stats = `<svg xmlns="http://www.w3.org/2000/svg" width="${statsWidth}" height="${statsHeight}" viewBox="0 0 ${statsWidth} ${statsHeight}" role="img" aria-label="GitHub profile statistics">
<style>${styles}</style>
<rect class="bg" x="1" y="1" width="1198" height="248" rx="16"/>
<rect class="accent" x="1" y="1" width="8" height="248" rx="4"/>
<text class="title" x="38" y="54">GitHub overview</text>
<rect class="accent" x="38" y="72" width="70" height="4" rx="2"/>
<g transform="translate(38 122)">
  <text class="muted" y="0">PUBLIC REPOSITORIES</text>
  <text class="value" y="48">${repos.length}</text>
  <text class="muted" x="290" y="0">STARS EARNED</text>
  <text class="value" x="290" y="48">${stars}</text>
  <text class="muted" x="580" y="0">FORKS</text>
  <text class="value" x="580" y="48">${forks}</text>
  <text class="muted" x="870" y="0">FOLLOWERS</text>
  <text class="value" x="870" y="48">${user.followers}</text>
</g>
<text class="muted" x="38" y="224">Automatically updated from public GitHub data</text>
</svg>`;

  const barX = 38;
  const barY = 93;
  const barWidth = 1124;
  const barHeight = 16;
  let currentX = barX;

  const segments = top.map(([name, bytes], index) => {
    const width = (bytes / totalBytes) * barWidth;
    const segment = `<rect x="${currentX.toFixed(2)}" y="${barY}" width="${Math.max(width, 1).toFixed(2)}" height="${barHeight}" fill="${redShades[index]}" />`;
    currentX += width;
    return segment;
  }).join("");

  const rows = top.map(([name, bytes], index) => {
    const y = 151 + index * 37;
    const percentage = (bytes / totalBytes) * 100;
    return `<circle cx="48" cy="${y - 6}" r="7" fill="${redShades[index]}"/>
<text class="label" x="70" y="${y}">${esc(name)}</text>
<text class="muted" x="1158" y="${y}" text-anchor="end">${percentage.toFixed(1)}%</text>`;
  }).join("");

  const langsHeight = Math.max(210, 128 + top.length * 37);
  const langs = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${langsHeight}" viewBox="0 0 1200 ${langsHeight}" role="img" aria-label="Most used programming languages">
<style>${styles}</style>
<rect class="bg" x="1" y="1" width="1198" height="${langsHeight - 2}" rx="16"/>
<rect class="accent" x="1" y="1" width="8" height="${langsHeight - 2}" rx="4"/>
<text class="title" x="38" y="53">Most used languages</text>
<defs><clipPath id="language-bar"><rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="8"/></clipPath></defs>
<g clip-path="url(#language-bar)">${segments}</g>
${rows}
</svg>`;

  const out = path.join(process.cwd(), "assets");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "github-stats.svg"), stats);
  fs.writeFileSync(path.join(out, "top-languages.svg"), langs);
  console.log(`Generated red profile cards for ${owner}: ${repos.length} repositories, ${top.length} languages.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
