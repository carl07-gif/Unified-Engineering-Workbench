/* ═══════════════════════════════════════════════════════════════
   Backpropagation View Controller (Task F)
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const BackpropViewController = (() => {
  let modal;

  function init() {
    modal = document.getElementById("backpropModal");
    const btnOpen = document.getElementById("btnOpenBackprop");
    const btnClose = document.getElementById("btnCloseBackprop");

    if (btnOpen) {
      btnOpen.addEventListener("click", () => {
        modal.hidden = false;
        runBackpropDemo();
      });
    }

    if (btnClose) {
      btnClose.addEventListener("click", () => {
        modal.hidden = true;
      });
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.hidden = true;
      });
    }

    // Run initial calculation once
    runBackpropDemo();
  }

  function forward(x, y, p) {
    const z = p.w * x + p.b;
    const h = Math.tanh(z);
    const yHat = p.v * h + p.c;
    const diff = yHat - y;
    const loss = 0.5 * diff * diff;
    return { z, h, yHat, loss };
  }

  function analyticalGradients(x, y, p) {
    const f = forward(x, y, p);
    const dJ_dyhat = f.yHat - y;
    const dJ_dc = dJ_dyhat;
    const dJ_dv = dJ_dyhat * f.h;
    const dJ_dh = dJ_dyhat * p.v;
    const dh_dz = 1.0 - f.h * f.h;
    const dJ_dz = dJ_dh * dh_dz;
    const dJ_dw = dJ_dz * x;
    const dJ_db = dJ_dz;
    return { dJ_dw, dJ_db, dJ_dv, dJ_dc };
  }

  async function runBackpropDemo() {
    const x = 1.0, y = 2.0, lr = 0.1, eps = 1e-6;
    let weights = { w: 0.5, b: 0.0, v: 1.0, c: 0.0 };

    // 1. If C++ backend is online, fetch from native C++17 BackpropEngine
    if (typeof ApiClient !== "undefined" && ApiClient.isOnline()) {
      try {
        const cppData = await ApiClient.getBackpropagation(100, lr);
        if (cppData && cppData.gradient_checks) {
          const tbody = document.getElementById("gradCheckTableBody");
          if (tbody) {
            tbody.innerHTML = "";
            cppData.gradient_checks.forEach(c => {
              const err = c.abs_error;
              const passed = c.passed;
              const tr = document.createElement("tr");
              tr.innerHTML = `
                <td><strong>&part;J / &part;${c.param}</strong></td>
                <td>${c.analytical.toFixed(8)}</td>
                <td>${c.numerical.toFixed(8)}</td>
                <td style="font-family:var(--font-mono);">${err.toExponential(2)}</td>
                <td style="color:${passed ? "var(--color-success)" : "var(--color-danger)"}; font-weight:600;">
                  <i class="ti ti-${passed ? "check" : "x"}"></i> ${passed ? "PASSED (&le; 1e-5)" : "FAILED"}
                </td>
              `;
              tbody.appendChild(tr);
            });
          }

          if (cppData.training_history) {
            const hist = cppData.training_history.map(h => ({
              step: h.step,
              loss: h.loss,
              yHat: h.y_hat
            }));
            renderLossSvg(hist);
            return;
          }
        }
      } catch (err) {
        console.warn("[BackpropView] C++ engine error, falling back to local calculation:", err);
      }
    }

    // 2. Local fallback calculation
    const ana = analyticalGradients(x, y, weights);

    // Central finite difference verification
    const gradChecks = [
      {
        name: "w",
        ana: ana.dJ_dw,
        num: (forward(x, y, { ...weights, w: weights.w + eps }).loss - forward(x, y, { ...weights, w: weights.w - eps }).loss) / (2 * eps)
      },
      {
        name: "b",
        ana: ana.dJ_db,
        num: (forward(x, y, { ...weights, b: weights.b + eps }).loss - forward(x, y, { ...weights, b: weights.b - eps }).loss) / (2 * eps)
      },
      {
        name: "v",
        ana: ana.dJ_dv,
        num: (forward(x, y, { ...weights, v: weights.v + eps }).loss - forward(x, y, { ...weights, v: weights.v - eps }).loss) / (2 * eps)
      },
      {
        name: "c",
        ana: ana.dJ_dc,
        num: (forward(x, y, { ...weights, c: weights.c + eps }).loss - forward(x, y, { ...weights, c: weights.c - eps }).loss) / (2 * eps)
      }
    ];

    const tbody = document.getElementById("gradCheckTableBody");
    if (tbody) {
      tbody.innerHTML = "";
      gradChecks.forEach(c => {
        const err = Math.abs(c.ana - c.num);
        const passed = err <= 1e-5;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>&part;J / &part;${c.name}</strong></td>
          <td>${c.ana.toFixed(8)}</td>
          <td>${c.num.toFixed(8)}</td>
          <td style="font-family:var(--font-mono);">${err.toExponential(2)}</td>
          <td style="color:${passed ? "var(--color-success)" : "var(--color-danger)"}; font-weight:600;">
            <i class="ti ti-${passed ? "check" : "x"}"></i> ${passed ? "PASSED (&le; 1e-5)" : "FAILED"}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // 100-step training loop
    const history = [];
    let curr = { ...weights };
    for (let step = 0; step <= 100; step++) {
      const f = forward(x, y, curr);
      history.push({ step, loss: f.loss, yHat: f.yHat });

      if (step < 100) {
        const g = analyticalGradients(x, y, curr);
        curr.w -= lr * g.dJ_dw;
        curr.b -= lr * g.dJ_db;
        curr.v -= lr * g.dJ_dv;
        curr.c -= lr * g.dJ_dc;
      }
    }

    renderLossSvg(history);
  }

  function renderLossSvg(history) {
    const container = document.getElementById("backpropSvgContainer");
    if (!container) return;

    const W = 620;
    const H = 170;
    const padL = 48, padR = 20, padT = 20, padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxLoss = 1.25;

    function px(step) { return padL + (step / 100) * plotW; }
    function py(loss) { return padT + plotH - (loss / maxLoss) * plotH; }

    let gridLines = "";
    [0.0, 0.4, 0.8, 1.2].forEach(l => {
      const yPos = py(l);
      gridLines += `<line x1="${padL}" y1="${yPos.toFixed(1)}" x2="${W - padR}" y2="${yPos.toFixed(1)}" stroke="var(--color-border)" stroke-width="0.75" />`;
      gridLines += `<text x="${padL - 8}" y="${(yPos + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--color-text-secondary)">${l.toFixed(1)}</text>`;
    });

    let xLabels = "";
    [0, 20, 40, 60, 80, 100].forEach(s => {
      xLabels += `<text x="${px(s).toFixed(1)}" y="${padT + plotH + 16}" text-anchor="middle" font-size="10" fill="var(--color-text-secondary)">${s}</text>`;
    });

    const ptsStr = history.map(h => `${px(h.step).toFixed(1)},${py(h.loss).toFixed(1)}`).join(" ");

    const svg = `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto">
        <g>${gridLines}</g>
        <g font-family="var(--font-sans)">${xLabels}</g>
        <text x="${padL + plotW / 2}" y="${H - 4}" font-size="11" fill="var(--color-text-secondary)" text-anchor="middle">Training Step (Epoch)</text>
        <text x="14" y="${padT + plotH / 2}" font-size="11" fill="var(--color-text-secondary)" text-anchor="middle" transform="rotate(-90 14 ${padT + plotH / 2})">Loss J</text>

        <polyline fill="none" stroke="#3987e5" stroke-width="2.5" points="${ptsStr}" stroke-linejoin="round" />
        <circle cx="${px(0).toFixed(1)}" cy="${py(history[0].loss).toFixed(1)}" r="4" fill="#d03b3b" />
        <text x="${px(0) + 8}" y="${py(history[0].loss) - 4}" font-size="10.5" fill="#d03b3b" font-weight="600">J₀ = ${history[0].loss.toFixed(3)}</text>

        <circle cx="${px(100).toFixed(1)}" cy="${py(history[100].loss).toFixed(1)}" r="4" fill="#0ca30c" />
        <text x="${px(100) - 80}" y="${py(history[100].loss) - 6}" font-size="10.5" fill="#0ca30c" font-weight="600">J₁₀₀ = ${history[100].loss.toFixed(5)}</text>
      </svg>
    `;

    container.innerHTML = svg;
  }

  return { init };
})();
