// Generates the skyline behind every page, in src/assets/: skyline-night.svg and skyline-day.svg.
// Both draw the same city (a far and a near row of buildings, with palm trees in front), in each theme's colours.
// Run `node scripts/skyline.mjs` after changing it; a different seed gives another city.
import { writeFileSync } from 'node:fs'

const W = 1600, H = 240
let seed = 7
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const between = (a, b) => a + rand() * (b - a)
const r = (n) => Math.round(n * 10) / 10

/** One path per building, so a theme can colour them one by one, plus the lit windows. */
function buildings(minW, maxW, minH, maxH, gap) {
  const shapes = [], windows = []
  let x = -10
  while (x < W + 10) {
    const w = between(minW, maxW), h = between(minH, maxH), top = H - h
    let d = `M${r(x)} ${H}V${r(top)}H${r(x + w)}V${H}Z`
    if (rand() < 0.35) { const aw = between(2, 4); d += `M${r(x + w / 2 - aw / 2)} ${r(top)}v${r(-between(10, 28))}h${r(aw)}v${r(28)}Z` }
    else if (rand() < 0.4) { const sw = w * between(0.45, 0.7); d += `M${r(x + (w - sw) / 2)} ${r(top + 1)}v${r(-between(8, 20))}h${r(sw)}v${r(28)}Z` }
    shapes.push(d)
    for (let wy = top + 8; wy < H - 10; wy += 9) for (let wx = x + 5; wx < x + w - 6; wx += 8) if (rand() < 0.07) windows.push([r(wx), r(wy)])
    x += w + between(0, gap)
  }
  return { shapes, windows }
}

function palm(xb, height, lean) {
  const x0 = xb + lean, y0 = H - height
  const trunk = `M${xb} ${H}Q${r(xb + lean * 0.15)} ${r(H - height * 0.5)} ${r(x0)} ${r(y0)}`
  let fronds = ''
  for (const [deg, len, droop] of [[200, 62, 34], [165, 70, 30], [130, 48, 6], [-20, 66, 34], [15, 72, 30], [52, 50, 8], [-88, 30, -6], [250, 40, 24], [-62, 44, 14]]) {
    const a = (deg * Math.PI) / 180
    const tx = x0 + len * Math.cos(a), ty = y0 + len * Math.sin(a) + droop
    const mx = x0 + (len / 2) * Math.cos(a), my = y0 + (len / 2) * Math.sin(a) - len * 0.18
    const nx = -Math.sin(a) * len * 0.26, ny = Math.cos(a) * len * 0.26
    fronds += `M${r(x0)} ${r(y0)}Q${r(mx + nx)} ${r(my + ny)} ${r(tx)} ${r(ty)}Q${r(mx - nx * 0.05)} ${r(my - ny * 0.05 + 7)} ${r(x0)} ${r(y0 + 3)}Z`
  }
  return { trunk, fronds }
}

const far = buildings(34, 84, 60, 150, 8)
const near = buildings(46, 120, 18, 84, 26)
const palms = [palm(150, 175, -26), palm(196, 140, 14), palm(1130, 190, 22), palm(1182, 150, -12), palm(1450, 165, -18)]

const themes = {
  // Dark silhouettes against the sunset, with lit windows
  night: { far: '#2b0f45', windows: '#ffc65c', near: ['#0b0618'], palms: '#0b0618' },
  // Pastel Art Deco buildings in the afternoon haze, lights off
  day: { far: '#a9bde6', windows: null, near: ['#f7a8c4', '#8fd9c9', '#ffd79e', '#b8a6ee', '#fbeee0'], palms: '#24525c' },
}

for (const [name, colours] of Object.entries(themes)) {
  // Spread the colours so neighbours rarely match: 0, 3, 1, 4, 2, ...
  const byColour = colours.near.map((_, c) => near.shapes.filter((_, i) => (i * 3) % colours.near.length === c).join(''))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
  <path fill="${colours.far}" d="${far.shapes.join('')}"/>
${colours.windows ? `  <g fill="${colours.windows}" opacity=".55">${far.windows.map(([x, y]) => `<rect x="${x}" y="${y}" width="3" height="4"/>`).join('')}</g>\n` : ''}${byColour.map((d, c) => `  <path fill="${colours.near[c]}" d="${d}"/>\n`).join('')}  <g fill="none" stroke="${colours.palms}" stroke-width="6" stroke-linecap="round">${palms.map((p) => `<path d="${p.trunk}"/>`).join('')}</g>
  <path fill="${colours.palms}" d="${palms.map((p) => p.fronds).join('')}"/>
</svg>
`
  writeFileSync(new URL(`../src/assets/skyline-${name}.svg`, import.meta.url), svg)
}
