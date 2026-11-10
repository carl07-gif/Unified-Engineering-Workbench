/* ═══════════════════════════════════════════════════════════════
   Realistic 3D Thermal Rod & CAD/ANSYS Engine (Task B)
   ANSYS Mechanical Style 3D Thermal Contour & Nodal Inspection
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const CadViewer = (() => {
  let canvas, ctx;
  let stlTriangles = [];
  let ansysNodes = [];
  let displayMode = "both";       // "both", "contour", "cloud", "stl"
  let contourStyle = "smooth";    // "smooth", "bands"
  let showWireframe = true;
  let showProbes = true;
  let showShadow = true;

  // Camera & view transforms (default isometric angle showing 3 faces)
  let rotX = 0.42;    // Pitch angle
  let rotY = -0.68;   // Yaw angle
  let zoom = 310;     // Scale
  let panX = 0;
  let panY = 10;

  let isDragging = false;
  let dragButton = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;

  let minTemp = 20.0, maxTemp = 188.2;
  let maxTempNode = null;
  let minTempNode = null;
  let hoveredNode = null;
  let hoveredSurface = null;
  let nodeTooltip, nodeTooltipBody;

  // Geometry dimensions for rod
  const ROD_L = 1.0;
  const ROD_W = 0.05;
  const ROD_H = 0.05;
  const NUM_SEGMENTS = 50; // High discretization for smooth thermal contour

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

    render();
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (rect.width || 600) * dpr;
    canvas.height = (rect.height || 440) * dpr;
    render();
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
        // Left drag: Orbit Rotate
        rotY += dx * 0.007;
        rotX += dy * 0.007;
        // Clamp pitch to avoid inversion
        rotX = Math.max(-1.5, Math.min(1.5, rotX));
      } else if (dragButton === 2) {
        // Right drag: Pan
        panX += dx;
        panY += dy;
      }
      render();
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
    zoom = Math.max(80, Math.min(3000, zoom * zoomFactor));
    render();
  }

  function fitToView() {
    rotX = 0.42;
    rotY = -0.68;
    zoom = 310;
    panX = 0;
    panY = 10;
    render();
  }

  /* ─────────────────────────────────────────────
     3D Projection & Camera Transforms
     ───────────────────────────────────────────── */
  function project(x, y, z, cx, cy) {
    // Center geometry around origin: center is at x=0.5, y=0.025, z=0.025
    const ox = x - 0.5;
    const oy = y - (ROD_H / 2);
    const oz = z - (ROD_W / 2);

    // Rotate around Y-axis (Yaw)
    const x1 = ox * Math.cos(rotY) + oz * Math.sin(rotY);
    const z1 = -ox * Math.sin(rotY) + oz * Math.cos(rotY);

    // Rotate around X-axis (Pitch)
    const y2 = oy * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = oy * Math.sin(rotX) + z1 * Math.cos(rotX);

    // Realistic perspective projection with focal length
    const cameraDist = 3.2;
    const fov = cameraDist / (cameraDist + z2);

    const sx = cx + (x1 * zoom * fov) + panX;
    const sy = cy - (y2 * zoom * fov) + panY;

    return { x: sx, y: sy, depth: z2, fov };
  }

  /* ─────────────────────────────────────────────
     ANSYS Standard Jet / Rainbow Colormap
     Maps normalized t in [0, 1] to RGB with lighting factor
     ───────────────────────────────────────────── */
  function getTemperatureRGB(tNorm) {
    const clamped = Math.max(0, Math.min(1, tNorm));
    let r, g, b;

    if (contourStyle === "bands") {
      // Discrete 10-band ANSYS contour
      const bands = 10;
      const stepped = Math.floor(clamped * (bands - 1)) / (bands - 1);
      return getTemperatureRGBContinuous(stepped);
    }
    return getTemperatureRGBContinuous(clamped);
  }

  function getTemperatureRGBContinuous(val) {
    // Jet / Rainbow colormap: Blue -> Cyan -> Green -> Yellow -> Orange -> Red
    let r = 0, g = 0, b = 0;
    if (val < 0.2) {
      // Blue -> Cyan
      const f = val / 0.2;
      r = 0;
      g = Math.round(220 * f);
      b = 255;
    } else if (val < 0.4) {
      // Cyan -> Green
      const f = (val - 0.2) / 0.2;
      r = 0;
      g = 220 + Math.round(35 * (1 - f));
      b = Math.round(255 * (1 - f));
    } else if (val < 0.65) {
      // Green -> Yellow
      const f = (val - 0.4) / 0.25;
      r = Math.round(255 * f);
      g = 255;
      b = 0;
    } else if (val < 0.85) {
      // Yellow -> Orange
      const f = (val - 0.65) / 0.2;
      r = 255;
      g = Math.round(255 * (1 - f * 0.6));
      b = 0;
    } else {
      // Orange -> Deep Red
      const f = (val - 0.85) / 0.15;
      r = 255;
      g = Math.round(102 * (1 - f));
      b = Math.round(30 * f);
    }
    return { r, g, b };
  }

  function getLitColorString(rgb, shadeFactor) {
    const sf = Math.max(0.18, Math.min(1.35, shadeFactor));
    const r = Math.min(255, Math.round(rgb.r * sf));
    const g = Math.min(255, Math.round(rgb.g * sf));
    const b = Math.min(255, Math.round(rgb.b * sf));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function tempAtX(x) {
    // If ANSYS nodes are loaded, interpolate from nearest node
    if (ansysNodes.length > 0) {
      // Find two nearest nodes along x
      let closest = ansysNodes[0];
      let minD = Math.abs(ansysNodes[0].x - x);
      for (let i = 1; i < ansysNodes.length; i++) {
        const d = Math.abs(ansysNodes[i].x - x);
        if (d < minD) {
          minD = d;
          closest = ansysNodes[i];
        }
      }
      return closest.T;
    }
    // Analytical 1D FEA Poisson equation: T(x) = 100 - 80*x + 500*x*(1 - x)
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

    // Deep dark engineering viewport background with subtle vignette
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w * 0.7);
    bgGrad.addColorStop(0, "#19191d");
    bgGrad.addColorStop(1, "#0d0d10");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Directional light vector in world space: coming from top-front-right
    const lightDir = { x: 0.35, y: 0.85, z: 0.4 };
    const lLen = Math.hypot(lightDir.x, lightDir.y, lightDir.z);
    lightDir.x /= lLen; lightDir.y /= lLen; lightDir.z /= lLen;

    // 1. Draw 3D Ground Shadow beneath the rod
    if (showShadow) {
      drawGroundShadow(cx, cy);
    }

    // 2. Draw 3D Coordinate Grid & Metric Scale
    drawGroundGrid(cx, cy);

    // Collect all 3D drawables for depth sorting (Painter's algorithm)
    const drawables = [];

    // 3. Generate 3D Solid Thermal Rod Mesh (Segments)
    if (displayMode === "both" || displayMode === "contour") {
      generateSolidRodSegments(cx, cy, lightDir, drawables);
    }

    // 4. Generate STL Triangles (if custom STL loaded or mode is STL)
    if ((displayMode === "stl" || displayMode === "both") && stlTriangles.length > 0) {
      generateStlMesh(cx, cy, lightDir, drawables);
    }

    // 5. Generate 3D Shaded Nodal Spheres
    if ((displayMode === "both" || displayMode === "cloud") && ansysNodes.length > 0) {
      generateNodalSpheres(cx, cy, drawables);
    }

    // Sort all drawables by camera depth (farthest first)
    drawables.sort((a, b) => b.depth - a.depth);

    // Draw sorted primitives
    drawables.forEach(item => item.draw());

    // 6. Draw Hot & Cold Spot Callout Markers (ANSYS Style)
    if (showProbes && (displayMode === "both" || displayMode === "contour" || displayMode === "cloud")) {
      drawThermalProbes(cx, cy);
    }

    // 7. Draw 3D Orientation Triad (XYZ Compass Gizmo in corner)
    drawOrientationTriad(w, h);

    // 8. Draw Engineering Viewport HUD stats
    drawViewportHUD(w, h);

    ctx.restore();
  }

  /* ─────────────────────────────────────────────
     Ground Shadow (Ambient Occlusion)
     ───────────────────────────────────────────── */
  function drawGroundShadow(cx, cy) {
    const floorY = -0.06;
    const p1 = project(0.0, floorY, -0.02, cx, cy);
    const p2 = project(1.0, floorY, -0.02, cx, cy);
    const p3 = project(1.0, floorY, 0.07, cx, cy);
    const p4 = project(0.0, floorY, 0.07, cx, cy);

    const shadowGrad = ctx.createRadialGradient(
      (p1.x + p2.x + p3.x + p4.x) / 4,
      (p1.y + p2.y + p3.y + p4.y) / 4,
      10,
      (p1.x + p2.x + p3.x + p4.x) / 4,
      (p1.y + p2.y + p3.y + p4.y) / 4,
      zoom * 0.9
    );
    shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.55)");
    shadowGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.2)");
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
     3D Floor Grid with Dimension Ticks
     ───────────────────────────────────────────── */
  function drawGroundGrid(cx, cy) {
    const floorY = -0.06;
    ctx.lineWidth = 0.75;

    // Major grid lines along X
    for (let gx = 0.0; gx <= 1.0; gx += 0.25) {
      const p1 = project(gx, floorY, -0.2, cx, cy);
      const p2 = project(gx, floorY, 0.25, cx, cy);

      ctx.strokeStyle = gx === 0 || gx === 1.0 ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Dimension labels
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillText(`${gx.toFixed(2)} m`, p2.x - 12, p2.y + 12);
    }

    // Grid lines along Z
    for (let gz = -0.2; gz <= 0.25; gz += 0.15) {
      const p1 = project(-0.1, floorY, gz, cx, cy);
      const p2 = project(1.1, floorY, gz, cx, cy);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  /* ─────────────────────────────────────────────
     Solid Rod Segment Generation with Gouraud / Gradient
     ───────────────────────────────────────────── */
  function generateSolidRodSegments(cx, cy, lightDir, drawables) {
    const dx = ROD_L / NUM_SEGMENTS;

    // Lighting factors for faces
    const topNormal = { x: 0, y: 1, z: 0 };
    const frontNormal = { x: 0, y: 0, z: 1 };
    const bottomNormal = { x: 0, y: -1, z: 0 };
    const backNormal = { x: 0, y: 0, z: -1 };
    const leftNormal = { x: -1, y: 0, z: 0 };
    const rightNormal = { x: 1, y: 0, z: 0 };

    function getShade(norm) {
      const dot = Math.max(0, norm.x * lightDir.x + norm.y * lightDir.y + norm.z * lightDir.z);
      return 0.35 + 0.65 * dot;
    }

    const topShade = getShade(topNormal) * 1.15;
    const frontShade = getShade(frontNormal) * 0.95;
    const bottomShade = getShade(bottomNormal) * 0.45;
    const backShade = getShade(backNormal) * 0.55;
    const leftShade = getShade(leftNormal) * 0.85;
    const rightShade = getShade(rightNormal) * 0.75;

    // Left End Cap (x = 0)
    const t0 = tempAtX(0);
    const normT0 = (t0 - minTemp) / (maxTemp - minTemp || 1);
    const c0 = getLitColorString(getTemperatureRGB(normT0), leftShade);
    const pL1 = project(0, 0, 0, cx, cy);
    const pL2 = project(0, ROD_H, 0, cx, cy);
    const pL3 = project(0, ROD_H, ROD_W, cx, cy);
    const pL4 = project(0, 0, ROD_W, cx, cy);
    const leftDepth = (pL1.depth + pL2.depth + pL3.depth + pL4.depth) / 4;

    drawables.push({
      depth: leftDepth,
      draw: () => {
        ctx.fillStyle = c0;
        ctx.beginPath();
        ctx.moveTo(pL1.x, pL1.y);
        ctx.lineTo(pL2.x, pL2.y);
        ctx.lineTo(pL3.x, pL3.y);
        ctx.lineTo(pL4.x, pL4.y);
        ctx.closePath();
        ctx.fill();
        if (showWireframe) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.lineWidth = 0.75;
          ctx.stroke();
        }
      }
    });

    // Right End Cap (x = L)
    const tL = tempAtX(ROD_L);
    const normTL = (tL - minTemp) / (maxTemp - minTemp || 1);
    const cL = getLitColorString(getTemperatureRGB(normTL), rightShade);
    const pR1 = project(ROD_L, 0, 0, cx, cy);
    const pR2 = project(ROD_L, ROD_H, 0, cx, cy);
    const pR3 = project(ROD_L, ROD_H, ROD_W, cx, cy);
    const pR4 = project(ROD_L, 0, ROD_W, cx, cy);
    const rightDepth = (pR1.depth + pR2.depth + pR3.depth + pR4.depth) / 4;

    drawables.push({
      depth: rightDepth,
      draw: () => {
        ctx.fillStyle = cL;
        ctx.beginPath();
        ctx.moveTo(pR1.x, pR1.y);
        ctx.lineTo(pR2.x, pR2.y);
        ctx.lineTo(pR3.x, pR3.y);
        ctx.lineTo(pR4.x, pR4.y);
        ctx.closePath();
        ctx.fill();
        if (showWireframe) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.lineWidth = 0.75;
          ctx.stroke();
        }
      }
    });

    // Segments along length X
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const xA = i * dx;
      const xB = (i + 1) * dx;
      const xMid = (xA + xB) / 2;

      const tA = tempAtX(xA);
      const tB = tempAtX(xB);
      const tM = tempAtX(xMid);

      const nTA = (tA - minTemp) / (maxTemp - minTemp || 1);
      const nTB = (tB - minTemp) / (maxTemp - minTemp || 1);
      const nTM = (tM - minTemp) / (maxTemp - minTemp || 1);

      // Top Face Quad: y = ROD_H
      const t1 = project(xA, ROD_H, 0, cx, cy);
      const t2 = project(xB, ROD_H, 0, cx, cy);
      const t3 = project(xB, ROD_H, ROD_W, cx, cy);
      const t4 = project(xA, ROD_H, ROD_W, cx, cy);
      const topDepth = (t1.depth + t2.depth + t3.depth + t4.depth) / 4;

      drawables.push({
        depth: topDepth,
        draw: () => {
          const colA = getLitColorString(getTemperatureRGB(nTA), topShade);
          const colB = getLitColorString(getTemperatureRGB(nTB), topShade);

          const grad = ctx.createLinearGradient(t1.x, t1.y, t2.x, t2.y);
          grad.addColorStop(0, colA);
          grad.addColorStop(1, colB);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y);
          ctx.lineTo(t2.x, t2.y);
          ctx.lineTo(t3.x, t3.y);
          ctx.lineTo(t4.x, t4.y);
          ctx.closePath();
          ctx.fill();

          if (showWireframe) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      // Front Face Quad: z = ROD_W
      const f1 = project(xA, 0, ROD_W, cx, cy);
      const f2 = project(xB, 0, ROD_W, cx, cy);
      const f3 = project(xB, ROD_H, ROD_W, cx, cy);
      const f4 = project(xA, ROD_H, ROD_W, cx, cy);
      const frontDepth = (f1.depth + f2.depth + f3.depth + f4.depth) / 4;

      drawables.push({
        depth: frontDepth,
        draw: () => {
          const colA = getLitColorString(getTemperatureRGB(nTA), frontShade);
          const colB = getLitColorString(getTemperatureRGB(nTB), frontShade);

          const grad = ctx.createLinearGradient(f1.x, f1.y, f2.x, f2.y);
          grad.addColorStop(0, colA);
          grad.addColorStop(1, colB);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(f1.x, f1.y);
          ctx.lineTo(f2.x, f2.y);
          ctx.lineTo(f3.x, f3.y);
          ctx.lineTo(f4.x, f4.y);
          ctx.closePath();
          ctx.fill();

          if (showWireframe) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      // Bottom Face Quad: y = 0
      const b1 = project(xA, 0, 0, cx, cy);
      const b2 = project(xB, 0, 0, cx, cy);
      const b3 = project(xB, 0, ROD_W, cx, cy);
      const b4 = project(xA, 0, ROD_W, cx, cy);
      const bottomDepth = (b1.depth + b2.depth + b3.depth + b4.depth) / 4;

      drawables.push({
        depth: bottomDepth,
        draw: () => {
          const colA = getLitColorString(getTemperatureRGB(nTA), bottomShade);
          const colB = getLitColorString(getTemperatureRGB(nTB), bottomShade);

          const grad = ctx.createLinearGradient(b1.x, b1.y, b2.x, b2.y);
          grad.addColorStop(0, colA);
          grad.addColorStop(1, colB);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(b1.x, b1.y);
          ctx.lineTo(b2.x, b2.y);
          ctx.lineTo(b3.x, b3.y);
          ctx.lineTo(b4.x, b4.y);
          ctx.closePath();
          ctx.fill();
        }
      });

      // Back Face Quad: z = 0
      const k1 = project(xA, 0, 0, cx, cy);
      const k2 = project(xB, 0, 0, cx, cy);
      const k3 = project(xB, ROD_H, 0, cx, cy);
      const k4 = project(xA, ROD_H, 0, cx, cy);
      const backDepth = (k1.depth + k2.depth + k3.depth + k4.depth) / 4;

      drawables.push({
        depth: backDepth,
        draw: () => {
          const colA = getLitColorString(getTemperatureRGB(nTA), backShade);
          const colB = getLitColorString(getTemperatureRGB(nTB), backShade);

          const grad = ctx.createLinearGradient(k1.x, k1.y, k2.x, k2.y);
          grad.addColorStop(0, colA);
          grad.addColorStop(1, colB);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(k1.x, k1.y);
          ctx.lineTo(k2.x, k2.y);
          ctx.lineTo(k3.x, k3.y);
          ctx.lineTo(k4.x, k4.y);
          ctx.closePath();
          ctx.fill();
        }
      });
    }
  }

  /* ─────────────────────────────────────────────
     STL Mesh Triangles
     ───────────────────────────────────────────── */
  function generateStlMesh(cx, cy, lightDir, drawables) {
    stlTriangles.forEach((t, idx) => {
      const p1 = project(t.v1.x, t.v1.y, t.v1.z, cx, cy);
      const p2 = project(t.v2.x, t.v2.y, t.v2.z, cx, cy);
      const p3 = project(t.v3.x, t.v3.y, t.v3.z, cx, cy);
      const avgDepth = (p1.depth + p2.depth + p3.depth) / 3;

      drawables.push({
        depth: avgDepth + 0.001, // slightly in front of background
        draw: () => {
          ctx.fillStyle = "rgba(60, 140, 230, 0.22)";
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fill();

          if (showWireframe) {
            ctx.strokeStyle = "rgba(100, 180, 255, 0.65)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      });
    });
  }

  /* ─────────────────────────────────────────────
     Realistic 3D Shaded Nodal Spheres
     ───────────────────────────────────────────── */
  function generateNodalSpheres(cx, cy, drawables) {
    ansysNodes.forEach(n => {
      const p = project(n.x, n.y, n.z, cx, cy);
      const isHovered = hoveredNode && hoveredNode.id === n.id;
      const isMax = maxTempNode && maxTempNode.id === n.id;
      const isMin = minTempNode && minTempNode.id === n.id;

      const normT = (n.T - minTemp) / (maxTemp - minTemp || 1);
      const rgb = getTemperatureRGB(normT);
      const radius = (isHovered ? 8 : (isMax || isMin ? 6.5 : 4.5)) * Math.max(0.6, Math.min(1.4, p.fov));

      drawables.push({
        depth: p.depth - 0.05, // Render in front of surface
        draw: () => {
          // Hot radiant thermal aura for high temperatures
          if (n.T > 160) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 60, 0, 0.18)";
            ctx.fill();
          }

          // Shaded 3D sphere with radial specular highlight
          const grad = ctx.createRadialGradient(
            p.x - radius * 0.35,
            p.y - radius * 0.35,
            radius * 0.1,
            p.x,
            p.y,
            radius
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
     ANSYS Max & Min Thermal Probe Callouts
     ───────────────────────────────────────────── */
  function drawThermalProbes(cx, cy) {
    if (!maxTempNode || !minTempNode) return;

    // 1. MAX Temp Probe Callout
    const pMax = project(maxTempNode.x, maxTempNode.y, maxTempNode.z, cx, cy);
    drawProbeBanner(pMax.x, pMax.y, `▲ MAX: ${maxTempNode.T.toFixed(1)}°C`, "#e62e00", -45, -35);

    // 2. MIN Temp Probe Callout
    const pMin = project(minTempNode.x, minTempNode.y, minTempNode.z, cx, cy);
    drawProbeBanner(pMin.x, pMin.y, `▼ MIN: ${minTempNode.T.toFixed(1)}°C`, "#1a75ff", 40, -35);
  }

  function drawProbeBanner(targetX, targetY, text, color, offsetX, offsetY) {
    const boxX = targetX + offsetX;
    const boxY = targetY + offsetY;
    const boxW = 105;
    const boxH = 22;

    // Leader line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(targetX, targetY);
    ctx.lineTo(boxX + (offsetX > 0 ? 0 : boxW), boxY + boxH / 2);
    ctx.stroke();

    // Small target pin circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Banner box
    ctx.fillStyle = "rgba(18, 18, 22, 0.92)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
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

    // Transform local unit vectors by camera angles
    function transformAxis(ox, oy, oz) {
      const x1 = ox * Math.cos(rotY) + oz * Math.sin(rotY);
      const z1 = -ox * Math.sin(rotY) + oz * Math.cos(rotY);
      const y2 = oy * Math.cos(rotX) - z1 * Math.sin(rotX);
      return { x: triadX + x1 * triadLen, y: triadY - y2 * triadLen, depth: z1 };
    }

    const oX = transformAxis(1, 0, 0);
    const oY = transformAxis(0, 1, 0);
    const oZ = transformAxis(0, 0, 1);

    // Draw triad axes sorted by depth
    const axes = [
      { p: oX, col: "#ff3b30", label: "X" },
      { p: oY, col: "#34c759", label: "Y" },
      { p: oZ, col: "#007aff", label: "Z" }
    ].sort((a, b) => a.p.depth - b.p.depth);

    // Central pivot
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(triadX, triadY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    axes.forEach(axis => {
      ctx.strokeStyle = axis.col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(triadX, triadY);
      ctx.lineTo(axis.p.x, axis.p.y);
      ctx.stroke();

      // Axis label pill
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
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`ANSYS FEA 3D Viewport | L=${ROD_L.toFixed(1)}m | Elements: ${NUM_SEGMENTS}`, 14, 14);
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
      const p = project(n.x, n.y, n.z, cx, cy);
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
        <div><strong>Heat Flux:</strong> ${flux.toFixed(1)} W/m²</div>
        <div style="font-size:10px; color:rgba(255,255,255,0.6); margin-top:3px;">
          ${closestNode.T >= 180 ? "🔥 Thermal Hot Spot Region" : (closestNode.T <= 25 ? "❄️ Cold Boundary Heat Sink" : "⚡ Steady Internal Conduction")}
        </div>
      `;
      render();
    } else if (hoveredNode) {
      hoveredNode = null;
      nodeTooltip.hidden = true;
      render();
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
      render();
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
        legMin.textContent = `${minT.toFixed(1)}°C`;
        legMid.textContent = `${((minT + maxT) / 2).toFixed(1)}°C`;
        legMax.textContent = `${maxT.toFixed(1)}°C`;
      }

      render();
      return { success: true, count: nodes.length, minT, maxT };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function setDisplayMode(mode) {
    displayMode = mode;
    render();
  }

  function setContourStyle(style) {
    contourStyle = style;
    render();
  }

  function setWireframe(enable) {
    showWireframe = enable;
    render();
  }

  function setProbes(enable) {
    showProbes = enable;
    render();
  }

  function setShadow(enable) {
    showShadow = enable;
    render();
  }

  return {
    init,
    loadSTLString,
    loadAnsysCSVString,
    fitToView,
    setDisplayMode,
    setContourStyle,
    setWireframe,
    setProbes,
    setShadow
  };
})();
