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
