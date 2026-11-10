// The 2026-09-15 fused depth map: camera depth locked to the lidar, placed along the lidar-odometry path.
// Frame: the lidar at the start of the segment; x forward, y left, z up, z = 0 at the lidar's scan plane.
// data/depth-2026-09-15.bin holds int16 millimetre xyz for every point, then uint8 rgb for every point.

import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const REDUCE_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Height ramp: one hue, dark at the floor to light at the top (sequential).
const LOW = new THREE.Color("#173f73"), HIGH = new THREE.Color("#b9d7f8");
const ACCENT = 0xff7a1a;

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#151b21";
}

async function start() {
  const canvas = document.getElementById("depth3d");
  const hint = document.getElementById("depth-hint");
  if (!canvas) return;

  // Load only when the section comes near the screen: the points are 1.7 MB.
  await new Promise((resolve) => {
    if (!("IntersectionObserver" in window)) return resolve();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); resolve(); }
    }, { rootMargin: "600px" });
    io.observe(canvas);
  });

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    hint.textContent = "This browser could not start WebGL, so the 3D view is off.";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  let meta, buf, lidarBuf;
  try {
    meta = await (await fetch("data/depth-2026-09-15.json")).json();
    [buf, lidarBuf] = await Promise.all([
      fetch(meta.files.fused).then((r) => r.arrayBuffer()),
      fetch(meta.files.lidar).then((r) => r.arrayBuffer()),
    ]);
  } catch (e) {
    hint.textContent = "The point data did not load. Open this page from a web server rather than from a file.";
    return;
  }

  const n = meta.points;
  const xyz = new Int16Array(buf, 0, n * 3);
  const rgb = new Uint8Array(buf, n * 6, n * 3);
  const positions = new Float32Array(n * 3);
  const cameraColors = new Float32Array(n * 3);
  const heightColors = new Float32Array(n * 3);
  const floor = meta.floor_z_m, top = 0.8;
  const c = new THREE.Color();
  for (let i = 0; i < n * 3; i += 3) {
    positions[i] = xyz[i] / 1000;
    positions[i + 1] = xyz[i + 1] / 1000;
    positions[i + 2] = xyz[i + 2] / 1000;
    c.setRGB(rgb[i] / 255, rgb[i + 1] / 255, rgb[i + 2] / 255, THREE.SRGBColorSpace);
    cameraColors[i] = c.r; cameraColors[i + 1] = c.g; cameraColors[i + 2] = c.b;
    const t = Math.min(1, Math.max(0, (positions[i + 2] - floor) / (top - floor)));
    c.copy(LOW).lerp(HIGH, t);
    heightColors[i] = c.r; heightColors[i + 1] = c.g; heightColors[i + 2] = c.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const colorAttr = new THREE.BufferAttribute(cameraColors.slice(), 3);
  geometry.setAttribute("color", colorAttr);
  geometry.computeBoundingBox();

  const scene = new THREE.Scene();
  const fused = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.013, vertexColors: true, sizeAttenuation: true }));
  scene.add(fused);

  const m = meta.lidar_points;
  const lxy = new Int16Array(lidarBuf, 0, m * 2);
  const lpos = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) { lpos[i * 3] = lxy[i * 2] / 1000; lpos[i * 3 + 1] = lxy[i * 2 + 1] / 1000; lpos[i * 3 + 2] = 0; }
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
  const lidar = new THREE.Points(lgeo, new THREE.PointsMaterial({ size: 0.02, color: ACCENT, sizeAttenuation: true }));
  scene.add(lidar);

  const pathGroup = new THREE.Group();
  const pathPts = meta.path.map(([x, y]) => new THREE.Vector3(x, y, 0));
  const pathMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  pathGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pathPts), pathMat));
  const startDot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), new THREE.MeshBasicMaterial({ color: ACCENT }));
  startDot.position.copy(pathPts[0]);
  pathGroup.add(startDot);
  scene.add(pathGroup);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.02, 100);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !REDUCE_MOTION;
  controls.dampingFactor = 0.12;
  controls.minDistance = 0.4;
  controls.maxDistance = 14;
  controls.listenToKeyEvents(canvas);

  let needsRender = true;
  const box = geometry.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  center.z = 0;
  // Camera presets. "rover" sits behind the start at roughly the camera's height, looking along the first heading.
  const VIEWS = {
    overview: { pos: center.clone().add(new THREE.Vector3(-2.4, -1.9, 3.4)), aim: center.clone() },
    above: { pos: center.clone().add(new THREE.Vector3(-0.01, 0, 5.6)), aim: center.clone() },
    rover: { pos: new THREE.Vector3(-1.0, 0.1, 0.45), aim: new THREE.Vector3(1.6, -0.3, -0.05) },
  };
  function setView(name) {
    camera.position.copy(VIEWS[name].pos);
    controls.target.copy(VIEWS[name].aim);
    for (const o of document.querySelectorAll("#depth-views button")) o.setAttribute("aria-pressed", o.dataset.view === name ? "true" : "false");
    needsRender = true;
  }
  for (const b of document.querySelectorAll("#depth-views button")) b.addEventListener("click", () => setView(b.dataset.view));

  const setPath = () => { pathMat.color.set(cssColor("--ink")); };
  function applyTheme() {
    scene.background = new THREE.Color(cssColor("--bg-raised"));
    setPath();
    needsRender = true;
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  applyTheme();

  for (const b of document.querySelectorAll("#depth-color button")) {
    b.addEventListener("click", () => {
      for (const o of document.querySelectorAll("#depth-color button")) o.setAttribute("aria-pressed", o === b ? "true" : "false");
      colorAttr.array.set(b.dataset.color === "height" ? heightColors : cameraColors);
      colorAttr.needsUpdate = true;
      needsRender = true;
    });
  }
  const layers = { fused, lidar, path: pathGroup };
  for (const b of document.querySelectorAll("#depth-layers button")) {
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      layers[b.dataset.layer].visible = on;
      needsRender = true;
    });
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  new ResizeObserver(resize).observe(canvas);
  controls.addEventListener("change", () => { needsRender = true; });
  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(canvas);
  resize();
  setView("overview");

  hint.textContent = "Drag to turn, scroll or pinch to zoom, right-drag to pan.";
  document.getElementById("depth-count").textContent = n.toLocaleString("en-US");

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const damped = controls.update();
    if (damped || needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }
  requestAnimationFrame(frame);
}

start();
