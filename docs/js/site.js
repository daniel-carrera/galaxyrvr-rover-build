// Theme toggle and the muted clips. The 3D view lives in viewer3d.js.
(function () {
  "use strict";

  function themeToggle() {
    const root = document.documentElement;
    const toggle = document.querySelector(".theme-toggle");
    if (!toggle) return;
    const label = () => {
      const light = root.getAttribute("data-theme") === "light";
      toggle.textContent = light ? "Dark mode" : "Light mode";
      toggle.setAttribute("aria-pressed", light ? "true" : "false");
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", light ? "#f4f6f8" : "#0e1318");
    };
    toggle.hidden = false;
    label();
    toggle.addEventListener("click", () => {
      const light = root.getAttribute("data-theme") !== "light";
      if (light) root.setAttribute("data-theme", "light");
      else root.removeAttribute("data-theme");
      try { localStorage.setItem("theme", light ? "light" : "dark"); } catch (e) { /* not saved */ }
      label();
    });
  }

  // Clips play muted while on screen. Readers who ask for reduced motion get the controls instead.
  function autoplayClips() {
    const clips = document.querySelectorAll("video[data-autoplay]");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const v of clips) {
      v.muted = true;
      v.addEventListener("click", () => { v.controls = true; });
    }
    if (reduce || !("IntersectionObserver" in window)) {
      for (const v of clips) v.controls = true;
      return;
    }
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target;
        if (e.isIntersecting) {
          const p = v.play();
          if (p && p.catch) p.catch(() => { v.controls = true; });
        } else {
          v.pause();
        }
      }
    }, { threshold: 0.4 });
    for (const v of clips) seen.observe(v);
  }

  themeToggle();
  autoplayClips();
})();
