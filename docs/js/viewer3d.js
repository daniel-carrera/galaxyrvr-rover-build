// The payload in 3D: the two printed plates (STL files written by cad/build_parts.py) and simplified envelopes
// of everything else, placed from the build specification. Units are millimetres.
//
// Model frame, the same as the STL files: X forward, Y toward the rover's left, Z up, Z = 0 on the plate's top face.
// The specification measures x from the plate's front edge toward the rear, so a spec x becomes X = PLATE_L - x.

import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { STLLoader } from "./vendor/STLLoader.js";

const PLATE_L = 179.5;
const REDUCE_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const COLORS = {
  printed: 0xf07a22,
  hardware: 0xb9c1c9,
  boards: 0x3d95f2,
  lidar: 0x3a4149,
};

// Everything that is not printed, from the build specification (spec x, spec y, z ranges).
const ENVELOPES = [
  { layer: "boards", name: "Raspberry Pi 5 and EP-0225", info: "56 × 85 mm board stack, up to 35 mm above the plate", x: [31.63, 87.63], y: [11.1, 96.1], z: [2, 35] },
  { layer: "boards", name: "R3 board and GalaxyRVR shield", info: "68.6 × 53.4 mm, up to 42 mm with cables; sits under the lidar carrier", x: [91.95, 160.55], y: [25.1, 78.5], z: [2, 42] },
  { layer: "boards", name: "Camera bracket footprint", info: "14 × 47.8 mm; the IMX708 camera rides on this bracket at the front", x: [1.195, 15.195], y: [27.6, 75.4], z: [0, 4] },
];
const STANDOFFS = [[104.55, 11], [154.55, 11], [104.55, 84], [154.55, 84]];
const LIDAR = { x: [101.45, 157.05], y: [17.7, 73.3], z: [49, 90.3], center: [129.25, 45.5] };

// How far each layer rises in the exploded view.
const LIFT = { plate: 0, boards: 22, hardware: 48, carrier: 100, lidar: 140 };

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#151b21";
}

function start() {
  const canvas = document.getElementById("viewer");
  const stage = document.getElementById("stage");
  const tip = document.getElementById("tip");
  const hint = document.getElementById("hint");
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
  } catch (e) {
    hint.textContent = "This browser could not start WebGL, so the 3D view is off. The STL and STEP files are linked beside it.";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !REDUCE_MOTION;
  controls.dampingFactor = 0.12;
  controls.minDistance = 90;
  controls.maxDistance = 1400;
  controls.listenToKeyEvents(canvas);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(300, -200, 500);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-300, 250, 150);
  scene.add(fill);

  const groups = {};
  const pickable = [];
  function group(layer) {
    if (!groups[layer]) {
      groups[layer] = new THREE.Group();
      groups[layer].userData.layer = layer;
      scene.add(groups[layer]);
    }
    return groups[layer];
  }

  function edges(geometry, opacity) {
    return new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 25),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity }),
    );
  }

  function addMesh(layer, geometry, material, name, info, lift, edgeOpacity = 0.35) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { name, info, lift, baseColor: material.color.getHex() };
    mesh.add(edges(geometry, edgeOpacity));
    const holder = new THREE.Group();
    holder.userData.lift = lift;
    holder.add(mesh);
    group(layer).add(holder);
    pickable.push(mesh);
    return holder;
  }

  // Envelopes and hardware ----------------------------------------------------------------------

  const boardMaterial = () => new THREE.MeshStandardMaterial({
    color: COLORS.boards, transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.6,
  });
  for (const e of ENVELOPES) {
    const sx = e.x[1] - e.x[0], sy = e.y[1] - e.y[0], sz = e.z[1] - e.z[0];
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(PLATE_L - (e.x[0] + e.x[1]) / 2, (e.y[0] + e.y[1]) / 2, (e.z[0] + e.z[1]) / 2);
    addMesh(e.layer, g, boardMaterial(), e.name, e.info, LIFT.boards, 0.5);
  }

  const hexR = 5.6 / Math.sqrt(3);
  for (const [x, y] of STANDOFFS) {
    const g = new THREE.CylinderGeometry(hexR, hexR, 45, 6);
    g.rotateX(Math.PI / 2);
    g.translate(PLATE_L - x, y, 22.5);
    addMesh("hardware", g, new THREE.MeshStandardMaterial({ color: COLORS.hardware, metalness: 0.55, roughness: 0.35 }),
      "M3 standoff stack", "Metal, 45 mm between the plate and the carrier", LIFT.hardware, 0.25);
  }

  {
    const baseTop = 76;
    const body = new THREE.BoxGeometry(LIDAR.x[1] - LIDAR.x[0], LIDAR.y[1] - LIDAR.y[0], baseTop - LIDAR.z[0]);
    body.translate(PLATE_L - LIDAR.center[0], LIDAR.center[1], (LIDAR.z[0] + baseTop) / 2);
    const material = new THREE.MeshStandardMaterial({ color: COLORS.lidar, roughness: 0.55 });
    const info = "55.6 × 55.6 × 41.3 mm, simplified; its scan plane is 183 mm above the floor and must stay clear";
    addMesh("lidar", body, material, "SLAMTEC RPLIDAR C1", info, LIFT.lidar, 0.5);
    const cap = new THREE.CylinderGeometry(25, 25, LIDAR.z[1] - baseTop, 48);
    cap.rotateX(Math.PI / 2);
    cap.translate(PLATE_L - LIDAR.center[0], LIDAR.center[1], (baseTop + LIDAR.z[1]) / 2);
    addMesh("lidar", cap, material.clone(), "SLAMTEC RPLIDAR C1", info, LIFT.lidar, 0.5);
  }

  // A small arrow at the front, so the model reads the right way round.
  {
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(PLATE_L + 12, 46.5, -3.5), 34, 0xff7a1a, 10, 7);
    scene.add(arrow);
    const label = document.createElement("canvas");
    label.width = 128; label.height = 48;
    const ctx = label.getContext("2d");
    ctx.font = "600 30px system-ui, sans-serif";
    ctx.fillStyle = "#ff7a1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("front", 64, 24);
    const tex = new THREE.CanvasTexture(label);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.scale.set(32, 12, 1);
    sprite.position.set(PLATE_L + 30, 46.5, 10);
    scene.add(sprite);
  }

  // Printed parts ---------------------------------------------------------------------------------

  const loader = new STLLoader();
  const printed = [
    { file: "models/lower-plate.stl", name: "Lower plate (printed)", info: "179.5 × 93 × 7 mm PLA; carries the Pi, the R3 board and the camera bracket", lift: LIFT.plate },
    { file: "models/lidar-carrier.stl", name: "Lidar carrier (printed)", info: "69 × 92 × 4 mm PLA, 45 mm above the plate", lift: LIFT.carrier },
  ];
  for (const p of printed) {
    loader.load(p.file, (geometry) => {
      addMesh("printed", geometry, new THREE.MeshStandardMaterial({ color: COLORS.printed, roughness: 0.72 }), p.name, p.info, p.lift, 0.3);
      needsRender = true;
    }, undefined, () => {
      hint.textContent = "The printed parts did not load. Open this page from a web server rather than from a file.";
    });
  }

  // Views -----------------------------------------------------------------------------------------

  const target = new THREE.Vector3(PLATE_L / 2, 46.5, 35);
  const VIEWS = {
    assembled: { explode: 0, dir: new THREE.Vector3(1.0, 0.95, 0.75), distance: 340 },
    exploded: { explode: 1, dir: new THREE.Vector3(1.0, 0.95, 0.45), distance: 540 },
    top: { explode: 0, dir: new THREE.Vector3(-0.001, 0, 1), distance: 330 },
  };
  let explode = 0, explodeTo = 0, animStart = 0, animFrom = 0;
  let camFrom = null, camTo = null;
  let needsRender = true;

  function setView(name, instant) {
    const v = VIEWS[name];
    explodeTo = v.explode;
    animFrom = explode;
    const aim = target.clone().setZ(v.explode ? 105 : 35);
    const fitted = v.distance * Math.max(1, 1.25 / Math.max(camera.aspect, 0.6));
    const pos = aim.clone().add(v.dir.clone().normalize().multiplyScalar(fitted));
    camFrom = { pos: camera.position.clone(), aim: controls.target.clone() };
    camTo = { pos, aim };
    animStart = performance.now();
    if (instant || REDUCE_MOTION) {
      explode = explodeTo;
      camera.position.copy(pos);
      controls.target.copy(aim);
      camTo = null;
      applyExplode();
    }
    for (const b of document.querySelectorAll("#views button")) {
      b.setAttribute("aria-pressed", b.dataset.view === name ? "true" : "false");
    }
    needsRender = true;
  }

  function applyExplode() {
    for (const g of Object.values(groups)) {
      for (const holder of g.children) {
        if (holder.userData.lift !== undefined) holder.position.z = holder.userData.lift * explode;
      }
    }
  }

  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function animate(now) {
    if (!camTo) return false;
    const t = Math.min(1, (now - animStart) / 700);
    const k = ease(t);
    explode = animFrom + (explodeTo - animFrom) * k;
    camera.position.lerpVectors(camFrom.pos, camTo.pos, k);
    controls.target.lerpVectors(camFrom.aim, camTo.aim, k);
    applyExplode();
    if (t >= 1) camTo = null;
    return true;
  }

  for (const b of document.querySelectorAll("#views button")) {
    b.addEventListener("click", () => setView(b.dataset.view));
  }
  for (const b of document.querySelectorAll("#layers button")) {
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (groups[b.dataset.layer]) groups[b.dataset.layer].visible = on;
      needsRender = true;
    });
  }
  for (const s of document.querySelectorAll("[data-swatch]")) {
    s.style.background = "#" + COLORS[s.dataset.swatch].toString(16).padStart(6, "0");
  }

  // Hover readout -----------------------------------------------------------------------------------

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null, pointerEvent = null;

  function pick() {
    if (!pointerEvent) return;
    const r = canvas.getBoundingClientRect();
    pointer.set(((pointerEvent.clientX - r.left) / r.width) * 2 - 1, -((pointerEvent.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(pickable.filter((m) => m.parent.parent.visible), false);
    const hit = hits.length ? hits[0].object : null;
    if (hit !== hovered) {
      if (hovered) hovered.material.emissive.setHex(0x000000);
      hovered = hit;
      if (hovered) hovered.material.emissive.setHex(0x333333);
      needsRender = true;
    }
    if (hovered) {
      tip.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = hovered.userData.name;
      const sub = document.createElement("span");
      sub.textContent = hovered.userData.info;
      tip.append(strong, sub);
      tip.hidden = false;
      const s = stage.getBoundingClientRect();
      const x = pointerEvent.clientX - s.left + 14, y = pointerEvent.clientY - s.top + 14;
      tip.style.left = Math.min(x, s.width - tip.offsetWidth - 8) + "px";
      tip.style.top = Math.min(y, s.height - tip.offsetHeight - 8) + "px";
    } else {
      tip.hidden = true;
    }
    pointerEvent = null;
  }
  canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") pointerEvent = e; });
  canvas.addEventListener("pointerleave", () => {
    tip.hidden = true;
    if (hovered) { hovered.material.emissive.setHex(0x000000); hovered = null; needsRender = true; }
  });

  // Size, theme, loop --------------------------------------------------------------------------------

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  new ResizeObserver(resize).observe(canvas);

  function applyTheme() {
    scene.background = new THREE.Color(cssColor("--bg-raised"));
    needsRender = true;
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  applyTheme();
  controls.addEventListener("change", () => { needsRender = true; });

  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(canvas);

  resize();
  setView("assembled", true);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const moving = animate(now);
    const damped = controls.update();
    pick();
    if (moving || damped || needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }
  requestAnimationFrame(frame);
}

start();
