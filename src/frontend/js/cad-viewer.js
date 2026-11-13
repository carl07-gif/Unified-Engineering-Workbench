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
  let ROD_W = 0.05;
  let ROD_H = 0.05;
  const ROD_RADIUS = 0.028;
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

    function getShade(n) {
      const dot = Math.max(0, n.x * lightDir.x + n.y * lightDir.y + n.z * lightDir.z);
      return 0.35 + 0.65 * dot;
    }

    for (let s = 0; s < NUM_SEGMENTS; s++) {
      const xA = s * dx;
      const xB = (s + 1) * dx;
      const midX = (xA + xB) / 2;
      const normT = (CadCloudView.evalTemp(midX, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const rgb = CadCloudView.getTemperatureRGB(normT);

      // Top face (y = +halfH)
      if (CadCamera.isNormalFacingCamera(0, 1, 0)) {
        const p1 = CadCamera.project(xA, halfH, halfW, cx, cy);
        const p2 = CadCamera.project(xB, halfH, halfW, cx, cy);
        const p3 = CadCamera.project(xB, halfH, -halfW, cx, cy);
        const p4 = CadCamera.project(xA, halfH, -halfW, cx, cy);
        const depth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
        const color = CadCloudView.getLitColorString(rgb, getShade({ x: 0, y: 1, z: 0 }));

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
            ctx.fillStyle = color;
            ctx.fill();
            if (showWireframe) {
              ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }

      // Front face (z = +halfW)
      if (CadCamera.isNormalFacingCamera(0, 0, 1)) {
        const p1 = CadCamera.project(xA, -halfH, halfW, cx, cy);
        const p2 = CadCamera.project(xB, -halfH, halfW, cx, cy);
        const p3 = CadCamera.project(xB, halfH, halfW, cx, cy);
        const p4 = CadCamera.project(xA, halfH, halfW, cx, cy);
        const depth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
        const color = CadCloudView.getLitColorString(rgb, getShade({ x: 0, y: 0, z: 1 }));

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
            ctx.fillStyle = color;
            ctx.fill();
            if (showWireframe) {
              ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }
    }
  }

  function generateSolidCylinder(cx, cy, lightDir, drawables) {
    const dx = ROD_L / NUM_SEGMENTS;
    const slices = 24;

    for (let s = 0; s < NUM_SEGMENTS; s++) {
      const xA = s * dx;
      const xB = (s + 1) * dx;
      const midX = (xA + xB) / 2;
      const normT = (CadCloudView.evalTemp(midX, currentThermalParams, ansysNodes) - minTemp) / (maxTemp - minTemp || 1);
      const rgb = CadCloudView.getTemperatureRGB(normT);

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
        const color = CadCloudView.getLitColorString(rgb, 0.35 + 0.65 * dot);

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
            ctx.fillStyle = color;
            ctx.fill();
          }
        });
      }
    }
  }

  function drawSquareRodEdges(cx, cy) {
    const halfW = ROD_W / 2;
    const halfH = ROD_H / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.2;

    const corners = [
      { y: halfH, z: halfW },
      { y: halfH, z: -halfW },
      { y: -halfH, z: halfW },
      { y: -halfH, z: -halfW }
    ];

    corners.forEach(c => {
      const p1 = CadCamera.project(0, c.y, c.z, cx, cy);
      const p2 = CadCamera.project(ROD_L, c.y, c.z, cx, cy);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
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
    const pMax = CadCamera.project(xPeak, ROD_H / 2, 0, cx, cy);
    const pMin = CadCamera.project(ROD_L, 0, 0, cx, cy);

    ctx.save();
    ctx.font = "bold 11px sans-serif";

    // Max probe
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`▲ MAX: ${maxTemp.toFixed(1)}°C`, pMax.x - 35, pMax.y - 25);

    // Min probe
    ctx.fillStyle = "#3b82f6";
    ctx.fillText(`▼ MIN: ${minTemp.toFixed(1)}°C`, pMin.x + 10, pMin.y + 15);
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
