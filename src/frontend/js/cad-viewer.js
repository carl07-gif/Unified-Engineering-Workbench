/* ═══════════════════════════════════════════════════════════════
   Realistic 3D Thermal Rod & CAD/ANSYS Engine (Task B)
   High-Fidelity Solid 3D Thermal Rod with Animated Heat Flow,
   Exact Back-Face Culling, Streamline Particles & Flux Vectors
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const CadViewer = (() => {
  let canvas, ctx;
  let stlTriangles = [];
  let ansysNodes = [];
  let displayMode = "both";       // "both", "contour", "cloud", "stl"
  let contourStyle = "smooth";    // "smooth", "bands"
  let rodShape = "cylinder";      // "cylinder", "square"
  let showHeatFlow = true;        // Animated 3D Heat Flow Streamlines
  let showFluxVectors = true;     // Heat Flux Vector Field Arrows
  let showWireframe = true;
  let showProbes = true;
  let showShadow = true;

  // Camera & view transforms (default isometric angle showing 3 faces)
  let rotX = 0.38;    // Pitch angle
  let rotY = -0.62;   // Yaw angle
  let zoom = 320;     // Scale
  let panX = 0;
  let panY = 15;

  let isDragging = false;
  let dragButton = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;

  let minTemp = 20.0, maxTemp = 188.2;
  let maxTempNode = null;
  let minTempNode = null;
  let hoveredNode = null;
  let nodeTooltip, nodeTooltipBody;

  // Geometry dimensions for rod: L = 1.0m, A = 1e-4 m²
  const ROD_L = 1.0;
  const ROD_RADIUS = 0.026;       // Visual aspect ratio tuned for CAD clarity
  const ROD_W = 0.05;             // Square width
  const ROD_H = 0.05;             // Square height
  const NUM_SEGMENTS = 50;        // Longitudinal discretization
  const CYL_SLICES = 28;          // Angular discretization for cylinder

  // Animation state
  let animFrameId = null;
  let animTime = 0;
  const flowParticles = [];
  const NUM_PARTICLES = 50;

  function init(canvasEl) {
    canvas = canvasEl || document.getElementById("cad3DCanvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    nodeTooltip = document.getElementById("nodeTooltip");
    nodeTooltipBody = document.getElementById("nodeTooltipBody");

    initParticles();

    resize();
    window.addEventListener("resize", resize);

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    startAnimation();
  }

  /* ─────────────────────────────────────────────
     Thermal Heat Flow Particle Initialization
     Governed by Fourier's Conduction Law: q_x = -k * dT/dx
     Divide line at x = 0.42m (dT/dx = 0, q_x = 0)
     ───────────────────────────────────────────── */
  function initParticles() {
    flowParticles.length = 0;
    for (let i = 0; i < NUM_PARTICLES; i++) {
      spawnParticle(true);
    }
  }

  function spawnParticle(randomInitialX = false) {
    // 40% flow left towards x=0 (T=100C), 60% flow right towards x=1.0 (T=20C)
    const goLeft = Math.random() < 0.40;
    const theta = Math.random() * Math.PI * 2;
    const speedScale = 0.0035 + Math.random() * 0.003;
    
    let x;
    if (randomInitialX) {
      x = goLeft ? (0.02 + Math.random() * 0.40) : (0.42 + Math.random() * 0.56);
    } else {
      // Spawn right at the thermal generation peak / divide (x = 0.42m)
      x = 0.42 + (Math.random() - 0.5) * 0.04;
    }

    const p = {
      x: x,
      theta: theta,
      goLeft: goLeft,
      speedScale: speedScale,
      tail: [],
      maxTail: 5 + Math.floor(Math.random() * 6),
      life: 0.8 + Math.random() * 0.4
    };
    flowParticles.push(p);
  }

  function updateParticles() {
    for (let i = flowParticles.length - 1; i >= 0; i--) {
      const p = flowParticles[i];
      // Fourier heat flux: |q_x| = |-10 * (420 - 1000*x)|
      const dT_dx = 420.0 - 1000.0 * p.x;
      const fluxMag = Math.abs(-10.0 * dT_dx);
      // Speed accelerates with flux magnitude (slow at peak, fast at boundaries)
      const speed = Math.max(0.0015, (fluxMag / 5800.0) * 0.008 + 0.001) * (p.goLeft ? -1 : 1);
      
      p.x += speed;

      // Check boundary conditions or lifetime expiration
      if (p.x <= 0.005 || p.x >= 0.995) {
        flowParticles.splice(i, 1);
        spawnParticle(false);
      }
    }
    while (flowParticles.length < NUM_PARTICLES) {
      spawnParticle(false);
    }
  }

  function startAnimation() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    function loop(t) {
      animTime = t * 0.001;
      if (showHeatFlow) {
        updateParticles();
      }
      render();
      animFrameId = requestAnimationFrame(loop);
    }
    animFrameId = requestAnimationFrame(loop);
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (rect.width || 600) * dpr;
    canvas.height = (rect.height || 440) * dpr;
  }

  function onMouseDown(e) {
    isDragging = true;
    dragButton = e.button;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDragging) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      if (dragButton === 0) {
        // Orbit Rotate
        rotY += dx * 0.007;
        rotX += dy * 0.007;
        rotX = Math.max(-1.5, Math.min(1.5, rotX));
      } else if (dragButton === 2) {
        // Pan
        panX += dx;
        panY += dy;
      }
    } else {
      checkInspection(mx, my);
    }
  }

  function onMouseUp() {
    isDragging = false;
  }

  function onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    zoom = Math.max(90, Math.min(3000, zoom * zoomFactor));
  }

  function fitToView() {
    rotX = 0.38;
    rotY = -0.62;
    zoom = 320;
    panX = 0;
    panY = 15;
  }

  /* ─────────────────────────────────────────────
     3D Projection & Camera Transforms
     ───────────────────────────────────────────── */
  function project(x, y, z, cx, cy) {
    const ox = x - 0.5;
    const oy = y;
    const oz = z;

    // Yaw (Y-axis)
    const x1 = ox * Math.cos(rotY) + oz * Math.sin(rotY);
    const z1 = -ox * Math.sin(rotY) + oz * Math.cos(rotY);

    // Pitch (X-axis)
    const y2 = oy * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = oy * Math.sin(rotX) + z1 * Math.cos(rotX);

    const cameraDist = 3.2;
    const fov = cameraDist / (cameraDist + z2);

    const sx = cx + (x1 * zoom * fov) + panX;
    const sy = cy - (y2 * zoom * fov) + panY;

    return { x: sx, y: sy, depth: z2, fov };
  }

  // Exact 2D screen winding for Back-Face Culling
  // Returns > 0 if front-facing (CCW), <= 0 if facing away
  function screenWinding(p1, p2, p3) {
    return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  }

  /* ─────────────────────────────────────────────
     ANSYS Standard Jet / Rainbow Colormap
     ───────────────────────────────────────────── */
  function getTemperatureRGB(tNorm) {
    const clamped = Math.max(0, Math.min(1, tNorm));
    if (contourStyle === "bands") {
      const bands = 10;
      const stepped = Math.floor(clamped * (bands - 1)) / (bands - 1);
      return getTemperatureRGBContinuous(stepped);
    }
    return getTemperatureRGBContinuous(clamped);
  }

  function getTemperatureRGBContinuous(val) {
    let r = 0, g = 0, b = 0;
    if (val < 0.2) {
      const f = val / 0.2;
      r = 0; g = Math.round(220 * f); b = 255;
    } else if (val < 0.4) {
      const f = (val - 0.2) / 0.2;
      r = 0; g = 220 + Math.round(35 * (1 - f)); b = Math.round(255 * (1 - f));
    } else if (val < 0.65) {
      const f = (val - 0.4) / 0.25;
      r = Math.round(255 * f); g = 255; b = 0;
    } else if (val < 0.85) {
      const f = (val - 0.65) / 0.2;
      r = 255; g = Math.round(255 * (1 - f * 0.6)); b = 0;
    } else {
      const f = (val - 0.85) / 0.15;
      r = 255; g = Math.round(102 * (1 - f)); b = Math.round(30 * f);
    }
    return { r, g, b };
  }

  function getLitColorString(rgb, shadeFactor) {
    const sf = Math.max(0.25, Math.min(1.4, shadeFactor));
    const r = Math.min(255, Math.round(rgb.r * sf));
    const g = Math.min(255, Math.round(rgb.g * sf));
    const b = Math.min(255, Math.round(rgb.b * sf));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function tempAtX(x) {
    if (ansysNodes.length > 0) {
      let closest = ansysNodes[0];
      let minD = Math.abs(ansysNodes[0].x - x);
      for (let i = 1; i < ansysNodes.length; i++) {
        const d = Math.abs(ansysNodes[i].x - x);
        if (d < minD) { minD = d; closest = ansysNodes[i]; }
      }
      return closest.T;
    }
    // 1D FEA Poisson equation: T(x) = 100 - 80*x + 500*x*(1 - x)
    return 100.0 - 80.0 * x + 500.0 * x * (1.0 - x);
  }

  /* ─────────────────────────────────────────────
     Main 3D Render Loop
     ───────────────────────────────────────────── */
  function render() {
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dark engineering viewport background with subtle center glow
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 90, w / 2, h / 2, w * 0.75);
    bgGrad.addColorStop(0, "#1a1a20");
    bgGrad.addColorStop(1, "#0a0a0d");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Directional light vector in world coordinates
    const lightDir = { x: 0.4, y: 0.8, z: 0.45 };
    const lLen = Math.hypot(lightDir.x, lightDir.y, lightDir.z);
    lightDir.x /= lLen; lightDir.y /= lLen; lightDir.z /= lLen;

    // 1. Ambient Ground Shadow
    if (showShadow) {
      drawGroundShadow(cx, cy);
    }

    // 2. Metric Floor Grid
    drawGroundGrid(cx, cy);

    // Depth-sorted draw list
    const drawables = [];

    // 3. Generate Solid 3D Thermal Rod with Back-Face Culling
    if (displayMode === "both" || displayMode === "contour") {
      if (rodShape === "cylinder") {
        generateSolidCylinder(cx, cy, lightDir, drawables);
      } else {
        generateSolidSquareRod(cx, cy, lightDir, drawables);
      }
    }

    // 4. Custom STL Geometry
    if ((displayMode === "stl" || displayMode === "both") && stlTriangles.length > 0) {
      generateStlMesh(cx, cy, lightDir, drawables);
    }

    // 5. Nodal Spheres (Occlusion Aware)
    if ((displayMode === "both" || displayMode === "cloud") && ansysNodes.length > 0) {
      generateNodalSpheres(cx, cy, drawables);
    }

    // Sort drawables from farthest to closest (Painter's algorithm)
    drawables.sort((a, b) => b.depth - a.depth);
    drawables.forEach(item => item.draw());

    // 6. Draw 3D Heat Flow Streamlines & Moving Thermal Particles
    if (showHeatFlow && (displayMode === "both" || displayMode === "contour")) {
      drawHeatFlowStreamlines(cx, cy);
    }

    // 7. Draw Heat Flux Vector Field Arrows & Thermal Divide Marker
    if (showFluxVectors && (displayMode === "both" || displayMode === "contour")) {
      drawHeatFluxVectorsAndDivide(cx, cy);
    }

    // 8. ANSYS Probe Callouts (Non-overlapping, inside bounds)
    if (showProbes && (displayMode === "both" || displayMode === "contour" || displayMode === "cloud")) {
      drawThermalProbes(cx, cy, w, h);
    }

    // 9. 3D Orientation Triad
    drawOrientationTriad(w, h);

    // 10. Engineering Viewport HUD stats
    drawViewportHUD(w, h);

    ctx.restore();
  }

  /* ─────────────────────────────────────────────
     Ambient Ground Shadow
     ───────────────────────────────────────────── */
  function drawGroundShadow(cx, cy) {
    const floorY = -0.07;
    const p1 = project(0.0, floorY, -0.05, cx, cy);
    const p2 = project(1.0, floorY, -0.05, cx, cy);
    const p3 = project(1.0, floorY, 0.05, cx, cy);
    const p4 = project(0.0, floorY, 0.05, cx, cy);

    const shadowGrad = ctx.createRadialGradient(
      (p1.x + p2.x + p3.x + p4.x) / 4,
      (p1.y + p2.y + p3.y + p4.y) / 4,
      8,
      (p1.x + p2.x + p3.x + p4.x) / 4,
      (p1.y + p2.y + p3.y + p4.y) / 4,
      zoom * 0.95
    );
    shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
    shadowGrad.addColorStop(0.65, "rgba(0, 0, 0, 0.2)");
    shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
  }

  /* ─────────────────────────────────────────────
     Metric Floor Grid
     ───────────────────────────────────────────── */
  function drawGroundGrid(cx, cy) {
    const floorY = -0.07;
    ctx.lineWidth = 0.75;

    for (let gx = 0.0; gx <= 1.0; gx += 0.25) {
      const p1 = project(gx, floorY, -0.22, cx, cy);
      const p2 = project(gx, floorY, 0.22, cx, cy);

      ctx.strokeStyle = gx === 0 || gx === 1.0 ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.font = "10px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillText(`${gx.toFixed(2)} m`, p2.x - 12, p2.y + 12);
    }

    for (let gz = -0.2; gz <= 0.22; gz += 0.14) {
      const p1 = project(-0.08, floorY, gz, cx, cy);
      const p2 = project(1.08, floorY, gz, cx, cy);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  /* ─────────────────────────────────────────────
     Solid Cylindrical Rod Generator (ANSYS Exact)
     Continuous Smooth 3D Extrusion with Lambertian Shading
     and Back-Face Culling
     ───────────────────────────────────────────── */
  function generateSolidCylinder(cx, cy, lightDir, drawables) {
    const dx = ROD_L / NUM_SEGMENTS;
    const r = ROD_RADIUS;
    const dTheta = (Math.PI * 2) / CYL_SLICES;

    // 1. Left End Cap Disk (x = 0)
    const pCapL = project(0, 0, 0, cx, cy);
    const pCapLRef1 = project(0, r, 0, cx, cy);
    const pCapLRef2 = project(0, 0, r, cx, cy);
    const windingCapL = screenWinding(pCapL, pCapLRef1, pCapLRef2);
    if (windingCapL > 0) { // Facing camera
      const t0 = tempAtX(0);
      const nT0 = (t0 - minTemp) / (maxTemp - minTemp || 1);
      const normL = { x: -1, y: 0, z: 0 };
      const dotL = Math.max(0, normL.x * lightDir.x);
      const shadeL = 0.4 + 0.6 * dotL;
      const colL = getLitColorString(getTemperatureRGB(nT0), shadeL);

      drawables.push({
        depth: pCapL.depth,
        draw: () => {
          ctx.fillStyle = colL;
          ctx.beginPath();
          for (let s = 0; s <= CYL_SLICES; s++) {
            const th = s * dTheta;
            const pt = project(0, r * Math.sin(th), r * Math.cos(th), cx, cy);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();
          if (showWireframe) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      });
    }

    // 2. Right End Cap Disk (x = L)
    const pCapR = project(ROD_L, 0, 0, cx, cy);
    const pCapRRef1 = project(ROD_L, 0, r, cx, cy);
    const pCapRRef2 = project(ROD_L, r, 0, cx, cy);
    const windingCapR = screenWinding(pCapR, pCapRRef1, pCapRRef2);
    if (windingCapR > 0) { // Facing camera
      const tL = tempAtX(ROD_L);
      const nTL = (tL - minTemp) / (maxTemp - minTemp || 1);
      const normR = { x: 1, y: 0, z: 0 };
      const dotR = Math.max(0, normR.x * lightDir.x);
      const shadeR = 0.4 + 0.6 * dotR;
      const colR = getLitColorString(getTemperatureRGB(nTL), shadeR);

      drawables.push({
        depth: pCapR.depth,
        draw: () => {
          ctx.fillStyle = colR;
          ctx.beginPath();
          for (let s = 0; s <= CYL_SLICES; s++) {
            const th = s * dTheta;
            const pt = project(ROD_L, r * Math.sin(th), r * Math.cos(th), cx, cy);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();
          if (showWireframe) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      });
    }

    // 3. Cylinder Surface Quads along Length & Angle
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const xA = i * dx;
      const xB = (i + 1) * dx;
      const tA = tempAtX(xA);
      const tB = tempAtX(xB);
      const nTA = (tA - minTemp) / (maxTemp - minTemp || 1);
      const nTB = (tB - minTemp) / (maxTemp - minTemp || 1);
      const rgbA = getTemperatureRGB(nTA);
      const rgbB = getTemperatureRGB(nTB);

      for (let s = 0; s < CYL_SLICES; s++) {
        const th1 = s * dTheta;
        const th2 = (s + 1) * dTheta;
        const thMid = (th1 + th2) / 2;

        const y1 = r * Math.sin(th1), z1 = r * Math.cos(th1);
        const y2 = r * Math.sin(th2), z2 = r * Math.cos(th2);

        // Projected quad corners
        const p1 = project(xA, y1, z1, cx, cy);
        const p2 = project(xB, y1, z1, cx, cy);
        const p3 = project(xB, y2, z2, cx, cy);
        const p4 = project(xA, y2, z2, cx, cy);

        // Strict Back-Face Culling
        const winding = screenWinding(p1, p2, p3);
        if (winding <= 0) continue; // Culled!

        // Cylindrical Normal Vector
        const ny = Math.sin(thMid);
        const nz = Math.cos(thMid);
        const dot = Math.max(0, ny * lightDir.y + nz * lightDir.z);
        // Specular highlight on top curve
        const spec = Math.pow(Math.max(0, ny * lightDir.y + nz * lightDir.z), 16) * 0.35;
        const shade = Math.min(1.4, 0.35 + 0.65 * dot + spec);

        const avgDepth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;

        drawables.push({
          depth: avgDepth,
          draw: () => {
            const colA = getLitColorString(rgbA, shade);
            const colB = getLitColorString(rgbB, shade);

            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, colA);
            grad.addColorStop(1, colB);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.fill();

            if (showWireframe && (i % 5 === 0 || s % 7 === 0)) {
              ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }
    }
  }

  /* ─────────────────────────────────────────────
     Solid Square Rod Generator (Hex Bar)
     Exact 6-Face Back-Face Culling (Zero Translucency Bleed)
     ───────────────────────────────────────────── */
  function generateSolidSquareRod(cx, cy, lightDir, drawables) {
    const dx = ROD_L / NUM_SEGMENTS;
    const halfW = ROD_W / 2;
    const halfH = ROD_H / 2;

    // Face Normals
    const normals = {
      left:   { x: -1, y: 0, z: 0 },
      right:  { x: 1,  y: 0, z: 0 },
      top:    { x: 0,  y: 1, z: 0 },
      bottom: { x: 0, y: -1, z: 0 },
      front:  { x: 0,  y: 0, z: 1 },
      back:   { x: 0,  y: 0, z: -1 }
    };

    function getShade(n) {
      const dot = Math.max(0, n.x * lightDir.x + n.y * lightDir.y + n.z * lightDir.z);
      return 0.35 + 0.65 * dot;
    }

    const topShade = getShade(normals.top) * 1.15;
    const frontShade = getShade(normals.front) * 0.95;
    const bottomShade = getShade(normals.bottom) * 0.45;
    const backShade = getShade(normals.back) * 0.55;
    const leftShade = getShade(normals.left) * 0.85;
    const rightShade = getShade(normals.right) * 0.75;

    // 1. Left End Cap (x = 0)
    const pL1 = project(0, -halfH, -halfW, cx, cy);
    const pL2 = project(0, -halfH, halfW, cx, cy);
    const pL3 = project(0, halfH, halfW, cx, cy);
    const pL4 = project(0, halfH, -halfW, cx, cy);
    if (screenWinding(pL1, pL2, pL3) > 0) {
      const t0 = tempAtX(0);
      const colL = getLitColorString(getTemperatureRGB((t0 - minTemp) / (maxTemp - minTemp || 1)), leftShade);
      drawables.push({
        depth: (pL1.depth + pL2.depth + pL3.depth + pL4.depth) / 4,
        draw: () => {
          ctx.fillStyle = colL;
          ctx.beginPath();
          ctx.moveTo(pL1.x, pL1.y); ctx.lineTo(pL2.x, pL2.y);
          ctx.lineTo(pL3.x, pL3.y); ctx.lineTo(pL4.x, pL4.y);
          ctx.closePath(); ctx.fill();
          if (showWireframe) { ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.stroke(); }
        }
      });
    }

    // 2. Right End Cap (x = L)
    const pR1 = project(ROD_L, -halfH, halfW, cx, cy);
    const pR2 = project(ROD_L, -halfH, -halfW, cx, cy);
    const pR3 = project(ROD_L, halfH, -halfW, cx, cy);
    const pR4 = project(ROD_L, halfH, halfW, cx, cy);
    if (screenWinding(pR1, pR2, pR3) > 0) {
      const tL = tempAtX(ROD_L);
      const colR = getLitColorString(getTemperatureRGB((tL - minTemp) / (maxTemp - minTemp || 1)), rightShade);
      drawables.push({
        depth: (pR1.depth + pR2.depth + pR3.depth + pR4.depth) / 4,
        draw: () => {
          ctx.fillStyle = colR;
          ctx.beginPath();
          ctx.moveTo(pR1.x, pR1.y); ctx.lineTo(pR2.x, pR2.y);
          ctx.lineTo(pR3.x, pR3.y); ctx.lineTo(pR4.x, pR4.y);
          ctx.closePath(); ctx.fill();
          if (showWireframe) { ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.stroke(); }
        }
      });
    }

    // 3. Longitudinal Segments
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const xA = i * dx;
      const xB = (i + 1) * dx;
      const tA = tempAtX(xA);
      const tB = tempAtX(xB);
      const nTA = (tA - minTemp) / (maxTemp - minTemp || 1);
      const nTB = (tB - minTemp) / (maxTemp - minTemp || 1);
      const rgbA = getTemperatureRGB(nTA);
      const rgbB = getTemperatureRGB(nTB);

      // Top Face (y = halfH)
      const t1 = project(xA, halfH, -halfW, cx, cy);
      const t2 = project(xA, halfH, halfW, cx, cy);
      const t3 = project(xB, halfH, halfW, cx, cy);
      const t4 = project(xB, halfH, -halfW, cx, cy);
      if (screenWinding(t1, t2, t3) > 0) {
        drawables.push({
          depth: (t1.depth + t2.depth + t3.depth + t4.depth) / 4,
          draw: () => {
            const grad = ctx.createLinearGradient(t1.x, t1.y, t4.x, t4.y);
            grad.addColorStop(0, getLitColorString(rgbA, topShade));
            grad.addColorStop(1, getLitColorString(rgbB, topShade));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y);
            ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y);
            ctx.closePath(); ctx.fill();
            if (showWireframe) {
              ctx.strokeStyle = "rgba(255,255,255,0.1)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }

      // Front Face (z = halfW)
      const f1 = project(xA, -halfH, halfW, cx, cy);
      const f2 = project(xB, -halfH, halfW, cx, cy);
      const f3 = project(xB, halfH, halfW, cx, cy);
      const f4 = project(xA, halfH, halfW, cx, cy);
      if (screenWinding(f1, f2, f3) > 0) {
        drawables.push({
          depth: (f1.depth + f2.depth + f3.depth + f4.depth) / 4,
          draw: () => {
            const grad = ctx.createLinearGradient(f1.x, f1.y, f2.x, f2.y);
            grad.addColorStop(0, getLitColorString(rgbA, frontShade));
            grad.addColorStop(1, getLitColorString(rgbB, frontShade));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y);
            ctx.lineTo(f3.x, f3.y); ctx.lineTo(f4.x, f4.y);
            ctx.closePath(); ctx.fill();
            if (showWireframe) {
              ctx.strokeStyle = "rgba(255,255,255,0.1)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }

      // Bottom Face (y = -halfH)
      const b1 = project(xA, -halfH, halfW, cx, cy);
      const b2 = project(xA, -halfH, -halfW, cx, cy);
      const b3 = project(xB, -halfH, -halfW, cx, cy);
      const b4 = project(xB, -halfH, halfW, cx, cy);
      if (screenWinding(b1, b2, b3) > 0) {
        drawables.push({
          depth: (b1.depth + b2.depth + b3.depth + b4.depth) / 4,
          draw: () => {
            const grad = ctx.createLinearGradient(b1.x, b1.y, b4.x, b4.y);
            grad.addColorStop(0, getLitColorString(rgbA, bottomShade));
            grad.addColorStop(1, getLitColorString(rgbB, bottomShade));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y);
            ctx.lineTo(b3.x, b3.y); ctx.lineTo(b4.x, b4.y);
            ctx.closePath(); ctx.fill();
          }
        });
      }

      // Back Face (z = -halfW)
      const k1 = project(xB, -halfH, -halfW, cx, cy);
      const k2 = project(xA, -halfH, -halfW, cx, cy);
      const k3 = project(xA, halfH, -halfW, cx, cy);
      const k4 = project(xB, halfH, -halfW, cx, cy);
      if (screenWinding(k1, k2, k3) > 0) {
        drawables.push({
          depth: (k1.depth + k2.depth + k3.depth + k4.depth) / 4,
          draw: () => {
            const grad = ctx.createLinearGradient(k2.x, k2.y, k1.x, k1.y);
            grad.addColorStop(0, getLitColorString(rgbA, backShade));
            grad.addColorStop(1, getLitColorString(rgbB, backShade));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(k1.x, k1.y); ctx.lineTo(k2.x, k2.y);
            ctx.lineTo(k3.x, k3.y); ctx.lineTo(k4.x, k4.y);
            ctx.closePath(); ctx.fill();
          }
        });
      }
    }
  }

  /* ─────────────────────────────────────────────
     STL Mesh Triangles
     ───────────────────────────────────────────── */
  function generateStlMesh(cx, cy, lightDir, drawables) {
    stlTriangles.forEach(t => {
      const p1 = project(t.v1.x, t.v1.y, t.v1.z, cx, cy);
      const p2 = project(t.v2.x, t.v2.y, t.v2.z, cx, cy);
      const p3 = project(t.v3.x, t.v3.y, t.v3.z, cx, cy);
      const winding = screenWinding(p1, p2, p3);
      if (winding <= 0) return; // Back-face cull

      const avgDepth = (p1.depth + p2.depth + p3.depth) / 3;
      drawables.push({
        depth: avgDepth,
        draw: () => {
          ctx.fillStyle = "rgba(70, 150, 240, 0.45)";
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fill();

          if (showWireframe) {
            ctx.strokeStyle = "rgba(120, 190, 255, 0.85)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      });
    });
  }

  /* ─────────────────────────────────────────────
     Realistic Nodal Spheres (Occlusion Aware)
     Rear nodes hidden behind solid front surface
     ───────────────────────────────────────────── */
  function generateNodalSpheres(cx, cy, drawables) {
    ansysNodes.forEach(n => {
      // Test if node is on a forward-facing surface
      const isFrontEdge = (n.z > 0.02);
      const isTopEdge = (n.y > 0.02);
      // Only draw nodes that are on visible edges or if in point cloud mode
      if (displayMode !== "cloud" && !isFrontEdge && !isTopEdge) return;

      const p = project(n.x, n.y - (rodShape === "square" ? ROD_H / 2 : 0), n.z - (rodShape === "square" ? ROD_W / 2 : 0), cx, cy);
      const isHovered = hoveredNode && hoveredNode.id === n.id;
      const isMax = maxTempNode && maxTempNode.id === n.id;
      const isMin = minTempNode && minTempNode.id === n.id;

      const normT = (n.T - minTemp) / (maxTemp - minTemp || 1);
      const rgb = getTemperatureRGB(normT);
      const radius = (isHovered ? 7.5 : (isMax || isMin ? 6 : 4)) * Math.max(0.6, Math.min(1.4, p.fov));

      drawables.push({
        depth: p.depth - 0.01, // Sits cleanly on the surface
        draw: () => {
          // Specular shaded bead
          const grad = ctx.createRadialGradient(
            p.x - radius * 0.35, p.y - radius * 0.35, radius * 0.1,
            p.x, p.y, radius
          );
          grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
          grad.addColorStop(0.35, `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
          grad.addColorStop(0.85, `rgb(${Math.round(rgb.r * 0.7)}, ${Math.round(rgb.g * 0.7)}, ${Math.round(rgb.b * 0.7)})`);
          grad.addColorStop(1.0, "rgba(10, 10, 15, 0.85)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();

          if (isHovered || isMax || isMin) {
            ctx.strokeStyle = isMax ? "#ff3333" : (isMin ? "#3399ff" : "#ffffff");
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      });
    });
  }

  /* ─────────────────────────────────────────────
     Animated 3D Heat Flow Streamlines & Particles
     Physical Heat Conduction Flow: q = -k * dT/dx
     Flows outward from hot spot (x=0.42m) to x=0 and x=1.0m
     ───────────────────────────────────────────── */
  function drawHeatFlowStreamlines(cx, cy) {
    const r = (rodShape === "cylinder" ? ROD_RADIUS : ROD_W / 2) * 1.05;

    flowParticles.forEach(p => {
      // 3D position on visible curved surface
      const y = r * Math.sin(p.theta);
      const z = r * Math.cos(p.theta);
      
      // Only draw particles on the front half (facing camera)
      if (z < -0.005 && rotY < 0) return;

      const pt = project(p.x, y, z, cx, cy);
      const normT = (tempAtX(p.x) - minTemp) / (maxTemp - minTemp || 1);
      const rgb = getTemperatureRGB(normT);

      // Add to particle comet tail
      p.tail.unshift({ x: pt.x, y: pt.y });
      if (p.tail.length > p.maxTail) p.tail.pop();

      // Draw glowing streamline trail
      if (p.tail.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(p.tail[0].x, p.tail[0].y);
        for (let j = 1; j < p.tail.length; j++) {
          ctx.lineTo(p.tail[j].x, p.tail[j].y);
        }
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;
        ctx.lineWidth = 2 * pt.fov;
        ctx.stroke();
      }

      // Draw particle head (bright thermal energy pulse)
      ctx.fillStyle = `rgb(255, 255, 255)`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5 * pt.fov, 0, Math.PI * 2);
      ctx.fill();

      // Outer glow
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5 * pt.fov, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* ─────────────────────────────────────────────
     Heat Flux Vector Field Arrows & Thermal Divide Marker
     Highlights the stagnation plane at x = 0.42m where dT/dx = 0
     ───────────────────────────────────────────── */
  function drawHeatFluxVectorsAndDivide(cx, cy) {
    const r = (rodShape === "cylinder" ? ROD_RADIUS : ROD_W / 2) * 1.15;
    const pulse = 0.5 + 0.5 * Math.sin(animTime * 4.5);

    // 1. Thermal Divide Stagnation Ring (x = 0.42m, dT/dx = 0, q = 0)
    const xDivide = 0.42;
    ctx.strokeStyle = `rgba(255, 100, 50, ${0.6 + 0.4 * pulse})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let s = 0; s <= 24; s++) {
      const th = (s / 24) * Math.PI * 2;
      const pt = project(xDivide, r * Math.sin(th), r * Math.cos(th), cx, cy);
      if (s === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.stroke();

    // Divide text label banner hovering above
    const pDivTop = project(xDivide, r + 0.04, 0, cx, cy);
    ctx.font = "bold 9.5px monospace";
    ctx.fillStyle = "rgba(255, 140, 60, 0.95)";
    ctx.textAlign = "center";
    ctx.fillText("⚡ THERMAL DIVIDE (q_x = 0)", pDivTop.x, pDivTop.y - 12);

    // 2. 3D Heat Flux Vector Field Arrows along Rod
    // dT/dx = 420 - 1000*x => q_x = 10000*x - 4200 W/m²
    const stations = [0.10, 0.25, 0.60, 0.78, 0.92];
    stations.forEach(stX => {
      const q_x = 10000.0 * stX - 4200.0;
      const arrowLenWorld = (q_x / 5800.0) * 0.06; // Arrow length in meters

      const pBase = project(stX, r + 0.015, 0, cx, cy);
      const pTip  = project(stX + arrowLenWorld, r + 0.015, 0, cx, cy);

      const normT = (tempAtX(stX) - minTemp) / (maxTemp - minTemp || 1);
      const rgb = getTemperatureRGB(normT);
      const arrowCol = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

      // Arrow Shaft
      ctx.strokeStyle = arrowCol;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(pBase.x, pBase.y);
      ctx.lineTo(pTip.x, pTip.y);
      ctx.stroke();

      // Arrow Head
      const angle = Math.atan2(pTip.y - pBase.y, pTip.x - pBase.x);
      const headLen = 6.5;
      ctx.fillStyle = arrowCol;
      ctx.beginPath();
      ctx.moveTo(pTip.x, pTip.y);
      ctx.lineTo(pTip.x - headLen * Math.cos(angle - 0.45), pTip.y - headLen * Math.sin(angle - 0.45));
      ctx.lineTo(pTip.x - headLen * Math.cos(angle + 0.45), pTip.y - headLen * Math.sin(angle + 0.45));
      ctx.closePath();
      ctx.fill();
    });
  }

  /* ─────────────────────────────────────────────
     ANSYS Max & Min Thermal Probe Callouts
     Smart Position Clamping (Non-overlapping, inside viewport)
     ───────────────────────────────────────────── */
  function drawThermalProbes(cx, cy, viewW, viewH) {
    if (!maxTempNode || !minTempNode) return;

    // 1. MAX Temp Probe Callout: offset high above rod to avoid covering peak
    const pMax = project(maxTempNode.x, maxTempNode.y, maxTempNode.z, cx, cy);
    drawSmartProbeBanner(pMax.x, pMax.y, `▲ MAX: ${maxTempNode.T.toFixed(1)}°C`, "#e62e00", -55, -55, viewW, viewH);

    // 2. MIN Temp Probe Callout: offset inward to the left of the tip so it's not clipped
    const pMin = project(minTempNode.x, minTempNode.y, minTempNode.z, cx, cy);
    drawSmartProbeBanner(pMin.x, pMin.y, `▼ MIN: ${minTempNode.T.toFixed(1)}°C`, "#1a75ff", -110, -45, viewW, viewH);
  }

  function drawSmartProbeBanner(targetX, targetY, text, color, offsetX, offsetY, viewW, viewH) {
    const boxW = 108;
    const boxH = 22;

    // Clamped coordinates to stay safely inside viewport borders
    let boxX = Math.max(14, Math.min(viewW - boxW - 14, targetX + offsetX));
    let boxY = Math.max(14, Math.min(viewH - boxH - 14, targetY + offsetY));

    // Angled Leader line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(targetX, targetY);
    const anchorX = boxX + (targetX > boxX + boxW / 2 ? boxW : 0);
    const anchorY = boxY + boxH / 2;
    ctx.lineTo(anchorX, anchorY);
    ctx.stroke();

    // Target surface dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Banner box with high-contrast dark glass
    ctx.fillStyle = "rgba(14, 14, 18, 0.94)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2);
  }

  /* ─────────────────────────────────────────────
     3D Orientation Triad (XYZ Compass Gizmo)
     ───────────────────────────────────────────── */
  function drawOrientationTriad(w, h) {
    const triadX = 42;
    const triadY = h - 42;
    const triadLen = 26;

    function transformAxis(ox, oy, oz) {
      const x1 = ox * Math.cos(rotY) + oz * Math.sin(rotY);
      const z1 = -ox * Math.sin(rotY) + oz * Math.cos(rotY);
      const y2 = oy * Math.cos(rotX) - z1 * Math.sin(rotX);
      return { x: triadX + x1 * triadLen, y: triadY - y2 * triadLen, depth: z1 };
    }

    const axes = [
      { p: transformAxis(1, 0, 0), col: "#ff3b30", label: "X" },
      { p: transformAxis(0, 1, 0), col: "#34c759", label: "Y" },
      { p: transformAxis(0, 0, 1), col: "#007aff", label: "Z" }
    ].sort((a, b) => a.p.depth - b.p.depth);

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(triadX, triadY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    axes.forEach(axis => {
      ctx.strokeStyle = axis.col;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(triadX, triadY);
      ctx.lineTo(axis.p.x, axis.p.y);
      ctx.stroke();

      ctx.fillStyle = axis.col;
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(axis.label, axis.p.x, axis.p.y);
    });
  }

  /* ─────────────────────────────────────────────
     Viewport Engineering HUD Stats
     ───────────────────────────────────────────── */
  function drawViewportHUD(w, h) {
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const shapeLabel = rodShape === "cylinder" ? "Cylindrical Solid" : "Square Bar";
    ctx.fillText(`ANSYS FEA 3D Viewport | ${shapeLabel} | L=${ROD_L.toFixed(1)}m | Elements: ${NUM_SEGMENTS}`, 14, 14);
    if (showHeatFlow) {
      ctx.fillStyle = "rgba(255, 160, 80, 0.85)";
      ctx.fillText(`🌊 Heat Flow Active: q = -k·(dT/dx) [Fourier Conduction]`, 14, 28);
    }
  }

  /* ─────────────────────────────────────────────
     Interactive Hover / Probing
     ───────────────────────────────────────────── */
  function checkInspection(mx, my) {
    if (!canvas || !nodeTooltip) return;
    const dpr = window.devicePixelRatio || 1;
    const cx = (canvas.width / dpr) / 2;
    const cy = (canvas.height / dpr) / 2;

    let closestNode = null;
    let minDist = 18;

    ansysNodes.forEach(n => {
      const p = project(n.x, n.y - (rodShape === "square" ? ROD_H / 2 : 0), n.z - (rodShape === "square" ? ROD_W / 2 : 0), cx, cy);
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < minDist) {
        minDist = d;
        closestNode = n;
      }
    });

    if (closestNode) {
      hoveredNode = closestNode;
      nodeTooltip.hidden = false;
      nodeTooltip.style.left = `${mx + 18}px`;
      nodeTooltip.style.top  = `${my + 14}px`;

      const normT = (closestNode.T - minTemp) / (maxTemp - minTemp || 1);
      const rgb = getTemperatureRGB(normT);

      // Compute local conductive flux: q_x = -k * dT/dx
      // dT/dx = 420 - 1000*x => q_x = -10 * (420 - 1000*x)
      const dT_dx = 420.0 - 1000.0 * closestNode.x;
      const flux = -10.0 * dT_dx;

      nodeTooltipBody.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:rgb(${rgb.r},${rgb.g},${rgb.b});"></span>
          <strong>Node ID: ${closestNode.id}</strong>
        </div>
        <div><strong>Coordinates:</strong> (${closestNode.x.toFixed(3)}, ${closestNode.y.toFixed(3)}, ${closestNode.z.toFixed(3)}) m</div>
        <div><strong>Temperature:</strong> <span style="color:#ff8a65; font-size:13px; font-weight:700;">${closestNode.T.toFixed(2)} °C</span></div>
        <div><strong>Heat Flux:</strong> ${flux.toFixed(1)} W/m² (${flux < 0 ? "← Leftward" : "→ Rightward"})</div>
        <div style="font-size:10px; color:rgba(255,255,255,0.6); margin-top:3px;">
          ${closestNode.T >= 180 ? "🔥 Thermal Hot Spot Region" : (closestNode.T <= 25 ? "❄️ Cold Boundary Heat Sink" : "⚡ Steady Internal Conduction")}
        </div>
      `;
    } else if (hoveredNode) {
      hoveredNode = null;
      nodeTooltip.hidden = true;
    }
  }

  /* ─────────────────────────────────────────────
     ASCII STL Parser
     ───────────────────────────────────────────── */
  function loadSTLString(text) {
    try {
      const lines = text.split("\n");
      const tris = [];
      let inSolid = false;
      let solidName = "solid";
      let verts = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const lower = line.toLowerCase();

        if (!inSolid) {
          if (lower.startsWith("solid")) {
            inSolid = true;
            solidName = line.substring(5).trim() || "solid";
            continue;
          } else {
            throw new Error("File must begin with 'solid' keyword.");
          }
        }

        if (lower.startsWith("endsolid")) break;

        if (lower.startsWith("vertex")) {
          const parts = line.split(/\s+/).slice(1).map(Number);
          if (parts.length === 3 && parts.every(Number.isFinite)) {
            verts.push({ x: parts[0], y: parts[1], z: parts[2] });
          }
        }

        if (lower.startsWith("endfacet")) {
          if (verts.length === 3) {
            tris.push({ v1: verts[0], v2: verts[1], v3: verts[2] });
          }
          verts = [];
        }
      }

      if (tris.length === 0) throw new Error("Zero valid triangles found.");
      stlTriangles = tris;
      return { success: true, count: tris.length, name: solidName };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /* ─────────────────────────────────────────────
     ANSYS CSV Parser
     ───────────────────────────────────────────── */
  function loadAnsysCSVString(text) {
    try {
      const lines = text.split("\n");
      const nodes = [];
      let headerFound = false;
      let minT = Infinity, maxT = -Infinity;
      let maxN = null, minN = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;

        if (!headerFound) {
          const lower = line.toLowerCase();
          if (!lower.includes("node_id") || !lower.includes("temperature")) {
            throw new Error("Invalid header: expected 'node_id,x_m,y_m,z_m,temperature_C'");
          }
          headerFound = true;
          continue;
        }

        const parts = line.split(",").map(s => s.trim());
        if (parts.length < 5) continue;

        const id = parseInt(parts[0], 10);
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        const T = parseFloat(parts[4]);

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(T)) {
          throw new Error(`Non-finite numerical data on line ${i + 1}`);
        }

        const nodeObj = { id, x, y, z, T };
        if (T < minT) { minT = T; minN = nodeObj; }
        if (T > maxT) { maxT = T; maxN = nodeObj; }
        nodes.push(nodeObj);
      }

      if (nodes.length === 0) throw new Error("No data rows found in CSV.");
      ansysNodes = nodes;
      minTemp = minT;
      maxTemp = maxT;
      maxTempNode = maxN;
      minTempNode = minN;

      const legMin = document.getElementById("legendMin");
      const legMid = document.getElementById("legendMid");
      const legMax = document.getElementById("legendMax");
      if (legMin && legMid && legMax) {
        legMin.textContent = `${minT.toFixed(1)} °C`;
        legMid.textContent = `${((minT + maxT) / 2).toFixed(1)} °C`;
        legMax.textContent = `${maxT.toFixed(1)} °C`;
      }

      return { success: true, count: nodes.length, minT, maxT };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function setRodShape(shape) {
    rodShape = shape;
  }

  function setHeatFlow(enable) {
    showHeatFlow = enable;
  }

  function setFluxVectors(enable) {
    showFluxVectors = enable;
  }

  function setDisplayMode(mode) {
    displayMode = mode;
  }

  function setContourStyle(style) {
    contourStyle = style;
  }

  function setWireframe(enable) {
    showWireframe = enable;
  }

  function setProbes(enable) {
    showProbes = enable;
  }

  function setShadow(enable) {
    showShadow = enable;
  }

  return {
    init,
    loadSTLString,
    loadAnsysCSVString,
    fitToView,
    setRodShape,
    setHeatFlow,
    setFluxVectors,
    setDisplayMode,
    setContourStyle,
    setWireframe,
    setProbes,
    setShadow
  };
})();
