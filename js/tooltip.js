/* ═══════════════════════════════════════════════════════════════
   CadTooltip: Continuous Full-Rod Probing & Inspection HUD
   Part of Unified Engineering Workbench CAD Engine (Task B)
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const CadTooltip = (() => {
  let nodeTooltip = null;
  let nodeTooltipBody = null;
  let hoveredX = null;
  let hoveredNode = null;

  function init() {
    nodeTooltip = document.getElementById("nodeTooltip");
    nodeTooltipBody = document.getElementById("nodeTooltipBody");
  }

  function checkInspection(mx, my, canvas, projectFn, params, ansysNodes, rodShape, ROD_L, ROD_W, ROD_H, ROD_RADIUS, NUM_SEGMENTS, minTemp, maxTemp) {
    if (!canvas || !nodeTooltip) return null;
    const dpr = window.devicePixelRatio || 1;
    const cx = (canvas.width / dpr) / 2;
    const cy = (canvas.height / dpr) / 2;

    const SAMPLES = 200;
    let bestX = null;
    let minRodDist = Infinity;

    for (let s = 0; s <= SAMPLES; s++) {
      const sx = (s / SAMPLES) * ROD_L;
      const pt = projectFn(sx, 0, 0, cx, cy);
      const d = Math.hypot(pt.x - mx, pt.y - my);
      if (d < minRodDist) { minRodDist = d; bestX = sx; }
    }

    if (bestX !== null && minRodDist < 300) {
      const stepSize = ROD_L / SAMPLES / 2;
      for (let step = -40; step <= 40; step++) {
        const xTry = Math.max(0, Math.min(ROD_L, bestX + step * stepSize));
        const pt = projectFn(xTry, 0, 0, cx, cy);
        const d = Math.hypot(pt.x - mx, pt.y - my);
        if (d < minRodDist) { minRodDist = d; bestX = xTry; }
      }
    }

    const halfW = Math.max(ROD_W, ROD_H) / 2;
    const pCenter = bestX !== null ? projectFn(bestX, 0, 0, cx, cy) : null;
    const crossSectionPx = pCenter ? Math.max(halfW, ROD_RADIUS) * CadCamera.getTransform().zoom * pCenter.fov : 24;
    const hoverThreshold = crossSectionPx * 2.0 + 20;

    if (bestX !== null && minRodDist <= hoverThreshold) {
      hoveredX = bestX;

      let L  = params ? params.L  : ROD_L;
      let k  = params ? params.k  : 10.0;
      let q  = params ? params.q  : 10000.0;
      let T0 = params ? params.T0 : 100.0;
      let TL = params ? params.TL : 20.0;
      if (!L || L <= 0) L = ROD_L;
      if (!k || k <= 0) k = 10.0;

      const dT_dx = (TL - T0) / L + (q / (2.0 * k)) * (L - 2.0 * bestX);
      const flux = -k * dT_dx;

      const halfH_disp = rodShape === "cylinder" ? ROD_RADIUS : ROD_H / 2;
      const halfW_disp = rodShape === "cylinder" ? ROD_RADIUS : ROD_W / 2;
      const fracPct = (bestX / L * 100).toFixed(1);

      const T = CadCloudView.evalTemp(bestX, params, ansysNodes);
      const normT = (T - minTemp) / (maxTemp - minTemp || 1);
      const rgb = CadCloudView.getTemperatureRGB(normT);

      let fluxDir = "";
      if (Math.abs(flux) < 10) {
        fluxDir = "⭐ Near Stagnation (q_x ≈ 0)";
      } else if (flux < 0) {
        fluxDir = `← Leftward → T₀ = ${T0.toFixed(0)}°C end`;
      } else {
        fluxDir = `→ Rightward → T_L = ${TL.toFixed(0)}°C end`;
      }

      let xPeak = L / 2;
      if (q !== 0) {
        xPeak = L / 2 + (k * (T0 - TL)) / (q * L);
        xPeak = Math.max(0, Math.min(L, xPeak));
      }
      const Tpeak = CadCloudView.evalTemp(xPeak, params, ansysNodes);

      let regionStatus = "";
      if (Math.abs(bestX - xPeak) <= L * 0.04) {
        regionStatus = `🏆 Thermal Peak — Tmax = ${Tpeak.toFixed(2)}°C, dT/dx ≈ 0`;
      } else if (bestX <= L * 0.15) {
        regionStatus = `🔥 Hot Boundary Zone — Near T₀ = ${T0.toFixed(0)}°C`;
      } else if (bestX >= L * 0.85) {
        regionStatus = `❄️ Cold Boundary Zone — Near T_L = ${TL.toFixed(0)}°C`;
      } else if (bestX < xPeak) {
        regionStatus = `📈 Rising Gradient Region (dT/dx > 0)`;
      } else {
        regionStatus = `📉 Falling Gradient Region (dT/dx < 0)`;
      }

      let nearestNode = null;
      let minNodeDx = Infinity;
      if (ansysNodes) {
        ansysNodes.forEach(n => {
          const dx = Math.abs(n.x - bestX);
          if (dx < minNodeDx) { minNodeDx = dx; nearestNode = n; }
        });
      }
      hoveredNode = (minNodeDx <= ROD_L / NUM_SEGMENTS) ? nearestNode : null;

      const stationNum = Math.round(bestX / L * NUM_SEGMENTS);
      const nodeLabel = nearestNode ? `Node ID: ${nearestNode.id}` : `FEA Station #${stationNum} / ${NUM_SEGMENTS}`;
      const pctFill = Math.round(normT * 100);
      const barColor = `rgb(${rgb.r},${rgb.g},${rgb.b})`;

      nodeTooltip.hidden = false;
      const TIP_W = 290, TIP_H = 220;
      let tipX = mx + 18;
      let tipY = my - 30;
      if (tipX + TIP_W > window.innerWidth  - 10) tipX = mx - TIP_W - 10;
      if (tipY + TIP_H > window.innerHeight - 10) tipY = my - TIP_H - 10;
      tipX = Math.max(6, tipX);
      tipY = Math.max(6, tipY);
      nodeTooltip.style.left  = `${tipX}px`;
      nodeTooltip.style.top   = `${tipY}px`;
      nodeTooltip.style.width = `${TIP_W}px`;

      nodeTooltipBody.innerHTML = `
        <div style="font-weight:700;color:#38bdf8;font-size:11.5px;margin-bottom:5px;
                    border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:4px;
                    display:flex;justify-content:space-between;align-items:center;">
          <span>🔬 Node / Surface Inspection</span>
          <span style="font-size:10px;color:#94a3b8;">${fracPct}% along rod</span>
        </div>
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;
                       background:${barColor};box-shadow:0 0 7px ${barColor};flex-shrink:0;"></span>
          <strong style="color:#fff;font-size:12px;">${nodeLabel}</strong>
        </div>
        <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:6px;margin-bottom:6px;overflow:hidden;">
          <div style="width:${pctFill}%;height:100%;background:linear-gradient(90deg,#3b82f6,#22c55e,#eab308,#f97316,#ef4444);transition:width 0.1s;"></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;line-height:1.65;">
          <tr>
            <td style="color:#94a3b8;white-space:nowrap;padding-right:8px;">Position</td>
            <td style="font-family:var(--font-mono);color:#e2e8f0;">x = ${bestX.toFixed(4)} m</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;white-space:nowrap;padding-right:8px;">Coordinates</td>
            <td style="font-family:var(--font-mono);color:#e2e8f0;">(${bestX.toFixed(3)}, ±${halfH_disp.toFixed(3)}, ±${halfW_disp.toFixed(3)}) m</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;white-space:nowrap;padding-right:8px;">Temperature</td>
            <td><span style="color:#ff8a65;font-size:14px;font-weight:700;">${T.toFixed(2)} °C</span>
                <span style="color:#94a3b8;font-size:10px;"> / max ${Tpeak.toFixed(1)}°C</span></td>
          </tr>
          <tr>
            <td style="color:#94a3b8;white-space:nowrap;padding-right:8px;">Heat Flux</td>
            <td style="font-family:var(--font-mono);color:#a7f3d0;font-weight:700;">${Math.abs(flux).toFixed(1)} W/m²
                <span style="color:#cbd5e1;font-weight:400;font-size:10px;"> ${fluxDir}</span></td>
          </tr>
          <tr>
            <td style="color:#94a3b8;white-space:nowrap;padding-right:8px;">Gradient dT/dx</td>
            <td style="font-family:var(--font-mono);color:#fde68a;">${dT_dx >= 0 ? "+" : ""}${dT_dx.toFixed(2)} °C/m</td>
          </tr>
        </table>
        <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:5px;
                    padding-top:4px;border-top:1px solid rgba(255,255,255,0.1);">
          ${regionStatus}
        </div>
      `;
      return { hoveredX, hoveredNode };
    } else {
      hoveredX = null;
      hoveredNode = null;
      if (nodeTooltip) nodeTooltip.hidden = true;
      return null;
    }
  }

  function drawInspectionMarker(ctx, cx, cy, projectFn, rodShape, ROD_L, ROD_W, ROD_H, ROD_RADIUS, animTime) {
    if (hoveredX === null) return;

    const pulse = 0.5 + 0.5 * Math.sin(animTime * 6.0);
    const ringRadius = rodShape === "cylinder" ? ROD_RADIUS * 1.08 : (ROD_H / 2) * 1.08;

    ctx.save();
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.85 + 0.15 * pulse})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();

    if (rodShape === "cylinder") {
      for (let s = 0; s <= 32; s++) {
        const th = (s / 32) * Math.PI * 2;
        const pt = projectFn(hoveredX, ringRadius * Math.sin(th), ringRadius * Math.cos(th), cx, cy);
        if (s === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
    } else {
      const halfW = ROD_W / 2;
      const halfH = ROD_H / 2;
      const pts = [
        projectFn(hoveredX, -halfH * 1.08, halfW * 1.08, cx, cy),
        projectFn(hoveredX, halfH * 1.08, halfW * 1.08, cx, cy),
        projectFn(hoveredX, halfH * 1.08, -halfW * 1.08, cx, cy),
        projectFn(hoveredX, -halfH * 1.08, -halfW * 1.08, cx, cy),
        projectFn(hoveredX, -halfH * 1.08, halfW * 1.08, cx, cy)
      ];
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    const surfaceY = rodShape === "cylinder" ? ROD_RADIUS * 1.06 : (ROD_H / 2) * 1.06;
    const surfaceZ = rodShape === "cylinder" ? 0 : (ROD_W / 2);
    const pSurface = projectFn(hoveredX, surfaceY, surfaceZ, cx, cy);

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(pSurface.x, pSurface.y, 4.5 * pSurface.fov, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(pSurface.x, pSurface.y, 2.2 * pSurface.fov, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function getHoveredState() {
    return { hoveredX, hoveredNode };
  }

  return {
    init,
    checkInspection,
    drawInspectionMarker,
    getHoveredState
  };
})();
