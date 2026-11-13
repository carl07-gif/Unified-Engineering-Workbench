/* ═══════════════════════════════════════════════════════════════
   CadCloudView: ANSYS Nodal Cloud & Temperature Colormap Shaders
   Part of Unified Engineering Workbench CAD Engine (Task B)
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const CadCloudView = (() => {
  let contourStyle = "smooth"; // "smooth", "bands"

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
    const v = Math.max(0, Math.min(1, val));
    // High-fidelity smooth Turbo/ANSYS rainbow scientific colormap
    let r, g, b;
    if (v < 0.20) {
      const t = v / 0.20;
      r = Math.round(30 + 10 * t);
      g = Math.round(60 + 160 * t);
      b = Math.round(230 + 25 * t);
    } else if (v < 0.45) {
      const t = (v - 0.20) / 0.25;
      r = Math.round(40 + 30 * t);
      g = Math.round(220 + 20 * t);
      b = Math.round(255 * (1 - t * 0.85));
    } else if (v < 0.70) {
      const t = (v - 0.45) / 0.25;
      r = Math.round(70 + 185 * t);
      g = Math.round(240 - 20 * (1 - t));
      b = Math.round(38 * (1 - t));
    } else if (v < 0.88) {
      const t = (v - 0.70) / 0.18;
      r = Math.round(255);
      g = Math.round(220 * (1 - t * 0.55));
      b = 0;
    } else {
      const t = (v - 0.88) / 0.12;
      r = Math.round(255 - 35 * t);
      g = Math.round(100 * (1 - t * 0.8));
      b = Math.round(20 * t);
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

  function evalTemp(x, currentThermalParams, ansysNodes) {
    if (currentThermalParams) {
      const { L, k, q, T0, TL } = currentThermalParams;
      if (L > 0 && k > 0) {
        return T0 + (TL - T0) * (x / L) + (q / (2.0 * k)) * x * (L - x);
      }
    }
    if (ansysNodes && ansysNodes.length > 0) {
      let closest = ansysNodes[0];
      let minD = Math.abs(ansysNodes[0].x - x);
      for (let i = 1; i < ansysNodes.length; i++) {
        const d = Math.abs(ansysNodes[i].x - x);
        if (d < minD) { minD = d; closest = ansysNodes[i]; }
      }
      return closest.T;
    }
    return 100.0 - 80.0 * x + 500.0 * x * (1.0 - x);
  }

  function generateNodalSpheres(cx, cy, ansysNodes, minTemp, maxTemp, hoveredNode, projectFn, drawables) {
    if (!ansysNodes || ansysNodes.length === 0) return;

    ansysNodes.forEach(n => {
      const p = projectFn(n.x, n.y, n.z, cx, cy);
      if (p.depth < -2.5) return;

      const normT = (n.T - minTemp) / (maxTemp - minTemp || 1);
      const rgb = getTemperatureRGB(normT);
      const isHovered = hoveredNode && hoveredNode.id === n.id;
      const radius = (isHovered ? 6.5 : 3.8) * p.fov;

      drawables.push({
        type: "node",
        depth: p.depth,
        draw: (ctx) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
          ctx.fill();

          if (isHovered) {
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = "#ffffff";
            ctx.stroke();
          } else {
            ctx.lineWidth = 0.8;
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.stroke();
          }
        }
      });
    });
  }

  function setContourStyle(style) {
    contourStyle = style;
  }

  return {
    getTemperatureRGB,
    getTemperatureRGBContinuous,
    getLitColorString,
    evalTemp,
    generateNodalSpheres,
    setContourStyle
  };
})();
