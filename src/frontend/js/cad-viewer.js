/* ═══════════════════════════════════════════════════════════════
   Realistic 3D Thermal Rod & CAD/ANSYS Engine (Task B)
   High-Precision Solid 3D Thermal Rod with Razor-Sharp Feature Edges,
   Animated Surface Heat Flow Streamlines & Fourier Flux Vectors
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const CadViewer = (() => {
  let canvas, ctx;
  let stlTriangles = [];
  let ansysNodes = [];
  let displayMode = "rod";         // "rod", "with_nodes", "cloud", "stl", "overlay"
  let contourStyle = "smooth";     // "smooth", "bands"
  let rodShape = "square";         // "square" (Default, crisp edges), "cylinder"
  let showEdges = true;            // Razor-Sharp Feature Edge Outlines
  let showHeatFlow = true;         // Animated Surface Streamlines
  let showFluxVectors = true;      // Heat Flux Vectors & Thermal Divide
  let showWireframe = true;        // FEA Mesh Grid Lines
  let showProbes = true;           // Min/Max Hot Spot Callouts
  let showShadow = true;           // Ambient Ground Shadow

  // Camera & view transforms (Isometric 3D view showing Top, Front, and End-Cap)
  let rotX = 0.40;    // Pitch
  let rotY = -0.58;   // Yaw
  let zoom = 330;     // Scale
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

  // Dynamic geometry dimensions for uniform rod
  let ROD_L = 1.0;
  let ROD_W = 0.05;              // Cross-section width
  let ROD_H = 0.05;              // Cross-section height
  const ROD_RADIUS = 0.028;        // Equivalent cylinder radius
  let NUM_SEGMENTS = 40;         // Longitudinal FEA elements
  const CYL_SLICES = 32;           // Cylinder angular discretization
  let currentThermalParams = null;

  // Animation state
  let animFrameId = null;
  let animTime = 0;

  // Surface streamline pulses (gliding along rod surfaces)
  const streamlines = [
    { face: "top", offsetZ: 0.0, pulseOffset: 0.0 },
    { face: "top", offsetZ: -0.015, pulseOffset: 0.33 },
    { face: "top", offsetZ: 0.015, pulseOffset: 0.66 },
    { face: "front", offsetY: 0.0, pulseOffset: 0.2 },
    { face: "front", offsetY: 0.015, pulseOffset: 0.5 },
    { face: "front", offsetY: -0.015, pulseOffset: 0.8 }
  ];

  function init(canvasEl) {
    canvas = canvasEl || document.getElementById("cad3DCanvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    nodeTooltip = document.getElementById("nodeTooltip");
    nodeTooltipBody = document.getElementById("nodeTooltipBody");

    resize();
    window.addEventListener("resize", resize);

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    startAnimation();
  }

  function startAnimation() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    function loop(t) {
      animTime = t * 0.001;
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
    rotX = 0.40;
    rotY = -0.58;
    zoom = 330;
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

  // Camera-space normal projection for strict Back-Face Culling
  function isNormalFacingCamera(nx, ny, nz) {
    const x1 = nx * Math.cos(rotY) + nz * Math.sin(rotY);
    const z1 = -nx * Math.sin(rotY) + nz * Math.cos(rotY);
    const z2 = ny * Math.sin(rotX) + z1 * Math.cos(rotX);
    return z2 < -0.01; // Points toward viewer in camera space
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
    if (currentThermalParams) {
      const { L, k, q, T0, TL } = currentThermalParams;
      if (L > 0 && k > 0) {
        return T0 + (TL - T0) * (x / L) + (q / (2.0 * k)) * x * (L - x);
      }
    }
    if (ansysNodes.length > 0) {
      let closest = ansysNodes[0];
      let minD = Math.abs(ansysNodes[0].x - x);
      for (let i = 1; i < ansysNodes.length; i++) {
        const d = Math.abs(ansysNodes[i].x - x);
        if (d < minD) { minD = d; closest = ansysNodes[i]; }
      }
      return closest.T;
    }
    // Analytical 1D FEA: T(x) = 100 - 80*x + 500*x*(1 - x)
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

    // Dark engineering viewport background with subtle vignette
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w * 0.75);
    bgGrad.addColorStop(0, "#181820");
    bgGrad.addColorStop(1, "#0a0a0d");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Directional lighting vector
    const lightDir = { x: 0.45, y: 0.85, z: 0.4 };
    const lLen = Math.hypot(lightDir.x, lightDir.y, lightDir.z);
    lightDir.x /= lLen; lightDir.y /= lLen; lightDir.z /= lLen;

    // 1. Ambient Ground Shadow
    if (showShadow) {
      drawGroundShadow(cx, cy);
    }

    // 2. Metric Floor Grid
    drawGroundGrid(cx, cy);

    // Depth-sorted drawables
    const drawables = [];

    // 3. Render Solid 3D Thermal Rod (Solid Opaque with Crisp Edges)
    if (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay") {
      if (rodShape === "square") {
        generateSolidSquareRod(cx, cy, lightDir, drawables);
      } else {
        generateSolidCylinder(cx, cy, lightDir, drawables);
      }
    }

    // 4. CAD STL Mesh (when in STL or overlay mode)
    if ((displayMode === "stl" || displayMode === "overlay") && stlTriangles.length > 0) {
      generateStlMesh(cx, cy, lightDir, drawables);
    }

    // 5. Nodal Spheres (when in point cloud or with_nodes mode)
    if ((displayMode === "with_nodes" || displayMode === "cloud") && ansysNodes.length > 0) {
      generateNodalSpheres(cx, cy, drawables);
    }

    // Sort all drawables from farthest to nearest (Painter's algorithm)
    drawables.sort((a, b) => b.depth - a.depth);
    drawables.forEach(item => item.draw());

    // 6. Draw Razor-Sharp Feature Edges Over Solid Geometry
    if (showEdges && (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay")) {
      if (rodShape === "square") {
        drawSquareRodEdges(cx, cy);
      } else {
        drawCylinderEdges(cx, cy);
      }
    }

    // 7. Draw Surface Heat Flow Streamlines (Sleek, continuous, non-cluttering)
    if (showHeatFlow && (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay")) {
      drawSurfaceStreamlines(cx, cy);
    }

    // 8. Draw Heat Flux Vectors & Thermal Divide Ring
    if (showFluxVectors && (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay")) {
      drawHeatFluxVectorsAndDivide(cx, cy);
    }

    // 9. ANSYS Hot & Cold Spot Probe Callouts (Guaranteed In-Bounds)
    if (showProbes && displayMode !== "stl") {
      drawThermalProbes(cx, cy, w, h);
    }

    // 10. 3D Orientation Triad
    drawOrientationTriad(w, h);

    // 11. Engineering Viewport HUD Stats
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
    shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.6)");
    shadowGrad.addColorStop(0.65, "rgba(0, 0, 0, 0.18)");
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

      ctx.strokeStyle = gx === 0 || gx === 1.0 ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.05)";
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.font = "10px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
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
     Solid Square Rod Generator (Hex Bar)
     Crisp Opaque Shading with Element Contours
     ───────────────────────────────────────────── */
  function generateSolidSquareRod(cx, cy, lightDir, drawables) {
    const dx = ROD_L / NUM_SEGMENTS;
    const halfW = ROD_W / 2;
    const halfH = ROD_H / 2;

    const normals = {
      left:   { x: -1, y: 0, z: 0 },
      right:  { x: 1,  y: 0, z: 0 },
      top:    { x: 0,  y: 1, z: 0 },
      bottom: { x: 0,  y: -1, z: 0 },
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
    if (isNormalFacingCamera(normals.left.x, normals.left.y, normals.left.z)) {
      const p1 = project(0, -halfH, -halfW, cx, cy);
      const p2 = project(0, -halfH, halfW, cx, cy);
      const p3 = project(0, halfH, halfW, cx, cy);
      const p4 = project(0, halfH, -halfW, cx, cy);
      const t0 = tempAtX(0);
      const col = getLitColorString(getTemperatureRGB((t0 - minTemp) / (maxTemp - minTemp || 1)), leftShade);

      drawables.push({
        depth: (p1.depth + p2.depth + p3.depth + p4.depth) / 4,
        draw: () => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
          ctx.closePath();
          ctx.fill();
        }
      });
    }

    // 2. Right End Cap (x = L)
    if (isNormalFacingCamera(normals.right.x, normals.right.y, normals.right.z)) {
      const p1 = project(ROD_L, -halfH, halfW, cx, cy);
      const p2 = project(ROD_L, -halfH, -halfW, cx, cy);
      const p3 = project(ROD_L, halfH, -halfW, cx, cy);
      const p4 = project(ROD_L, halfH, halfW, cx, cy);
      const tL = tempAtX(ROD_L);
      const col = getLitColorString(getTemperatureRGB((tL - minTemp) / (maxTemp - minTemp || 1)), rightShade);

      drawables.push({
        depth: (p1.depth + p2.depth + p3.depth + p4.depth) / 4,
        draw: () => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
          ctx.closePath();
          ctx.fill();
        }
      });
    }

    // 3. Longitudinal Face Segments (Strict Culling)
    const showTop = isNormalFacingCamera(normals.top.x, normals.top.y, normals.top.z);
    const showFront = isNormalFacingCamera(normals.front.x, normals.front.y, normals.front.z);
    const showBottom = isNormalFacingCamera(normals.bottom.x, normals.bottom.y, normals.bottom.z);
    const showBack = isNormalFacingCamera(normals.back.x, normals.back.y, normals.back.z);

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
      if (showTop) {
        const t1 = project(xA, halfH, -halfW, cx, cy);
        const t2 = project(xA, halfH, halfW, cx, cy);
        const t3 = project(xB, halfH, halfW, cx, cy);
        const t4 = project(xB, halfH, -halfW, cx, cy);
        const d = (t1.depth + t2.depth + t3.depth + t4.depth) / 4;

        drawables.push({
          depth: d,
          draw: () => {
            const grad = ctx.createLinearGradient(t1.x, t1.y, t4.x, t4.y);
            grad.addColorStop(0, getLitColorString(rgbA, topShade));
            grad.addColorStop(1, getLitColorString(rgbB, topShade));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y);
            ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y);
            ctx.closePath();
            ctx.fill();

            if (showWireframe) {
              ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }

      // Front Face (z = halfW)
      if (showFront) {
        const f1 = project(xA, -halfH, halfW, cx, cy);
        const f2 = project(xB, -halfH, halfW, cx, cy);
        const f3 = project(xB, halfH, halfW, cx, cy);
        const f4 = project(xA, halfH, halfW, cx, cy);
        const d = (f1.depth + f2.depth + f3.depth + f4.depth) / 4;

        drawables.push({
          depth: d,
          draw: () => {
            const grad = ctx.createLinearGradient(f1.x, f1.y, f2.x, f2.y);
            grad.addColorStop(0, getLitColorString(rgbA, frontShade));
            grad.addColorStop(1, getLitColorString(rgbB, frontShade));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y);
            ctx.lineTo(f3.x, f3.y); ctx.lineTo(f4.x, f4.y);
            ctx.closePath();
            ctx.fill();

            if (showWireframe) {
              ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }

      // Bottom Face (y = -halfH)
      if (showBottom) {
        const b1 = project(xA, -halfH, halfW, cx, cy);
        const b2 = project(xA, -halfH, -halfW, cx, cy);
        const b3 = project(xB, -halfH, -halfW, cx, cy);
        const b4 = project(xB, -halfH, halfW, cx, cy);
        const d = (b1.depth + b2.depth + b3.depth + b4.depth) / 4;

        drawables.push({
          depth: d,
          draw: () => {
            const grad = ctx.createLinearGradient(b1.x, b1.y, b4.x, b4.y);
            grad.addColorStop(0, getLitColorString(rgbA, bottomShade));
            grad.addColorStop(1, getLitColorString(rgbB, bottomShade));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y);
            ctx.lineTo(b3.x, b3.y); ctx.lineTo(b4.x, b4.y);
            ctx.closePath();
            ctx.fill();
          }
        });
      }

      // Back Face (z = -halfW)
      if (showBack) {
        const k1 = project(xB, -halfH, -halfW, cx, cy);
        const k2 = project(xA, -halfH, -halfW, cx, cy);
        const k3 = project(xA, halfH, -halfW, cx, cy);
        const k4 = project(xB, halfH, -halfW, cx, cy);
        const d = (k1.depth + k2.depth + k3.depth + k4.depth) / 4;

        drawables.push({
          depth: d,
          draw: () => {
            const grad = ctx.createLinearGradient(k2.x, k2.y, k1.x, k1.y);
            grad.addColorStop(0, getLitColorString(rgbA, backShade));
            grad.addColorStop(1, getLitColorString(rgbB, backShade));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(k1.x, k1.y); ctx.lineTo(k2.x, k2.y);
            ctx.lineTo(k3.x, k3.y); ctx.lineTo(k4.x, k4.y);
            ctx.closePath();
            ctx.fill();
          }
        });
      }
    }
  }

  /* ─────────────────────────────────────────────
     Razor-Sharp Feature Edge Outlines (Square Rod)
     Draws crisp, high-contrast engineering silhouette lines
     ───────────────────────────────────────────── */
  function drawSquareRodEdges(cx, cy) {
    const halfW = ROD_W / 2;
    const halfH = ROD_H / 2;

    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    ctx.lineWidth = 1.75;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 1. Top-Front Ridge (Prominent feature edge)
    const pTF1 = project(0, halfH, halfW, cx, cy);
    const pTF2 = project(ROD_L, halfH, halfW, cx, cy);
    ctx.beginPath();
    ctx.moveTo(pTF1.x, pTF1.y);
    ctx.lineTo(pTF2.x, pTF2.y);
    ctx.stroke();

    // 2. Top-Back Ridge
    const pTB1 = project(0, halfH, -halfW, cx, cy);
    const pTB2 = project(ROD_L, halfH, -halfW, cx, cy);
    ctx.beginPath();
    ctx.moveTo(pTB1.x, pTB1.y);
    ctx.lineTo(pTB2.x, pTB2.y);
    ctx.stroke();

    // 3. Bottom-Front Ridge
    const pBF1 = project(0, -halfH, halfW, cx, cy);
    const pBF2 = project(ROD_L, -halfH, halfW, cx, cy);
    ctx.beginPath();
    ctx.moveTo(pBF1.x, pBF1.y);
    ctx.lineTo(pBF2.x, pBF2.y);
    ctx.stroke();

    // 4. End Cap Perimeter Contours
    function drawCapPerimeter(xPos) {
      const c1 = project(xPos, -halfH, -halfW, cx, cy);
      const c2 = project(xPos, -halfH, halfW, cx, cy);
      const c3 = project(xPos, halfH, halfW, cx, cy);
      const c4 = project(xPos, halfH, -halfW, cx, cy);

      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.lineTo(c4.x, c4.y);
      ctx.closePath();
      ctx.stroke();
    }

    if (isNormalFacingCamera(-1, 0, 0)) drawCapPerimeter(0);
    if (isNormalFacingCamera(1, 0, 0)) drawCapPerimeter(ROD_L);

    // Subtle highlighted inner specular ridge
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pTF1.x, pTF1.y - 1);
    ctx.lineTo(pTF2.x, pTF2.y - 1);
    ctx.stroke();
  }

  /* ─────────────────────────────────────────────
     Solid Cylindrical Rod Generator (Fixed Camera Culling)
     ───────────────────────────────────────────── */
  function generateSolidCylinder(cx, cy, lightDir, drawables) {
    const dx = ROD_L / NUM_SEGMENTS;
    const r = ROD_RADIUS;
    const dTheta = (Math.PI * 2) / CYL_SLICES;

    // End caps
    if (isNormalFacingCamera(-1, 0, 0)) {
      const pCap = project(0, 0, 0, cx, cy);
      const t0 = tempAtX(0);
      const col = getLitColorString(getTemperatureRGB((t0 - minTemp) / (maxTemp - minTemp || 1)), 0.75);

      drawables.push({
        depth: pCap.depth,
        draw: () => {
          ctx.fillStyle = col;
          ctx.beginPath();
          for (let s = 0; s <= CYL_SLICES; s++) {
            const th = s * dTheta;
            const pt = project(0, r * Math.sin(th), r * Math.cos(th), cx, cy);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();
        }
      });
    }

    if (isNormalFacingCamera(1, 0, 0)) {
      const pCap = project(ROD_L, 0, 0, cx, cy);
      const tL = tempAtX(ROD_L);
      const col = getLitColorString(getTemperatureRGB((tL - minTemp) / (maxTemp - minTemp || 1)), 0.7);

      drawables.push({
        depth: pCap.depth,
        draw: () => {
          ctx.fillStyle = col;
          ctx.beginPath();
          for (let s = 0; s <= CYL_SLICES; s++) {
            const th = s * dTheta;
            const pt = project(ROD_L, r * Math.sin(th), r * Math.cos(th), cx, cy);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();
        }
      });
    }

    // Cylindrical Strips (3D Camera Space Normal Check)
    for (let s = 0; s < CYL_SLICES; s++) {
      const th1 = s * dTheta;
      const th2 = (s + 1) * dTheta;
      const thMid = (th1 + th2) / 2;

      const ny = Math.sin(thMid);
      const nz = Math.cos(thMid);
      if (!isNormalFacingCamera(0, ny, nz)) continue; // Culled rear half

      const dot = Math.max(0, ny * lightDir.y + nz * lightDir.z);
      const spec = Math.pow(Math.max(0, ny * lightDir.y + nz * lightDir.z), 12) * 0.35;
      const shade = Math.min(1.35, 0.35 + 0.65 * dot + spec);

      const y1 = r * Math.sin(th1), z1 = r * Math.cos(th1);
      const y2 = r * Math.sin(th2), z2 = r * Math.cos(th2);

      for (let i = 0; i < NUM_SEGMENTS; i++) {
        const xA = i * dx;
        const xB = (i + 1) * dx;
        const tA = tempAtX(xA);
        const tB = tempAtX(xB);
        const rgbA = getTemperatureRGB((tA - minTemp) / (maxTemp - minTemp || 1));
        const rgbB = getTemperatureRGB((tB - minTemp) / (maxTemp - minTemp || 1));

        const p1 = project(xA, y1, z1, cx, cy);
        const p2 = project(xB, y1, z1, cx, cy);
        const p3 = project(xB, y2, z2, cx, cy);
        const p4 = project(xA, y2, z2, cx, cy);
        const d = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;

        drawables.push({
          depth: d,
          draw: () => {
            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, getLitColorString(rgbA, shade));
            grad.addColorStop(1, getLitColorString(rgbB, shade));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.fill();

            if (showWireframe && (i % 4 === 0)) {
              ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }
    }
  }

  function drawCylinderEdges(cx, cy) {
    const r = ROD_RADIUS;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    ctx.lineWidth = 1.6;

    // Top silhouette horizon
    const pT1 = project(0, r, 0, cx, cy);
    const pT2 = project(ROD_L, r, 0, cx, cy);
    ctx.beginPath();
    ctx.moveTo(pT1.x, pT1.y);
    ctx.lineTo(pT2.x, pT2.y);
    ctx.stroke();

    // Bottom silhouette horizon
    const pB1 = project(0, -r, 0, cx, cy);
    const pB2 = project(ROD_L, -r, 0, cx, cy);
    ctx.beginPath();
    ctx.moveTo(pB1.x, pB1.y);
    ctx.lineTo(pB2.x, pB2.y);
    ctx.stroke();

    // Circular rims
    function drawRim(xPos) {
      ctx.beginPath();
      for (let s = 0; s <= CYL_SLICES; s++) {
        const th = (s / CYL_SLICES) * Math.PI * 2;
        const pt = project(xPos, r * Math.sin(th), r * Math.cos(th), cx, cy);
        if (s === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    drawRim(0);
    drawRim(ROD_L);
  }

  /* ─────────────────────────────────────────────
     CAD STL Mesh
     ───────────────────────────────────────────── */
  function generateStlMesh(cx, cy, lightDir, drawables) {
    stlTriangles.forEach(t => {
      const p1 = project(t.v1.x, t.v1.y, t.v1.z, cx, cy);
      const p2 = project(t.v2.x, t.v2.y, t.v2.z, cx, cy);
      const p3 = project(t.v3.x, t.v3.y, t.v3.z, cx, cy);

      // Face normal
      const e1 = { x: t.v2.x - t.v1.x, y: t.v2.y - t.v1.y, z: t.v2.z - t.v1.z };
      const e2 = { x: t.v3.x - t.v1.x, y: t.v3.y - t.v1.y, z: t.v3.z - t.v1.z };
      const nx = e1.y * e2.z - e1.z * e2.y;
      const ny = e1.z * e2.x - e1.x * e2.z;
      const nz = e1.x * e2.y - e1.y * e2.x;

      if (!isNormalFacingCamera(nx, ny, nz)) return; // Cull

      const avgDepth = (p1.depth + p2.depth + p3.depth) / 3;
      drawables.push({
        depth: avgDepth,
        draw: () => {
          ctx.fillStyle = "rgba(60, 140, 230, 0.4)";
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y); ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = "rgba(100, 180, 255, 0.75)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    });
  }

  /* ─────────────────────────────────────────────
     Realistic Nodal Spheres (Occlusion Aware)
     ───────────────────────────────────────────── */
  function generateNodalSpheres(cx, cy, drawables) {
    ansysNodes.forEach(n => {
      const isTop = (n.y >= 0.025);
      const isFront = (n.z >= 0.025);
      if (displayMode !== "cloud" && !isTop && !isFront) return;

      const p = project(n.x, n.y - (rodShape === "square" ? ROD_H / 2 : 0), n.z - (rodShape === "square" ? ROD_W / 2 : 0), cx, cy);
      const isHovered = hoveredNode && hoveredNode.id === n.id;
      const isMax = maxTempNode && maxTempNode.id === n.id;
      const isMin = minTempNode && minTempNode.id === n.id;

      const normT = (n.T - minTemp) / (maxTemp - minTemp || 1);
      const rgb = getTemperatureRGB(normT);
      const radius = (isHovered ? 6.5 : (isMax || isMin ? 5.5 : 3.5)) * Math.max(0.6, Math.min(1.4, p.fov));

      drawables.push({
        depth: p.depth - 0.005,
        draw: () => {
          const grad = ctx.createRadialGradient(
            p.x - radius * 0.35, p.y - radius * 0.35, radius * 0.1,
            p.x, p.y, radius
          );
          grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
          grad.addColorStop(0.35, `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
          grad.addColorStop(1.0, "rgba(10, 10, 15, 0.85)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();

          if (isHovered || isMax || isMin) {
            ctx.strokeStyle = isMax ? "#ff3333" : (isMin ? "#3399ff" : "#ffffff");
            ctx.lineWidth = 1.75;
            ctx.stroke();
          }
        }
      });
    });
  }

  /* ─────────────────────────────────────────────
     Sleek Surface Heat Flow Streamlines
     Smooth continuous streamlines following Fourier Flux q = -k*dT/dx
     Gliding from hot zone (x=0.42m) outward to both ends
     ───────────────────────────────────────────── */
  function drawSurfaceStreamlines(cx, cy) {
    const halfW = ROD_W / 2;
    const halfH = ROD_H / 2;
    const xDivide = 0.42;

    if (rodShape === "cylinder") {
      const angles = [Math.PI * 0.48, Math.PI * 0.28, Math.PI * 0.08];
      angles.forEach((ang, idx) => {
        const coordY = ROD_RADIUS * Math.sin(ang) * 1.01;
        const coordZ = ROD_RADIUS * Math.cos(ang) * 1.01;
        drawStreamlineRibbon(cx, cy, coordY, coordZ, true, (idx * 0.33));
      });
    } else {
      streamlines.forEach(st => {
        // Streamline tracks along Top face
        if (st.face === "top" && isNormalFacingCamera(0, 1, 0)) {
          drawStreamlineRibbon(cx, cy, halfH, st.offsetZ, true, st.pulseOffset);
        }
        // Streamline tracks along Front face
        else if (st.face === "front" && isNormalFacingCamera(0, 0, 1)) {
          drawStreamlineRibbon(cx, cy, st.offsetY, halfW, false, st.pulseOffset);
        }
      });
    }

    function drawStreamlineRibbon(cx, cy, coordY, coordZ, isTop, pulsePhase) {
      // 1. Subtle baseline streamline path
      ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let step = 0; step <= 25; step++) {
        const sx = step / 25;
        const pt = project(sx, coordY, coordZ, cx, cy);
        if (step === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // 2. Animated Heat Flow Pulse Gliding Left (towards x = 0, T = 100°C)
      const tLeft = (animTime * 0.38 + pulsePhase) % 1.0;
      const pulseLeftX = xDivide * (1.0 - tLeft); // moves 0.42 -> 0.0
      const ptL = project(pulseLeftX, coordY, coordZ, cx, cy);
      const rgbL = getTemperatureRGB((tempAtX(pulseLeftX) - minTemp) / (maxTemp - minTemp || 1));

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ptL.x, ptL.y, 2.4 * ptL.fov, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${rgbL.r}, ${rgbL.g}, ${rgbL.b}, 0.75)`;
      ctx.beginPath();
      ctx.arc(ptL.x, ptL.y, 4.8 * ptL.fov, 0, Math.PI * 2);
      ctx.fill();

      // 3. Animated Heat Flow Pulse Gliding Right (towards x = 1.0, T = 20°C)
      const tRight = (animTime * 0.38 + pulsePhase) % 1.0;
      const pulseRightX = xDivide + (1.0 - xDivide) * tRight; // moves 0.42 -> 1.0
      const ptR = project(pulseRightX, coordY, coordZ, cx, cy);
      const rgbR = getTemperatureRGB((tempAtX(pulseRightX) - minTemp) / (maxTemp - minTemp || 1));

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ptR.x, ptR.y, 2.4 * ptR.fov, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${rgbR.r}, ${rgbR.g}, ${rgbR.b}, 0.75)`;
      ctx.beginPath();
      ctx.arc(ptR.x, ptR.y, 4.8 * ptR.fov, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ─────────────────────────────────────────────
     Animated Flowing Heat Flux Vectors & Thermal Divide Ring
     Active real-time Fourier Conduction flow: q_x = -k*(dT/dx)
     Arrows continuously glide from hot spot (x=0.42) outwards
     ───────────────────────────────────────────── */
  function drawHeatFluxVectorsAndDivide(cx, cy) {
    const halfW = ROD_W / 2;
    const halfH = ROD_H / 2;
    const xDivide = 0.42;
    const pulse = 0.5 + 0.5 * Math.sin(animTime * 4.0);

    // 1. Thermal Divide Stagnation Line / Ring (q_x = 0, dT/dx = 0)
    const ringRadius = rodShape === "cylinder" ? ROD_RADIUS * 1.05 : halfH * 1.05;
    if (rodShape === "cylinder") {
      ctx.strokeStyle = `rgba(255, 110, 50, ${0.75 + 0.25 * pulse})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let s = 0; s <= 24; s++) {
        const th = (s / 24) * Math.PI * 2;
        const pt = project(xDivide, ringRadius * Math.sin(th), ringRadius * Math.cos(th), cx, cy);
        if (s === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    } else {
      const p1 = project(xDivide, -halfH * 1.05, halfW * 1.05, cx, cy);
      const p2 = project(xDivide, halfH * 1.05, halfW * 1.05, cx, cy);
      const p3 = project(xDivide, halfH * 1.05, -halfW * 1.05, cx, cy);

      ctx.strokeStyle = `rgba(255, 110, 50, ${0.7 + 0.3 * pulse})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();
    }

    // 2. Continuous Animated Flowing 3D Heat Flux Vector Arrows
    // Heat conducts from hot zone (x=0.42) outwards to both cold ends:
    // Left Stream: 3 continuously gliding arrows flowing towards x = 0 (100°C)
    // Right Stream: 4 continuously gliding arrows flowing towards x = 1.0 (20°C)
    const ridgeY = rodShape === "cylinder" ? ROD_RADIUS * 1.06 : halfH + 0.008;
    const ridgeZ = rodShape === "cylinder" ? ROD_RADIUS * 0.25 : halfW;

    // A. Left Flow Arrows (gliding from x = 0.42 down to 0.02)
    const leftOffsets = [0.0, 0.333, 0.666];
    leftOffsets.forEach(offset => {
      const phase = (animTime * 0.28 + offset) % 1.0;
      const stX = xDivide * (1.0 - phase * 0.94) + 0.02;
      const q_x = 10000.0 * stX - 4200.0; // negative, pointing left towards 0
      const arrowLenWorld = (q_x / 5800.0) * 0.048; // negative length (leftward)
      const alpha = Math.sin(phase * Math.PI); // smooth fade in and fade out

      drawFlowVector(stX, arrowLenWorld, ridgeY, ridgeZ, alpha, cx, cy);
    });

    // B. Right Flow Arrows (gliding from x = 0.42 up to 0.98)
    const rightOffsets = [0.0, 0.25, 0.50, 0.75];
    rightOffsets.forEach(offset => {
      const phase = (animTime * 0.28 + offset) % 1.0;
      const stX = xDivide + (0.98 - xDivide) * (phase * 0.96);
      const q_x = 10000.0 * stX - 4200.0; // positive, pointing right towards 1.0
      const arrowLenWorld = (q_x / 5800.0) * 0.048; // positive length (rightward)
      const alpha = Math.sin(phase * Math.PI); // smooth fade in and fade out

      drawFlowVector(stX, arrowLenWorld, ridgeY, ridgeZ, alpha, cx, cy);
    });

    function drawFlowVector(stX, arrowLenWorld, yPos, zPos, alpha, cx, cy) {
      if (alpha <= 0.06) return;

      const pBase = project(stX, yPos, zPos, cx, cy);
      const pTip  = project(stX + arrowLenWorld, yPos, zPos, cx, cy);

      const normT = (tempAtX(stX) - minTemp) / (maxTemp - minTemp || 1);
      const rgb = getTemperatureRGB(normT);
      const col = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(2)})`;

      // Shaft
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(pBase.x, pBase.y);
      ctx.lineTo(pTip.x, pTip.y);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(pTip.y - pBase.y, pTip.x - pBase.x);
      const hLen = 7.5;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(pTip.x, pTip.y);
      ctx.lineTo(pTip.x - hLen * Math.cos(angle - 0.42), pTip.y - hLen * Math.sin(angle - 0.42));
      ctx.lineTo(pTip.x - hLen * Math.cos(angle + 0.42), pTip.y - hLen * Math.sin(angle + 0.42));
      ctx.closePath();
      ctx.fill();

      // Luminous energy bead at the arrowhead tip
      ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.95).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(pTip.x, pTip.y, 2.2 * pTip.fov, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ─────────────────────────────────────────────
/* ─────────────────────────────────────────────
     ANSYS Hot & Cold Spot Probe Callouts
     Guaranteed In-Bounds Clamping (Never Cut Off, Never Covering Rod)
     ───────────────────────────────────────────── */
  function drawThermalProbes(cx, cy, viewW, viewH) {
    if (!maxTempNode || !minTempNode) return;

    // 1. MAX Temp Probe Callout: placed well above rod with clean angled leader line
    const pMax = project(maxTempNode.x, maxTempNode.y - (rodShape === "square" ? ROD_H / 2 : 0), maxTempNode.z - (rodShape === "square" ? ROD_W / 2 : 0), cx, cy);
    drawSmartProbeBanner(pMax.x, pMax.y, `▲ MAX: ${maxTempNode.T.toFixed(1)}°C`, "#e62e00", -50, -85, viewW, viewH);

    // 2. MIN Temp Probe Callout: placed below rod to strictly avoid colorbar on top-right
    const pMin = project(minTempNode.x, minTempNode.y + (rodShape === "square" ? ROD_H / 2 : 0), minTempNode.z + (rodShape === "square" ? ROD_W / 2 : 0), cx, cy);
    const minOffsetX = (pMin.x > viewW / 2) ? -120 : 25;
    drawSmartProbeBanner(pMin.x, pMin.y, `▼ MIN: ${minTempNode.T.toFixed(1)}°C`, "#1a75ff", minOffsetX, 45, viewW, viewH);
  }

  function drawSmartProbeBanner(targetX, targetY, text, color, offsetX, offsetY, viewW, viewH) {
    const boxW = 106;
    const boxH = 22;

    let boxX = targetX + offsetX;
    let boxY = targetY + offsetY;

    // If near top-right colorbar (x > viewW - 140 and y < 190), avoid collision
    if (boxX + boxW > viewW - 140 && boxY < 190) {
      if (boxY < 190 && offsetY < 0) {
        boxX = viewW - 150 - boxW;
      } else {
        boxY = 195;
      }
    }

    // Clamp strictly within viewport canvas margins
    if (boxX < 14) boxX = 14;
    if (boxX + boxW > viewW - 14) boxX = viewW - boxW - 14;
    if (boxY < 14) boxY = 14;
    if (boxY + boxH > viewH - 14) boxY = viewH - boxH - 14;

    // Angled Leader Line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(targetX, targetY);
    const anchorX = boxX + (targetX > boxX + boxW / 2 ? boxW : 0);
    const anchorY = boxY + boxH / 2;
    ctx.lineTo(anchorX, anchorY);
    ctx.stroke();

    // Target Dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Banner Box
    ctx.fillStyle = "rgba(14, 14, 18, 0.95)";
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
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const shapeLabel = rodShape === "square" ? "Solid Prismatic Rod" : "Solid Cylindrical Rod";
    ctx.fillText(`ANSYS FEA 3D Viewport | ${shapeLabel} | L=${ROD_L.toFixed(1)}m | Elements: ${NUM_SEGMENTS}`, 14, 14);
    if (showHeatFlow) {
      ctx.fillStyle = "rgba(255, 150, 70, 0.9)";
      ctx.fillText(`🌊 Heat Flow Active: q_x = -k·(dT/dx) [Fourier Conduction]`, 14, 28);
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

  function setEdges(enable) {
    showEdges = enable;
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

  /* Dynamically update 3D thermal rod geometry & contour field from 1D FEA parameters */
  function updateThermalParams(params) {
    if (!params) return;
    currentThermalParams = { ...params };
    ROD_L = params.L > 0 ? params.L : 1.0;
    NUM_SEGMENTS = Math.min(Math.max(params.N || 40, 10), 100);

    const L = ROD_L;
    const k = params.k || 10.0;
    const q = params.q != null ? params.q : 10000.0;
    const T0 = params.T0 != null ? params.T0 : 100.0;
    const TL = params.TL != null ? params.TL : 20.0;
    const N = params.N || 80;

    // Peak temperature location for steady-state 1D with uniform source
    // dT/dx = (TL - T0)/L + (q/(2k))*(L - 2x) = 0
    // => x_peak = L/2 + k*(TL - T0)/(q*L)
    let xPeak = L / 2;
    if (q > 0 && k > 0) {
      xPeak = L / 2 + (k * (TL - T0)) / (q * L);
      xPeak = Math.max(0, Math.min(L, xPeak));
    }

    const tPeak = T0 + (TL - T0) * (xPeak / L) + (q / (2 * k)) * xPeak * (L - xPeak);
    const tMin = Math.min(T0, TL);
    const tMax = Math.max(T0, TL, tPeak);

    minTemp = tMin;
    maxTemp = tMax;

    // Generate accurate 3D node representation
    const nodes = [];
    const yOffsets = [-0.025, 0.025];
    const zOffsets = [-0.025, 0.025];
    let id = 1;
    let minN = null;
    let maxN = null;

    const sampleCount = Math.min(N, 60);
    for (let i = 0; i <= sampleCount; i++) {
      const x = (i / sampleCount) * L;
      const T = T0 + (TL - T0) * (x / L) + (q / (2 * k)) * x * (L - x);
      for (const y of yOffsets) {
        for (const z of zOffsets) {
          const nObj = { id: id++, x, y, z, T };
          if (!minN || T < minN.T) minN = nObj;
          if (!maxN || T > maxN.T) maxN = nObj;
          nodes.push(nObj);
        }
      }
    }

    ansysNodes = nodes;
    minTempNode = minN;
    maxTempNode = maxN;

    const legMin = document.getElementById("legendMin");
    const legMid = document.getElementById("legendMid");
    const legMax = document.getElementById("legendMax");
    if (legMin && legMid && legMax) {
      legMin.textContent = `${minTemp.toFixed(1)} °C`;
      legMid.textContent = `${((minTemp + maxTemp) / 2).toFixed(1)} °C`;
      legMax.textContent = `${maxTemp.toFixed(1)} °C`;
    }

    render();
  }

  return {
    init,
    loadSTLString,
    loadAnsysCSVString,
    fitToView,
    setEdges,
    setRodShape,
    setHeatFlow,
    setFluxVectors,
    setDisplayMode,
    setContourStyle,
    setWireframe,
    setProbes,
    setShadow,
    updateThermalParams
  };
})();
