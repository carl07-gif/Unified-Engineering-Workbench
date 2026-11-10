/* ═══════════════════════════════════════════════════════════════
   Chart Renderer — Vector SVG Temperature Plot (Guaranteed Render)
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const ChartRenderer = (() => {
  let container;

  function init(containerEl) {
    container = containerEl || document.getElementById("chartSvgWrapper");
  }

  function draw(exactCurve, femResult, activeN) {
    if (!container) {
      container = document.getElementById("chartSvgWrapper");
    }
    if (!container) return;

    const W = 540;
    const H = 230;

    const plotL = 65;
    const plotR = W - 25;
    const plotT = 32;
    const plotB = H - 42;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;

    // Determine scale bounds
    const allT = [...exactCurve.T, ...femResult.T];
    const maxT_data = Math.max(...allT, 190.0);
    const minT_data = Math.min(...allT, 0.0);

    // Nice round Y bounds
    const yMax = Math.ceil(maxT_data / 50.0) * 50.0;
    const yMin = Math.floor(minT_data / 50.0) * 50.0;
    const xMax = exactCurve.x[exactCurve.x.length - 1] || 1.0;

    function px(x) { return plotL + (x / xMax) * plotW; }
    function py(t) { return plotB - ((t - yMin) / (yMax - yMin)) * plotH; }

    // Generate grid lines
    const yTicks = [0, 50, 100, 150, 200];
    let gridLinesSvg = "";
    let yLabelsSvg = "";

    yTicks.forEach(val => {
      if (val >= yMin && val <= yMax) {
        const yPos = py(val);
        gridLinesSvg += `<line x1="${plotL}" y1="${yPos.toFixed(1)}" x2="${plotR}" y2="${yPos.toFixed(1)}" stroke="var(--color-border)" stroke-width="0.75" />`;
        yLabelsSvg += `<text x="${plotL - 8}" y="${(yPos + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--color-text-secondary)">${val}</text>`;
      }
    });

    // Generate X axis ticks
    const xTicks = [0, 0.25, 0.5, 0.75, 1.0];
    let xLabelsSvg = "";
    xTicks.forEach(xv => {
      const xPos = px(xv);
      xLabelsSvg += `<text x="${xPos.toFixed(1)}" y="${plotB + 16}" text-anchor="middle" font-size="11" fill="var(--color-text-secondary)">${xv.toFixed(2)}</text>`;
    });

    // Generate exact solution polyline points
    const pointsStr = exactCurve.x.map((x, i) => {
      return `${px(x).toFixed(1)},${py(exactCurve.T[i]).toFixed(1)}`;
    }).join(" ");

    // Generate FEM nodal circles (sample at most 45 circles to avoid visual clutter)
    const step = Math.max(1, Math.floor(femResult.x.length / 45));
    let nodesSvg = "";
    for (let i = 0; i < femResult.x.length; i += step) {
      const cx = px(femResult.x[i]).toFixed(1);
      const cy = py(femResult.T[i]).toFixed(1);
      nodesSvg += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#D85A30" stroke="#ffffff" stroke-width="0.5" />`;
    }
    // Ensure final node is rendered
    const lastIdx = femResult.x.length - 1;
    nodesSvg += `<circle cx="${px(femResult.x[lastIdx]).toFixed(1)}" cy="${py(femResult.T[lastIdx]).toFixed(1)}" r="3.5" fill="#D85A30" stroke="#ffffff" stroke-width="0.5" />`;

    // Complete SVG markup
    const svgHtml = `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" role="img" class="thermal-svg-plot">
        <title>Temperature distribution along the rod (FEM vs Analytical Exact)</title>
        <!-- Grid & Axes -->
        <g stroke-linecap="round">${gridLinesSvg}</g>
        <g font-family="var(--font-sans)">${yLabelsSvg}</g>
        <g font-family="var(--font-sans)">${xLabelsSvg}</g>

        <!-- Axis Titles -->
        <text x="${plotL + plotW / 2}" y="${H - 6}" font-size="11.5" fill="var(--color-text-secondary)" text-anchor="middle" font-weight="500">
          Position along rod x (m)
        </text>
        <text x="14" y="${plotT + plotH / 2}" font-size="11.5" fill="var(--color-text-secondary)" text-anchor="middle" font-weight="500" transform="rotate(-90 14 ${plotT + plotH / 2})">
          Temperature (°C)
        </text>

        <!-- Exact Solution Curve (Blue) -->
        <polyline fill="none" stroke="#378ADD" stroke-width="2.5" stroke-linejoin="round" points="${pointsStr}" />

        <!-- FEM Nodes (Orange Dots) -->
        <g>${nodesSvg}</g>

        <!-- Legend -->
        <line x1="${plotR - 165}" y1="16" x2="${plotR - 143}" y2="16" stroke="#378ADD" stroke-width="2.5" />
        <text x="${plotR - 138}" y="20" font-size="11" fill="var(--color-text-secondary)">Exact Analytical</text>
        <circle cx="${plotR - 48}" cy="16" r="3.5" fill="#D85A30" />
        <text x="${plotR - 40}" y="20" font-size="11" fill="var(--color-text-secondary)">FEM (N=${activeN})</text>
      </svg>
    `;

    container.innerHTML = svgHtml;
  }

  return { init, draw };
})();
