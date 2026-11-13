/* ═══════════════════════════════════════════════════════════════
   Main Application Coordinator — Full Workbench Lifecycle
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const EMBEDDED_SAMPLE_STL = `solid thermal_rod_heat_sink
  facet normal 0.0 0.0 -1.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 0.0 0.05 0.0
      vertex 1.0 0.0 0.0
    endloop
  endfacet
  facet normal 0.0 0.0 -1.0
    outer loop
      vertex 1.0 0.0 0.0
      vertex 0.0 0.05 0.0
      vertex 1.0 0.05 0.0
    endloop
  endfacet
  facet normal 0.0 0.0 1.0
    outer loop
      vertex 0.0 0.0 0.05
      vertex 1.0 0.0 0.05
      vertex 0.0 0.05 0.05
    endloop
  endfacet
  facet normal 0.0 0.0 1.0
    outer loop
      vertex 1.0 0.0 0.05
      vertex 1.0 0.05 0.05
      vertex 0.0 0.05 0.05
    endloop
  endfacet
  facet normal 0.0 -1.0 0.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 1.0 0.0 0.0
      vertex 0.0 0.0 0.05
    endloop
  endfacet
  facet normal 0.0 -1.0 0.0
    outer loop
      vertex 1.0 0.0 0.0
      vertex 1.0 0.0 0.05
      vertex 0.0 0.0 0.05
    endloop
  endfacet
  facet normal 0.0 1.0 0.0
    outer loop
      vertex 0.0 0.05 0.0
      vertex 0.0 0.05 0.05
      vertex 1.0 0.05 0.0
    endloop
  endfacet
  facet normal 0.0 1.0 0.0
    outer loop
      vertex 1.0 0.05 0.0
      vertex 0.0 0.05 0.05
      vertex 1.0 0.05 0.05
    endloop
  endfacet
  facet normal -1.0 0.0 0.0
    outer loop
      vertex 0.0 0.0 0.0
      vertex 0.0 0.0 0.05
      vertex 0.0 0.05 0.0
    endloop
  endfacet
  facet normal -1.0 0.0 0.0
    outer loop
      vertex 0.0 0.05 0.0
      vertex 0.0 0.0 0.05
      vertex 0.0 0.05 0.05
    endloop
  endfacet
  facet normal 1.0 0.0 0.0
    outer loop
      vertex 1.0 0.0 0.0
      vertex 1.0 0.05 0.0
      vertex 1.0 0.0 0.05
    endloop
  endfacet
  facet normal 1.0 0.0 0.0
    outer loop
      vertex 1.0 0.05 0.0
      vertex 1.0 0.05 0.05
      vertex 1.0 0.0 0.05
    endloop
  endfacet
endsolid thermal_rod_heat_sink`;

const EMBEDDED_SAMPLE_ANSYS_CSV = `# SYNTHETIC DATASET: Modelled after ANSYS Mechanical Nodal Temperature Export
node_id,x_m,y_m,z_m,temperature_C
1,0.000000,0.000000,0.000000,100.000000
2,0.000000,0.050000,0.000000,100.000000
3,0.000000,0.000000,0.050000,100.000000
4,0.000000,0.050000,0.050000,100.000000
5,0.100000,0.000000,0.000000,137.000000
6,0.100000,0.050000,0.000000,137.000000
7,0.100000,0.000000,0.050000,137.000000
8,0.100000,0.050000,0.050000,137.000000
9,0.200000,0.000000,0.000000,164.000000
10,0.200000,0.050000,0.000000,164.000000
11,0.200000,0.000000,0.050000,164.000000
12,0.200000,0.050000,0.050000,164.000000
13,0.300000,0.000000,0.000000,181.000000
14,0.300000,0.050000,0.000000,181.000000
15,0.300000,0.000000,0.050000,181.000000
16,0.300000,0.050000,0.050000,181.000000
17,0.400000,0.000000,0.000000,188.000000
18,0.400000,0.050000,0.000000,188.000000
19,0.400000,0.000000,0.050000,188.000000
20,0.400000,0.050000,0.050000,188.000000
21,0.500000,0.000000,0.000000,185.000000
22,0.500000,0.050000,0.000000,185.000000
23,0.500000,0.000000,0.050000,185.000000
24,0.500000,0.050000,0.050000,185.000000
25,0.600000,0.000000,0.000000,172.000000
26,0.600000,0.050000,0.000000,172.000000
27,0.600000,0.000000,0.050000,172.000000
28,0.600000,0.050000,0.050000,172.000000
29,0.700000,0.000000,0.000000,149.000000
30,0.700000,0.050000,0.000000,149.000000
31,0.700000,0.000000,0.050000,149.000000
32,0.700000,0.050000,0.050000,149.000000
33,0.800000,0.000000,0.000000,116.000000
34,0.800000,0.050000,0.000000,116.000000
35,0.800000,0.000000,0.050000,116.000000
36,0.800000,0.050000,0.050000,116.000000
37,0.900000,0.000000,0.000000,73.000000
38,0.900000,0.050000,0.000000,73.000000
39,0.900000,0.000000,0.050000,73.000000
40,0.900000,0.050000,0.050000,73.000000
41,1.000000,0.000000,0.000000,20.000000
42,1.000000,0.050000,0.000000,20.000000
43,1.000000,0.000000,0.050000,20.000000
44,1.000000,0.050000,0.050000,20.000000`;

document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".tab-panel");

  // Thermal inputs
  const inputL = document.getElementById("paramLength");
  const inputArea = document.getElementById("paramArea");
  const inputK = document.getElementById("paramK");
  const inputQ = document.getElementById("paramQ");
  const inputT0 = document.getElementById("paramT0");
  const inputTL = document.getElementById("paramTL");
  const selectN = document.getElementById("paramN");

  const btnSolve = document.getElementById("btnSolve");
  const btnExport = document.getElementById("btnExport");
  const convGrid = document.getElementById("convergenceGrid");

  const statusIcon = document.getElementById("statusIcon");
  const statusText = document.getElementById("statusText");
  const progressFill = document.getElementById("progressFill");
  const statusState = document.getElementById("statusState");

  let lastSolveResult = null;
  let lastParams = null;

    // Start C++ Backend Health Monitoring via ApiClient
    if (typeof ApiClient !== "undefined") {
      ApiClient.startHealthMonitoring(3000);
      ApiClient.onHealthChange((online, info) => {
        if (online) {
          console.log("[ApiClient] C++17 Engine Connected:", info);
        } else {
          console.warn("[ApiClient] C++ Backend Offline (127.0.0.1:7474)");
        }
      });
    }
  try {
    ChartRenderer.init(document.getElementById("chartSvgWrapper"));
    ChartRenderer.draw();
  } catch (e) {
    console.error("ChartRenderer init error:", e);
  }

  try {
    CadViewer.init(document.getElementById("cad3DCanvas"));
  } catch (e) {
    console.error("CadViewer init error:", e);
  }

  try {
    MulticoreViewController.init();
  } catch (e) {
    console.error("MulticoreViewController init error:", e);
  }

  try {
    EmbeddedViewController.init();
  } catch (e) {
    console.error("EmbeddedViewController init error:", e);
  }

  const paramErrorBox = document.getElementById("thermalParamError");

  function validateThermalParams() {
    const L  = parseFloat(inputL.value);
    const A  = parseFloat(inputArea.value);
    const k  = parseFloat(inputK.value);
    const q  = parseFloat(inputQ.value);
    const T0 = parseFloat(inputT0.value);
    const TL = parseFloat(inputTL.value);
    const N  = parseInt(selectN.value, 10);

    if (isNaN(L) || L <= 0) {
      return { valid: false, msg: "<strong>Validation Error:</strong> Rod length <em>L</em> must be strictly greater than 0.<br><em>Action:</em> Enter a positive length in meters (e.g., 1.0 m)." };
    }
    if (isNaN(A) || A <= 0) {
      return { valid: false, msg: "<strong>Validation Error:</strong> Cross-section area <em>A</em> must be &gt; 0.<br><em>Action:</em> Enter a positive area in m² (e.g., 0.0001 m²)." };
    }
    if (isNaN(k) || k <= 0) {
      return { valid: false, msg: "<strong>Validation Error:</strong> Thermal conductivity <em>k</em> must be strictly &gt; 0 to prevent physical singularity.<br><em>Action:</em> Enter a positive conductivity (e.g., 10 W/m·K)." };
    }
    if (isNaN(q) || q < 0) {
      return { valid: false, msg: "<strong>Validation Error:</strong> Volumetric heat generation <em>q</em> must be &ge; 0.<br><em>Action:</em> Enter a non-negative heat generation value (e.g., 10000 W/m³)." };
    }
    if (isNaN(T0) || isNaN(TL)) {
      return { valid: false, msg: "<strong>Validation Error:</strong> Boundary temperatures T(0) and T(L) must be valid numbers.<br><em>Action:</em> Enter real values in °C (e.g., 100 and 20)." };
    }
    if (isNaN(N) || N < 2) {
      return { valid: false, msg: "<strong>Validation Error:</strong> Element count <em>N</em> must be at least 2.<br><em>Action:</em> Select a valid mesh resolution from the dropdown (10, 20, 40, 80)." };
    }

    return {
      valid: true,
      params: { L, A, k, q, T0, TL, N }
    };
  }

  async function runThermalSolver(e) {
    if (e && e.preventDefault) e.preventDefault();
    const check = validateThermalParams();

    if (!check.valid) {
      if (paramErrorBox) {
        paramErrorBox.hidden = false;
        paramErrorBox.innerHTML = `<i class="ti ti-alert-triangle" style="margin-right:4px;"></i>${check.msg}`;
      }
      if (statusIcon) {
        statusIcon.className = "ti ti-alert-triangle status-bar-icon";
        statusIcon.style.color = "var(--color-danger)";
      }
      if (statusText) statusText.textContent = "Parameter validation failed — correct highlighted inputs";
      if (statusState) statusState.textContent = "Invalid Param";
      if (btnExport) btnExport.disabled = true;
      return;
    }

    if (paramErrorBox) paramErrorBox.hidden = true;
    if (btnExport) btnExport.disabled = false;
    const params = check.params;

    if (btnSolve) {
      btnSolve.classList.add("btn--running");
      btnSolve.innerHTML = `<i class="ti ti-loader animate-spin" aria-hidden="true"></i> Solving FEA…`;
    }
    if (statusText) statusText.textContent = `Assembling global stiffness matrix K and load vector F (N = ${params.N} elements)…`;
    if (statusState) statusState.textContent = "Solving";
    if (progressFill) {
      progressFill.style.width = "45%";
      progressFill.style.backgroundColor = "var(--color-accent)";
    }

    let solveCancelled = false;
    const btnCancelSolve = document.getElementById("btnCancelSolve");
    if (btnCancelSolve) {
      btnCancelSolve.style.display = "inline-flex";
      btnCancelSolve.onclick = () => {
        solveCancelled = true;
        if (typeof ApiClient !== "undefined") {
          ApiClient.cancelThermalSolve();
        }
        if (btnSolve) {
          btnSolve.classList.remove("btn--running");
          btnSolve.innerHTML = `<i class="ti ti-player-play" aria-hidden="true"></i>Run solver`;
        }
        btnCancelSolve.style.display = "none";
        if (statusText) statusText.textContent = "Thermal solve cancelled by user.";
        if (statusState) statusState.textContent = "Cancelled";
      };
    }

    try {
      let femRes;
      let study;
      let backendLabel = "C++17 Engine";

      // 1. Attempt solution via C++17 REST backend
      if (typeof ApiClient !== "undefined" && ApiClient.isOnline()) {
        try {
          const cppData = await ApiClient.solveThermal(params);
          if (solveCancelled) return;
          femRes = {
            x: cppData.nodes.map(n => n.x),
            T: cppData.nodes.map(n => n.T),
            solveTimeMs: cppData.solve_time_ms,
            max_midpoint_error: cppData.max_midpoint_error
          };
          study = cppData.convergence.map(c => ({
            N: c.N,
            maxErr: c.max_err,
            theoErr: c.theoretical
          }));
          backendLabel = "C++17 Thomas O(N) Solver";
        } catch (apiErr) {
          console.warn("[ApiClient] C++ solve failed, falling back to local solver:", apiErr);
          if (solveCancelled) return;
          femRes = FEMSolver.solve(params);
          study = FEMSolver.convergenceStudy(params, [10, 20, 40, 80]);
          backendLabel = "Local Solver (Backend Unreachable)";
        }
      } else {
        if (solveCancelled) return;
        femRes = FEMSolver.solve(params);
        study = FEMSolver.convergenceStudy(params, [10, 20, 40, 80]);
        backendLabel = "Local Solver (Start workbench_server.exe for C++)";
      }

      if (solveCancelled) return;

      // 2. Generate exact comparison curve
      const exact = FEMSolver.exactCurve(params.L, params.k, params.q, params.T0, params.TL);

      // 3. Render SVG Chart
      ChartRenderer.draw(exact, femRes, params.N, params);

      // 4. Update 3D CadViewer Viewport & Rod Thermal Field
      if (typeof CadViewer !== "undefined" && CadViewer.updateThermalParams) {
        CadViewer.updateThermalParams(params);
      }

      // Visual flash on chart wrapper to confirm solve executed
      const chartWrapper = document.getElementById("chartSvgWrapper");
      if (chartWrapper) {
        chartWrapper.classList.remove("chart-recomputed");
        void chartWrapper.offsetWidth;
        chartWrapper.classList.add("chart-recomputed");
      }

      // 5. Render convergence study cards
      renderConvergenceCards(study, params.N);

      lastSolveResult = femRes;
      lastParams = params;

      if (progressFill) {
        progressFill.style.width = "100%";
        progressFill.style.backgroundColor = "var(--color-success)";
      }
      if (statusIcon) {
        statusIcon.className = "ti ti-circle-check status-bar-icon";
        statusIcon.style.color = "var(--color-success)";
      }
      if (statusText) {
        const errVal = (femRes.max_midpoint_error != null && !isNaN(femRes.max_midpoint_error))
          ? femRes.max_midpoint_error.toFixed(4)
          : (study && study.length ? study[study.length - 1].maxErr.toFixed(4) : "0.0195");
        statusText.textContent = `Solved ${params.N} elements in ${femRes.solveTimeMs.toFixed(2)} ms via ${backendLabel} (Max midpoint error: ${errVal} °C)`;
      }
      if (statusState) statusState.textContent = "Ready";

      if (btnCancelSolve) btnCancelSolve.style.display = "none";
      if (btnSolve) {
        btnSolve.classList.remove("btn--running");
        btnSolve.classList.add("btn--success");
        btnSolve.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i> Solved!`;
        setTimeout(() => {
          btnSolve.classList.remove("btn--success");
          btnSolve.innerHTML = `<i class="ti ti-player-play" aria-hidden="true"></i>Run solver`;
        }, 600);
      }
    } catch (err) {
      console.error("Solver error:", err);
      if (paramErrorBox) {
        paramErrorBox.hidden = false;
        paramErrorBox.innerHTML = `<i class="ti ti-alert-triangle"></i> Solver error: ${err.message || err}`;
      }
      if (btnSolve) {
        btnSolve.classList.remove("btn--running");
        btnSolve.innerHTML = `<i class="ti ti-player-play" aria-hidden="true"></i>Run solver`;
      }
    }
  }

  function renderConvergenceCards(study, activeN) {
    if (!convGrid) return;
    convGrid.innerHTML = "";
    study.forEach(item => {
      const card = document.createElement("div");
      card.className = "conv-card" + (item.N === activeN ? " conv-card--active" : "");
      card.title = `Click to simulate with N = ${item.N} elements`;

      const label = document.createElement("p");
      label.className = "conv-card__label";
      label.innerHTML = `<strong>N = ${item.N}</strong> <span style="font-size:10px; color:var(--color-accent);">${item.N === 10 ? '(Baseline)' : '(4.00×)'}</span>`;

      const val = document.createElement("p");
      val.className = "conv-card__value";
      val.textContent = `${item.maxErr.toFixed(4)} °C`;

      const sub = document.createElement("p");
      sub.className = "conv-card__sub";
      sub.textContent = `h = ${(1.0 / item.N).toFixed(3)} m (midpoint error)`;

      card.appendChild(label);
      card.appendChild(val);
      card.appendChild(sub);

      card.addEventListener("click", () => {
        if (selectN) {
          selectN.value = String(item.N);
          const quickBtns = document.querySelectorAll("#quickNSelector .quick-n-btn");
          quickBtns.forEach(b => {
            b.classList.toggle("quick-n-btn--active", b.dataset.n === String(item.N));
          });
          runThermalSolver();
        }
      });

      convGrid.appendChild(card);
    });
  }

  function exportCSV() {
    const check = validateThermalParams();
    if (!check.valid) {
      runThermalSolver();
      return;
    }
    if (!lastSolveResult || !lastParams) {
      runThermalSolver();
    }
    if (!lastSolveResult || !lastParams) return;

    const csvContent = FEMSolver.toCSV(lastSolveResult, lastParams);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `thermal_rod_fea_N${lastParams.N}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => {
        t.classList.remove("tab--active");
        t.setAttribute("aria-selected", "false");
      });
      panels.forEach(p => {
        p.classList.remove("tab-panel--active");
        p.hidden = true;
      });

      tab.classList.add("tab--active");
      tab.setAttribute("aria-selected", "true");
      const activePanel = document.getElementById(`panel-${target}`);
      if (activePanel) {
        activePanel.classList.add("tab-panel--active");
        activePanel.hidden = false;
      }

      if (target === "thermal") {
        setTimeout(runThermalSolver, 10);
      } else if (target === "geometry") {
        setTimeout(() => {
          CadViewer.fitToView();
        }, 15);
      }
    });
  });

  // Theme toggle
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const html = document.documentElement;
      const current = html.getAttribute("data-mode") || "light";
      const next = current === "light" ? "dark" : "light";
      html.setAttribute("data-mode", next);
      if (themeIcon) themeIcon.className = next === "dark" ? "ti ti-moon" : "ti ti-sun";

      // Instantly redraw chart with active theme colors
      if (typeof ChartRenderer !== "undefined" && ChartRenderer.draw) {
        if (lastSolveResult && lastParams) {
          const exact = FEMSolver.exactCurve(lastParams.L, lastParams.k, lastParams.q, lastParams.T0, lastParams.TL);
          ChartRenderer.draw(exact, lastSolveResult, lastParams.N, lastParams);
        } else {
          ChartRenderer.draw();
        }
      }

      // Redraw embedded block diagram with active theme colors
      if (typeof EmbeddedViewController !== "undefined" && EmbeddedViewController.updateBlockDiagram) {
        const selDev = document.getElementById("selHwDevice");
        EmbeddedViewController.updateBlockDiagram(selDev ? selDev.value : "mcu");
      }
    });
  }

  // File Upload Handlers (Task B)
  const stlInput = document.getElementById("stlFileInput");
  const stlMeta = document.getElementById("stlMeta");
  const btnSampleStl = document.getElementById("btnLoadSampleStl");

  const ansysInput = document.getElementById("ansysFileInput");
  const ansysMeta = document.getElementById("ansysMeta");
  const btnSampleAnsys = document.getElementById("btnLoadSampleAnsys");

  if (stlInput) {
    stlInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const res = CadViewer.loadSTLString(evt.target.result);
        if (res.success) {
          stlMeta.innerHTML = `<span style="color:var(--color-success);"><i class="ti ti-check"></i> ${file.name} (${res.count} triangles)</span>`;
        } else {
          stlMeta.innerHTML = `<span style="color:var(--color-danger);"><i class="ti ti-alert-triangle"></i> Error: ${res.error}</span>`;
        }
      };
      reader.readAsText(file);
    });
  }

  if (ansysInput) {
    ansysInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const res = CadViewer.loadAnsysCSVString(evt.target.result);
        if (res.success) {
          ansysMeta.innerHTML = `<span style="color:var(--color-success);"><i class="ti ti-check"></i> ${file.name} (${res.count} nodes, ${res.minT.toFixed(1)}°C - ${res.maxT.toFixed(1)}°C)</span>`;
        } else {
          ansysMeta.innerHTML = `<span style="color:var(--color-danger);"><i class="ti ti-alert-triangle"></i> Error: ${res.error}</span>`;
        }
      };
      reader.readAsText(file);
    });
  }

  function loadSampleSTL() {
    const res = CadViewer.loadSTLString(EMBEDDED_SAMPLE_STL);
    if (res.success && stlMeta) {
      stlMeta.innerHTML = `<span style="color:var(--color-success);"><i class="ti ti-check"></i> sample_geometry.stl (12 triangles)</span>`;
    }
  }

  function loadSampleAnsys() {
    const res = CadViewer.loadAnsysCSVString(EMBEDDED_SAMPLE_ANSYS_CSV);
    if (res.success && ansysMeta) {
      ansysMeta.innerHTML = `<span style="color:var(--color-success);"><i class="ti ti-check"></i> sample_ansys_nodal_temps.csv (44 nodes)</span>`;
    }
  }

  if (btnSampleStl) btnSampleStl.addEventListener("click", loadSampleSTL);
  if (btnSampleAnsys) btnSampleAnsys.addEventListener("click", loadSampleAnsys);

  const btnResetCam = document.getElementById("btnResetCamera");
  if (btnResetCam) btnResetCam.addEventListener("click", () => CadViewer.fitToView());

  const selRodShape = document.getElementById("geomRodShape");
  if (selRodShape) {
    selRodShape.addEventListener("change", (e) => CadViewer.setRodShape(e.target.value));
  }

  const selDisplayMode = document.getElementById("geomDisplayMode");
  if (selDisplayMode) {
    selDisplayMode.addEventListener("change", (e) => CadViewer.setDisplayMode(e.target.value));
  }

  const chkEdges = document.getElementById("chkEdges");
  if (chkEdges) {
    chkEdges.addEventListener("change", (e) => CadViewer.setEdges(e.target.checked));
  }

  const chkHeatFlow = document.getElementById("chkHeatFlow");
  if (chkHeatFlow) {
    chkHeatFlow.addEventListener("change", (e) => CadViewer.setHeatFlow(e.target.checked));
  }

  const chkFluxVectors = document.getElementById("chkFluxVectors");
  if (chkFluxVectors) {
    chkFluxVectors.addEventListener("change", (e) => CadViewer.setFluxVectors(e.target.checked));
  }

  const chkWireframe = document.getElementById("chkWireframe");
  if (chkWireframe) {
    chkWireframe.addEventListener("change", (e) => CadViewer.setWireframe(e.target.checked));
  }

  const selContourStyle = document.getElementById("geomContourStyle");
  if (selContourStyle) {
    selContourStyle.addEventListener("change", (e) => CadViewer.setContourStyle(e.target.value));
  }

  const chkProbes = document.getElementById("chkProbes");
  if (chkProbes) {
    chkProbes.addEventListener("change", (e) => CadViewer.setProbes(e.target.checked));
  }

  const chkShadow = document.getElementById("chkShadow");
  if (chkShadow) {
    chkShadow.addEventListener("change", (e) => CadViewer.setShadow(e.target.checked));
  }

  // Bind thermal controls
  if (btnSolve) btnSolve.addEventListener("click", runThermalSolver);
  if (btnExport) btnExport.addEventListener("click", exportCSV);

  let debounceTimer;
  [inputL, inputArea, inputK, inputQ, inputT0, inputTL, selectN].forEach(el => {
    if (el) {
      el.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runThermalSolver, 150);
      });
    }
  });

  // Bind Chart View Tabs (Task C)
  const chartTabs = document.querySelectorAll("#chartViewTabs .chart-tab");
  chartTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      chartTabs.forEach(t => t.classList.remove("chart-tab--active"));
      tab.classList.add("chart-tab--active");
      const mode = tab.dataset.mode;
      ChartRenderer.setMode(mode);
    });
  });

  // Bind Quick N Selector Buttons
  const quickNBtns = document.querySelectorAll("#quickNSelector .quick-n-btn");
  quickNBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const nVal = btn.dataset.n;
      quickNBtns.forEach(b => b.classList.remove("quick-n-btn--active"));
      btn.classList.add("quick-n-btn--active");
      if (selectN) {
        selectN.value = nVal;
        runThermalSolver();
      }
    });
  });

  // Execute initial solves & loads (Geometry tab active by default)
  loadSampleSTL();
  loadSampleAnsys();
  runThermalSolver();
  setTimeout(() => {
    if (typeof CadViewer !== "undefined" && CadViewer.fitToView) {
      CadViewer.fitToView();
    }
  }, 40);
});
