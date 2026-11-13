/* ═══════════════════════════════════════════════════════════════
   CadViewer: Core 3D CAD/FEA Viewport Coordinator (Task B)
   Modular architecture: uses CadCamera, CadCloudView, CadTooltip, CadParsers
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const CadViewer = (() => {
  let canvas, ctx;
  let stlTriangles = [];
  let ansysNodes = [];
  let displayMode = "rod";         // "rod", "with_nodes", "cloud", "stl", "overlay"
  let rodShape = "square";         // "square", "cylinder"
  let showEdges = true;
  let showHeatFlow = true;
  let showFluxVectors = true;
  let showWireframe = true;
  let showProbes = true;
  let showShadow = true;

  let minTemp = 20.0, maxTemp = 188.2;
  let maxTempNode = null;
  let minTempNode = null;

  let ROD_L = 1.0;
  let ROD_W = 0.08;
  let ROD_H = 0.08;
  const ROD_RADIUS = 0.045;
  let NUM_SEGMENTS = 40;
  let currentThermalParams = null;

  let animFrameId = null;
  let animTime = 0;

  function init(canvasEl) {
    canvas = canvasEl || document.getElementById("cad3DCanvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    CadTooltip.init();
    CadCamera.init(canvas, (mx, my) => {
      CadTooltip.checkInspection(
        mx, my, canvas, CadCamera.project, currentThermalParams,
        ansysNodes, rodShape, ROD_L, ROD_W, ROD_H, ROD_RADIUS, NUM_SEGMENTS, minTemp, maxTemp
      );
    });

    resize();
    window.addEventListener("resize", resize);
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

  function render() {
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    if (showShadow && (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay")) {
      drawGroundShadow(cx, cy);
    }
    drawGroundGrid(cx, cy);

    const lightDir = { x: 0.577, y: 0.577, z: 0.577 };
    const drawables = [];

    if (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay") {
      if (rodShape === "square") {
        generateSolidSquareRod(cx, cy, lightDir, drawables);
      } else {
        generateSolidCylinder(cx, cy, lightDir, drawables);
      }
    }

    if (displayMode === "stl" || displayMode === "overlay") {
      generateStlMesh(cx, cy, lightDir, drawables);
    }

    if (displayMode === "cloud" || displayMode === "with_nodes" || displayMode === "overlay") {
      const hover = CadTooltip.getHoveredState();
      CadCloudView.generateNodalSpheres(cx, cy, ansysNodes, minTemp, maxTemp, hover ? hover.hoveredNode : null, CadCamera.project, drawables);
    }

    drawables.sort((a, b) => b.depth - a.depth);
    drawables.forEach(d => d.draw(ctx));

    if (showEdges && (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay")) {
      if (rodShape === "square") drawSquareRodEdges(cx, cy);
      else drawCylinderEdges(cx, cy);
    }

    if (showHeatFlow && (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay")) {
      drawSurfaceStreamlines(cx, cy);
    }

    if (showFluxVectors && (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay")) {
      drawHeatFluxVectorsAndDivide(cx, cy);
    }

    CadTooltip.drawInspectionMarker(ctx, cx, cy, CadCamera.project, rodShape, ROD_L, ROD_W, ROD_H, ROD_RADIUS, animTime);

    if (showProbes && (displayMode === "rod" || displayMode === "with_nodes" || displayMode === "overlay")) {
      drawThermalProbes(cx, cy, w, h);
    }

    drawOrientationTriad(w, h);
    drawViewportHUD(w, h);

    ctx.restore();
  }

  function drawGroundShadow(cx, cy) {
    const shadowY = rodShape === "cylinder" ? -ROD_RADIUS * 1.5 : -ROD_H * 0.95;
    const halfW = rodShape === "cylinder" ? ROD_RADIUS * 1.6 : ROD_W * 1.2;
    const p1 = CadCamera.project(-0.02, shadowY, halfW, cx, cy);
    const p2 = CadCamera.project(ROD_L + 0.02, shadowY, halfW, cx, cy);
    const p3 = CadCamera.project(ROD_L + 0.02, shadowY, -halfW, cx, cy);
    const p4 = CadCamera.project(-0.02, shadowY, -halfW, cx, cy);

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.filter = "blur(8px)";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGroundGrid(cx, cy) {
    const gridY = -0.06;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;

    for (let x = -0.2; x <= ROD_L + 0.2; x += 0.25) {
      const pA = CadCamera.project(x, gridY, -0.3, cx, cy);
      const pB = CadCamera.project(x, gridY, 0.3, cx, cy);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();

      if (x >= 0 && x <= ROD_L) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "9px monospace";
        ctx.fillText(`${x.toFixed(2)} m`, pB.x - 14, pB.y + 14);
      }
    }
    ctx.restore();
  }

  function generateSolidSquareRod(cx, cy, lightDir, drawables) {
    const halfW = ROD_W / 2;
    const halfH = ROD_H / 2;
    const dx = ROD_L / NUM_SEGMENTS;

    function getShade(nx, ny, nz) {
      const dot = Math.max(0, nx * lightDir.x + ny * lightDir.y + nz * lightDir.z);
      return 0.38 + 0.62 * dot;
    }

    const faces = [
      { name: "top",    nx: 0,  ny: 1,  nz: 0,  shade: getShade(0, 1, 0) },
      { name: "bottom", nx: 0,  ny: -1, nz: 0,  shade: getShade(0, -1, 0) },
      { name: "front",  nx: 0,  ny: 0,  nz: 1,  shade: getShade(0, 0, 1) },
      { name: "back",   nx: 0,  ny: 0,  nz: -1, shade: getShade(0, 0, -1) }
    ];

    for (let s = 0; s < NUM_SEGMENTS; s++) {
      const xA = s * dx;
      const xB = (s + 1) * dx;
      const normTA = (CadCloudView.evalTemp(xA, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const normTB = (CadCloudView.evalTemp(xB, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const rgbA = CadCloudView.getTemperatureRGB(normTA);
      const rgbB = CadCloudView.getTemperatureRGB(normTB);

      faces.forEach(f => {
        if (!CadCamera.isNormalFacingCamera(f.nx, f.ny, f.nz)) return;

        let p1, p2, p3, p4;
        if (f.name === "top") {
          p1 = CadCamera.project(xA, halfH, halfW, cx, cy);
          p2 = CadCamera.project(xB, halfH, halfW, cx, cy);
          p3 = CadCamera.project(xB, halfH, -halfW, cx, cy);
          p4 = CadCamera.project(xA, halfH, -halfW, cx, cy);
        } else if (f.name === "bottom") {
          p1 = CadCamera.project(xA, -halfH, -halfW, cx, cy);
          p2 = CadCamera.project(xB, -halfH, -halfW, cx, cy);
          p3 = CadCamera.project(xB, -halfH, halfW, cx, cy);
          p4 = CadCamera.project(xA, -halfH, halfW, cx, cy);
        } else if (f.name === "front") {
          p1 = CadCamera.project(xA, -halfH, halfW, cx, cy);
          p2 = CadCamera.project(xB, -halfH, halfW, cx, cy);
          p3 = CadCamera.project(xB, halfH, halfW, cx, cy);
          p4 = CadCamera.project(xA, halfH, halfW, cx, cy);
        } else {
          p1 = CadCamera.project(xA, halfH, -halfW, cx, cy);
          p2 = CadCamera.project(xB, halfH, -halfW, cx, cy);
          p3 = CadCamera.project(xB, -halfH, -halfW, cx, cy);
          p4 = CadCamera.project(xA, -halfH, -halfW, cx, cy);
        }

        const depth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
        const colA = CadCloudView.getLitColorString(rgbA, f.shade);
        const colB = CadCloudView.getLitColorString(rgbB, f.shade);

        drawables.push({
          type: "face",
          depth,
          draw: (ctx) => {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();

            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, colA);
            grad.addColorStop(1, colB);
            ctx.fillStyle = grad;
            ctx.fill();

            if (showWireframe) {
              ctx.strokeStyle = "rgba(0, 0, 0, 0.20)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      });
    }

    // Left End Cap (x = 0, T = T0 = 100°C)
    if (CadCamera.isNormalFacingCamera(-1, 0, 0)) {
      const p1 = CadCamera.project(0, -halfH, -halfW, cx, cy);
      const p2 = CadCamera.project(0, -halfH, halfW, cx, cy);
      const p3 = CadCamera.project(0, halfH, halfW, cx, cy);
      const p4 = CadCamera.project(0, halfH, -halfW, cx, cy);
      const depth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
      const normT0 = (CadCloudView.evalTemp(0, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const col0 = CadCloudView.getLitColorString(CadCloudView.getTemperatureRGB(normT0), getShade(-1, 0, 0));

      drawables.push({
        type: "cap",
        depth,
        draw: (ctx) => {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.lineTo(p4.x, p4.y);
          ctx.closePath();
          ctx.fillStyle = col0;
          ctx.fill();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    }

    // Right End Cap (x = ROD_L, T = TL = 20°C)
    if (CadCamera.isNormalFacingCamera(1, 0, 0)) {
      const p1 = CadCamera.project(ROD_L, -halfH, halfW, cx, cy);
      const p2 = CadCamera.project(ROD_L, -halfH, -halfW, cx, cy);
      const p3 = CadCamera.project(ROD_L, halfH, -halfW, cx, cy);
      const p4 = CadCamera.project(ROD_L, halfH, halfW, cx, cy);
      const depth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
      const normTL = (CadCloudView.evalTemp(ROD_L, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const colL = CadCloudView.getLitColorString(CadCloudView.getTemperatureRGB(normTL), getShade(1, 0, 0));

      drawables.push({
        type: "cap",
        depth,
        draw: (ctx) => {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.lineTo(p4.x, p4.y);
          ctx.closePath();
          ctx.fillStyle = colL;
          ctx.fill();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    }
  }

  function generateSolidCylinder(cx, cy, lightDir, drawables) {
    const dx = ROD_L / NUM_SEGMENTS;
    const slices = 32;

    for (let s = 0; s < NUM_SEGMENTS; s++) {
      const xA = s * dx;
      const xB = (s + 1) * dx;
      const normTA = (CadCloudView.evalTemp(xA, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const normTB = (CadCloudView.evalTemp(xB, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const rgbA = CadCloudView.getTemperatureRGB(normTA);
      const rgbB = CadCloudView.getTemperatureRGB(normTB);

      for (let sl = 0; sl < slices; sl++) {
        const th1 = (sl / slices) * Math.PI * 2;
        const th2 = ((sl + 1) / slices) * Math.PI * 2;
        const ny = Math.cos((th1 + th2) / 2);
        const nz = Math.sin((th1 + th2) / 2);

        if (!CadCamera.isNormalFacingCamera(0, ny, nz)) continue;

        const p1 = CadCamera.project(xA, ROD_RADIUS * Math.cos(th1), ROD_RADIUS * Math.sin(th1), cx, cy);
        const p2 = CadCamera.project(xB, ROD_RADIUS * Math.cos(th1), ROD_RADIUS * Math.sin(th1), cx, cy);
        const p3 = CadCamera.project(xB, ROD_RADIUS * Math.cos(th2), ROD_RADIUS * Math.sin(th2), cx, cy);
        const p4 = CadCamera.project(xA, ROD_RADIUS * Math.cos(th2), ROD_RADIUS * Math.sin(th2), cx, cy);

        const depth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
        const dot = Math.max(0, ny * lightDir.y + nz * lightDir.z);
        const diffuse = 0.38 + 0.62 * dot;
        const spec = Math.pow(Math.max(0, ny * 0.92 + nz * 0.38), 12) * 0.35;

        const colA = CadCloudView.getLitColorString(rgbA, diffuse + spec);
        const colB = CadCloudView.getLitColorString(rgbB, diffuse + spec);

        drawables.push({
          type: "cyl_face",
          depth,
          draw: (ctx) => {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();

            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, colA);
            grad.addColorStop(1, colB);
            ctx.fillStyle = grad;
            ctx.fill();

            if (showWireframe && sl % 4 === 0) {
              ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }
    }

    // Solid Left Cap Disk (x = 0, T = T0 = 100°C)
    if (CadCamera.isNormalFacingCamera(-1, 0, 0)) {
      const pCenter = CadCamera.project(0, 0, 0, cx, cy);
      const capPoints = [];
      for (let sl = 0; sl < slices; sl++) {
        const th = (sl / slices) * Math.PI * 2;
        capPoints.push(CadCamera.project(0, ROD_RADIUS * Math.cos(th), ROD_RADIUS * Math.sin(th), cx, cy));
      }
      const normT0 = (CadCloudView.evalTemp(0, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const dot0 = Math.max(0, -1 * lightDir.x);
      const col0 = CadCloudView.getLitColorString(CadCloudView.getTemperatureRGB(normT0), 0.38 + 0.62 * dot0);

      drawables.push({
        type: "cyl_cap",
        depth: pCenter.depth,
        draw: (ctx) => {
          ctx.beginPath();
          ctx.moveTo(capPoints[0].x, capPoints[0].y);
          for (let i = 1; i < capPoints.length; i++) {
            ctx.lineTo(capPoints[i].x, capPoints[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = col0;
          ctx.fill();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    }

    // Solid Right Cap Disk (x = ROD_L, T = TL = 20°C)
    if (CadCamera.isNormalFacingCamera(1, 0, 0)) {
      const pCenter = CadCamera.project(ROD_L, 0, 0, cx, cy);
      const capPoints = [];
      for (let sl = 0; sl < slices; sl++) {
        const th = (sl / slices) * Math.PI * 2;
        capPoints.push(CadCamera.project(ROD_L, ROD_RADIUS * Math.cos(th), ROD_RADIUS * Math.sin(th), cx, cy));
      }
      const normTL = (CadCloudView.evalTemp(ROD_L, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const dotL = Math.max(0, 1 * lightDir.x);
      const colL = CadCloudView.getLitColorString(CadCloudView.getTemperatureRGB(normTL), 0.38 + 0.62 * dotL);

      drawables.push({
        type: "cyl_cap",
        depth: pCenter.depth,
        draw: (ctx) => {
          ctx.beginPath();
          ctx.moveTo(capPoints[0].x, capPoints[0].y);
          for (let i = 1; i < capPoints.length; i++) {
            ctx.lineTo(capPoints[i].x, capPoints[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = colL;
          ctx.fill();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    }
  }

  function drawSquareRodEdges(cx, cy) {
    if (!showEdges) return;
    const halfW = ROD_W / 2;
    const halfH = ROD_H / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.40)";
    ctx.lineWidth = 1.0;

    const corners = [
      { y: halfH, z: halfW },
      { y: halfH, z: -halfW },
      { y: -halfH, z: -halfW },
      { y: -halfH, z: halfW }
    ];

    // 4 Longitudinal edges
    corners.forEach(c => {
      const p1 = CadCamera.project(0, c.y, c.z, cx, cy);
      const p2 = CadCamera.project(ROD_L, c.y, c.z, cx, cy);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    // End cap perimeter edges
    [0, ROD_L].forEach(x => {
      ctx.beginPath();
      const pStart = CadCamera.project(x, corners[0].y, corners[0].z, cx, cy);
      ctx.moveTo(pStart.x, pStart.y);
      for (let i = 1; i < corners.length; i++) {
        const p = CadCamera.project(x, corners[i].y, corners[i].z, cx, cy);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    });

    ctx.restore();
  }

  function drawCylinderEdges(cx, cy) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.2;
    const p1 = CadCamera.project(0, ROD_RADIUS, 0, cx, cy);
    const p2 = CadCamera.project(ROD_L, ROD_RADIUS, 0, cx, cy);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  function generateStlMesh(cx, cy, lightDir, drawables) {
    if (!stlTriangles || stlTriangles.length === 0) return;

    stlTriangles.forEach(t => {
      if (!CadCamera.isNormalFacingCamera(t.normal.x, t.normal.y, t.normal.z)) return;

      const p1 = CadCamera.project(t.v1.x, t.v1.y, t.v1.z, cx, cy);
      const p2 = CadCamera.project(t.v2.x, t.v2.y, t.v2.z, cx, cy);
      const p3 = CadCamera.project(t.v3.x, t.v3.y, t.v3.z, cx, cy);

      const depth = (p1.depth + p2.depth + p3.depth) / 3;
      const dot = Math.max(0, t.normal.x * lightDir.x + t.normal.y * lightDir.y + t.normal.z * lightDir.z);
      const shade = 0.3 + 0.7 * dot;
      const val = Math.round(200 * shade);

      drawables.push({
        type: "stl_tri",
        depth,
        draw: (ctx) => {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fillStyle = `rgb(${val}, ${val}, ${Math.min(255, val + 20)})`;
          ctx.fill();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });
  }

  function drawSurfaceStreamlines(cx, cy) {
    const pulsePhase = (animTime * 0.8) % 1.0;
    const halfH = ROD_H / 2;
    const p1 = CadCamera.project(0.1 + pulsePhase * 0.3, halfH * 1.01, 0, cx, cy);
    const p2 = CadCamera.project(0.2 + pulsePhase * 0.3, halfH * 1.01, 0, cx, cy);

    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawHeatFluxVectorsAndDivide(cx, cy) {
    const xPeak = 0.42;
    const halfH = ROD_H / 2;
    const pTop = CadCamera.project(xPeak, halfH * 1.35, 0, cx, cy);
    const pBase = CadCamera.project(xPeak, halfH, 0, cx, cy);

    ctx.save();
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pBase.x, pBase.y);
    ctx.lineTo(pTop.x, pTop.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawThermalProbes(cx, cy, viewW, viewH) {
    const xPeak = 0.42;
    const yPeak = rodShape === "cylinder" ? ROD_RADIUS : ROD_H / 2;
    const pMax = CadCamera.project(xPeak, yPeak, 0, cx, cy);
    const pMin = CadCamera.project(ROD_L, 0, 0, cx, cy);

    ctx.save();

    function drawPillBadge(px, py, label, value, subtext, color, alignLeft, offsetY) {
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const fullText = `${label} ${value}`;
      const textW = ctx.measureText(fullText).width;
      const badgeW = textW + 28;
      const badgeH = 22;
      const bx = alignLeft ? px + 18 : px - badgeW - 18;
      const by = py + offsetY;

      // Pointer line
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      const elbowX = alignLeft ? px + 10 : px - 10;
      ctx.lineTo(elbowX, by + badgeH / 2);
      ctx.lineTo(alignLeft ? bx : bx + badgeW, by + badgeH / 2);
      ctx.stroke();

      // Pin circle on surface
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Badge background pill
      ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(bx, by, badgeW, badgeH, 6);
      ctx.fill();
      ctx.stroke();

      // Badge dot indicator
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bx + 10, by + badgeH / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Badge text
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(fullText, bx + 19, by + 15);
    }

    drawPillBadge(pMax.x, pMax.y, "MAX:", `${maxTemp.toFixed(1)}°C`, "x=0.42m", "#ef4444", false, -36);
    drawPillBadge(pMin.x, pMin.y, "MIN:", `${minTemp.toFixed(1)}°C`, "x=1.0m", "#38bdf8", true, 14);

    ctx.restore();
  }

  function drawOrientationTriad(w, h) {
    const ox = 32, oy = h - 32;
    const axes = [
      { x: 1, y: 0, z: 0, label: "X", color: "#ef4444" },
      { x: 0, y: 1, z: 0, label: "Y", color: "#22c55e" },
      { x: 0, y: 0, z: 1, label: "Z", color: "#3b82f6" }
    ];

    ctx.save();
    axes.forEach(a => {
      const p = CadCamera.project(a.x * 0.15, a.y * 0.15, a.z * 0.15, ox, oy);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      ctx.fillStyle = a.color;
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(a.label, p.x + 4, p.y + 4);
    });
    ctx.restore();
  }

  function drawViewportHUD(w, h) {
    ctx.save();
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    const shapeLabel = rodShape === "square" ? "Solid Prismatic Rod" : "Solid Cylindrical Rod";
    ctx.fillText(`3D Viewport | ${shapeLabel} | L=${ROD_L.toFixed(1)}m | Elements: ${NUM_SEGMENTS}`, 14, 16);
    ctx.restore();
  }

  async function loadSTLString(text) {
    // 1. Try C++17 REST backend parser if online
    if (typeof ApiClient !== "undefined" && ApiClient.isOnline()) {
      try {
        const cppRes = await ApiClient.parseSTL(text);
        if (cppRes.success && cppRes.triangles) {
          stlTriangles = cppRes.triangles.map(t => ({
            normal: t.normal || { x: 0, y: 0, z: 1 },
            v1: t.v1,
            v2: t.v2,
            v3: t.v3
          }));
          return { success: true, count: cppRes.triangle_count || stlTriangles.length, name: cppRes.solid_name || "solid", backend: "C++17 Parser" };
        }
      } catch (err) {
        console.warn("[CadViewer] C++ STL parser error, falling back to local:", err);
      }
    }
    // 2. Local parser
    const res = CadParsers.parseASCIIStl(text);
    if (!res.success) return res;
    stlTriangles = res.triangles;
    return { success: true, count: res.count, name: res.name, backend: "Local JS Parser" };
  }

  async function loadAnsysCSVString(text) {
    // 1. Try C++17 REST backend parser if online
    if (typeof ApiClient !== "undefined" && ApiClient.isOnline()) {
      try {
        const cppRes = await ApiClient.parseANSYS(text);
        if (cppRes.success && cppRes.nodes) {
          ansysNodes = cppRes.nodes.map(n => ({
            id: n.id,
            x: n.x,
            y: n.y,
            z: n.z,
            temp: n.temp
          }));
          minTemp = cppRes.min_temp;
          maxTemp = cppRes.max_temp;
          minTempNode = { id: cppRes.min_temp_node_id, temp: cppRes.min_temp };
          maxTempNode = { id: cppRes.max_temp_node_id, temp: cppRes.max_temp };
          return { success: true, count: cppRes.node_count || ansysNodes.length, minTemp, maxTemp, backend: "C++17 Parser" };
        }
      } catch (err) {
        console.warn("[CadViewer] C++ ANSYS parser error, falling back to local:", err);
      }
    }
    // 2. Local parser
    const res = CadParsers.parseAnsysCSV(text);
    if (!res.success) return res;
    ansysNodes = res.nodes;
    minTemp = res.minTemp;
    maxTemp = res.maxTemp;
    minTempNode = res.minTempNode;
    maxTempNode = res.maxTempNode;
    return { success: true, count: res.count, minTemp, maxTemp, backend: "Local JS Parser" };
  }

  function setEdges(enable) { showEdges = enable; }
  function setRodShape(shape) { rodShape = shape; }
  function setHeatFlow(enable) { showHeatFlow = enable; }
  function setFluxVectors(enable) { showFluxVectors = enable; }
  function setDisplayMode(mode) { displayMode = mode; }
  function setContourStyle(style) { CadCloudView.setContourStyle(style); }
  function setWireframe(enable) { showWireframe = enable; }
  function setProbes(enable) { showProbes = enable; }
  function setShadow(enable) { showShadow = enable; }
  function updateThermalParams(params) { currentThermalParams = params; }

  return {
    init,
    fitToView: CadCamera.fitToView,
    loadSTLString,
    loadAnsysCSVString,
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
