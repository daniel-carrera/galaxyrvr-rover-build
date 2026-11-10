// The 2026-09-18 lidar map with the mapping drive, the three go-to runs and the keep-outs.
// Map frame: x forward from the start, y to the left, metres. Drawn with +x up and +y to the left,
// so the screen is a rotation of the map, not a mirror. SVG units are millimetres.

const NS = "http://www.w3.org/2000/svg";
const svg = document.getElementById("map2d");
const tip = document.getElementById("map-tip");
const stage = document.getElementById("map-stage");

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function showTip(event, title, detail) {
  tip.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const sub = document.createElement("span");
  sub.textContent = detail;
  tip.append(strong, sub);
  tip.hidden = false;
  const s = stage.getBoundingClientRect();
  const x = event.clientX - s.left + 14, y = event.clientY - s.top + 14;
  tip.style.left = Math.max(8, Math.min(x, s.width - tip.offsetWidth - 8)) + "px";
  tip.style.top = Math.max(8, Math.min(y, s.height - tip.offsetHeight - 8)) + "px";
}
const hideTip = () => { tip.hidden = true; };

function hover(node, title, detail) {
  node.addEventListener("pointermove", (e) => showTip(e, title, detail));
  node.addEventListener("pointerleave", hideTip);
}

async function start() {
  if (!svg) return;
  let map;
  try {
    map = await (await fetch("data/map-2026-09-18.json")).json();
  } catch (e) {
    stage.insertAdjacentHTML("beforeend", '<p class="note">The map data did not load.</p>');
    return;
  }
  const res = map.resolution_m;
  const xMax = map.origin_m[0] + map.width * res;   // grid columns run along x
  const yMax = map.origin_m[1] + map.height * res;  // grid rows run along y
  const W = map.height * res * 1000, H = map.width * res * 1000;
  const P = ([x, y]) => [((yMax - y) * 1000).toFixed(0), ((xMax - x) * 1000).toFixed(0)];
  const pts = (list) => list.map((p) => P(p).join(",")).join(" ");

  svg.setAttribute("viewBox", `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`);

  const defs = el("defs", {}, svg);
  const hatch = el("pattern", { id: "hatch", width: 90, height: 90, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  el("line", { class: "hatch-line", x1: 0, y1: 0, x2: 0, y2: 90 }, hatch);

  el("image", { class: "grid-img", href: map.image, x: 0, y: 0, width: W.toFixed(0), height: H.toFixed(0), preserveAspectRatio: "none" }, svg);

  const layers = {
    route: el("g", { "data-layer": "route" }, svg),
    keepouts: el("g", { "data-layer": "keepouts" }, svg),
    runs: el("g", { "data-layer": "runs" }, svg),
  };

  // Mapping drive
  el("polyline", { class: "route", points: pts(map.route) }, layers.route);
  hover(el("polyline", { class: "hit", points: pts(map.route) }, layers.route),
    "Mapping drive", "Driven by hand while the lidar recorded; its scans make the map.");

  // Keep-outs
  for (const k of map.keepouts) {
    const [cx, cy] = P([k.x, k.y]);
    const c = el("circle", { class: "keepout", cx, cy, r: (k.r * 1000).toFixed(0) }, layers.keepouts);
    hover(c, "Keep-out", k.label);
  }

  // Start
  {
    const [hx, hy] = P(map.home);
    el("path", { class: "home", d: `M${hx} ${+hy - 90} l55 120 h-110 z` }, svg);
    el("text", { class: "home-label", x: +hx + 70, y: +hy + 40 }, svg).textContent = "start";
  }

  // Go-to runs
  const key = document.getElementById("map-key");
  const table = document.getElementById("runs-table");
  for (const a of map.attempts) {
    const cls = "r" + a.n;
    const g = el("g", {}, layers.runs);
    const [gx, gy] = P(a.goal);
    el("circle", { class: "goal", cx: gx, cy: gy, r: 100 }, g);
    el("polyline", { class: "run " + cls, points: pts(a.track) }, g);
    const [sx, sy] = P(a.track[a.track.length - 1]);
    el("circle", { class: "stop " + cls, cx: sx, cy: sy, r: 45 }, g);
    el("text", { class: "goal-label", x: +gx + 130, y: +gy + 45 }, g).textContent = String(a.n);
    const detail = `Goal ${a.distance_m.toFixed(2)} m from the start, reached in ${a.seconds} s. By tape, the rover stopped ${a.tape_mm} mm from it.`;
    hover(el("polyline", { class: "hit", points: pts(a.track) }, g), `Run ${a.n}`, detail);
    hover(el("circle", { class: "hit-goal", cx: gx, cy: gy, r: 140 }, g), `Run ${a.n} goal`, detail);

    const li = document.createElement("li");
    li.innerHTML = `<span class="swatch line"></span>Run ${a.n}`;
    li.querySelector(".swatch").style.background = `var(--run-${a.n})`;
    key.appendChild(li);

    const tr = document.createElement("tr");
    tr.innerHTML = `<td><span class="swatch line"></span> Run ${a.n}</td><td class="num">${a.distance_m.toFixed(2)} m</td>` +
      `<td class="num">${a.seconds} s</td><td class="num">${a.tape_mm} mm</td>`;
    tr.querySelector(".swatch").style.background = `var(--run-${a.n})`;
    tr.querySelector(".swatch").style.display = "inline-block";
    table.appendChild(tr);
  }

  // Scale bar: 1 m
  {
    const x0 = 150, y0 = H - 150;
    el("path", { class: "scale", d: `M${x0} ${y0 - 60} V${y0} H${x0 + 1000} V${y0 - 60}` }, svg);
    el("text", { class: "scale-label", x: x0 + 1040, y: y0 + 15 }, svg).textContent = "1 m";
  }

  for (const b of document.querySelectorAll("#map-layers button")) {
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      const g = layers[b.dataset.layer];
      if (on) g.removeAttribute("hidden"); else g.setAttribute("hidden", "");
      hideTip();
    });
  }
}

start();
