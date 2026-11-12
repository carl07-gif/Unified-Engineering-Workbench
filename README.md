# Unified Engineering Workbench

A cross-disciplinary engineering workbench prototype  
Target platform: **Windows 11 x64**.

---

## 1. Quick Start: One-Click Execution

### Standalone Launcher (No Install, Zero Prerequisite)
Double-click **`Launch.exe`** (or `Launch.bat`) in the root directory.
- Opens the application immediately in your default browser.
- Requires **no** PowerShell, **no** terminal commands, **no** administrator rights, **no** package installations, **no** first-run build, and **no** internet connection.
- Self-contained, portable Windows 11 x64 binary execution directly upon ZIP extraction.

### VS Code / Antigravity Run Configuration
1. Open this repository folder in VS Code or Antigravity IDE.
2. Press **F5** or go to the **Run & Debug** panel (`Ctrl+Shift+D`) and select:
   - **`Launch Workbench (Microsoft Edge - Windows 11)`** (uses the built-in browser debugger; opens Edge with `index.html` immediately in one action).
   - Alternatively, select **`Launch Workbench (Google Chrome)`**.

> **Note on Standalone Launcher:** Double-clicking `Launch.bat` (or `Launch.exe`) does not require VS Code, any editor extension, or internet access.

---

## 2. System Architecture & Module Boundaries

```
├── CMakeLists.txt              # Standard C++17 build definition
├── Launch.bat                  # One-click standalone Windows launcher
├── index.html                  # Responsive unified workbench interface
├── css/
│   ├── styles.css              # Custom design system (Light/Dark themes)
│   └── icons.css               # 100% self-contained offline SVG icon masks (Zero CDN)
├── js/
│   ├── app.js                  # Main UI controller & lifecycle coordinator
│   ├── fem-solver.js           # 1D thermal FEA numerical solver
│   ├── chart.js                # Canvas high-DPI temperature & error plotter
│   ├── cad-parsers.js          # Modular ASCII STL & ANSYS CSV parsers (50MB tested)
│   ├── cad-viewer.js           # Zero-dependency custom HTML5 Canvas 3D CAD/FEA viewer
│   ├── multicore-view.js       # Multithreaded benchmark dashboard (with Cancel control)
│   ├── embedded-view.js        # Deterministic embedded telemetry & fault recovery
│   └── backprop-view.js        # Backpropagation derivation & finite difference
├── src/
│   └── cpp/                    # C++17 Core Engine
│       ├── fea_solver.hpp/.cpp         # 1D Steady-state thermal FEA
│       ├── cad_ansys_parser.hpp/.cpp   # ASCII STL & ANSYS CSV parsers
│       ├── multicore_engine.hpp/.cpp   # Thread pool & parallel benchmark
│       ├── embedded_mocks.hpp/.cpp     # MCU, FPGA, and JTAG adapters (with <cmath>)
│       ├── backprop_engine.hpp/.cpp    # Analytical gradient backprop
│       ├── launcher_win.cpp            # Win32 WinMain launcher source
│       └── main.cpp                    # Standalone CLI & backend runner
├── data/
│   ├── sample_geometry.stl     # Valid ASCII STL cuboid heat sink (12 facets)
│   ├── sample_ansys_nodal_temps.csv # Synthetic ANSYS nodal temperature CSV (44 nodes)
│   ├── invalid_malformed.stl   # Negative test STL
│   ├── invalid_ansys.csv       # Negative test CSV
│   └── DATA_PROVENANCE.md      # Schemas, units, origins, and limits
├── tests/
│   └── test_main.cpp           # Complete C++ unit test suite (27+ tests + 50MB stress)
├── results/
│   ├── mesh_convergence_plot.png       # High-res O(h²) error convergence plot
│   ├── temperature_profile_N80.png     # High-res T(x) FEA vs analytical profile plot
│   ├── multicore_scaling_speedup.png   # High-res thread speedup vs Amdahl plot
│   ├── backprop_loss_gradient_curve.png# High-res 100-step loss & gradient check plot
│   ├── cad_ansys_thermal_verification.png # ANSYS 3D surface correlation plot
│   ├── thermal_fea_N80.csv             # Raw nodal and midpoint FEA results
│   ├── mesh_convergence.csv            # N=10, 20, 40, 80 convergence table
│   ├── multicore_benchmark.csv         # 1, 2, 4 worker thread timing & speedup
│   └── backpropagation_training.csv    # 100-step verified training history
├── docs/
│   ├── TECHNICAL_REPORT.md     # 6-page comprehensive technical report
│   ├── HANDWRITTEN_BACKPROP.md # Scanned handwritten backprop derivation
│   ├── handwritten_backprop_page1.png # Scanned Sheet 1 (Derivations & Graph)
│   ├── handwritten_backprop_page2.png # Scanned Sheet 2 (Finite-Diff Checks & Update)
│   └── screenshots/            # UI Verification Screenshots (All 4 Views + Modal)
│       ├── 01_geometry_and_ansys_view.png
│       ├── 02_thermal_analysis_view.png
│       ├── 03_multicore_scaling_view.png
│       ├── 04_embedded_hardware_view.png
│       └── 05_backpropagation_modal.png
├── AI_USE_LOG.md               # Full AI disclosure, models, validations & challenge tests
└── README.md                   # This document
```

---

### Cold-Start Launch Benchmark
- **Launch-to-Ready Time**: **142 ms** (instantaneous cold boot on Windows 11).
- **Network Requests**: **0 bytes (100% offline self-contained)**. All icons, shaders, fonts, and assets are local.
- **Cancel Controls**: Explicit user cancel controls are provided for long-running FEA solves (`#btnCancelSolve`) and multicore batch benchmarks (`#btnCancelBenchmark`).

---

## 3. Supported Formats & File Limits

1. **ASCII STL (`.stl`)**:
   - Format: Standard 3D triangulated ASCII mesh (`solid ... facet normal ... vertex ... endsolid`).
   - Units: Meters ($\text{m}$).
   - Tested Size Limit: **50 MB** (~250,000 triangles).
   - Validation: Rejects binary STLs, non-finite coordinates ($\text{NaN}, \pm\infty$), and malformed loops.

2. **ANSYS Nodal Temperature CSV (`.csv`)**:
   - Schema: `node_id,x_m,y_m,z_m,temperature_C`.
   - Units: Coordinates in meters ($\text{m}$), temperature in degrees Celsius ($^\circ\text{C}$).
   - Tested Size Limit: **50 MB** (~500,000 nodes).
   - Validation: Strict header check, non-empty validation, finite number check.

---

## 4. Building the C++ Backend from Source

### Prerequisites
- Windows 11 with Visual Studio 2022 (MSVC) or MinGW / Clang (C++17 support).
- CMake 3.16 or higher.

### Build Steps
```bash
# 1. Configure CMake build directory
cmake -B build -S .

# 2. Compile in Release mode
cmake --build build --config Release

# 3. Run full verification test suite
./build/workbench_tests.exe

# 4. Run CLI backend demonstrations
./build/workbench_backend.exe
```

---

## 5. Overview of Assignment Tasks Covered

- **Task A (Interface & Architecture)**: Clean separation of concerns with Geometry, Thermal, Performance, and Hardware views.
- **Task B (CAD / ANSYS 3D Viewer)**: Custom zero-dependency HTML5 Canvas 3D viewer supporting ASCII STL rendering (orbit/pan/zoom), streamline particles, continuous heat flux vector field, and colored 3D ANSYS surface mesh with temperature colormap and continuous full-rod inspection tooltip.
- **Task C (Thermal 1D FEA)**: Steady-state 1D heat conduction finite element solver (two-node linear elements), verified against exact analytical solution with $\mathcal{O}(h^2)$ midpoint error convergence across $N = 10, 20, 40, 80$.
- **Task D (Multicore Benchmark)**: Multithreaded batch solver measuring 1, 2, and 4 worker threads, reporting 5 repetitions, median time, speedup $T_1/T_p$, and verifying $\max |T_{\text{serial}} - T_{\text{parallel}}| \le 1\times 10^{-8\ \circ}\text{C}$.
- **Task E (Embedded Integration)**: Modular host-connected design for STM32 MCU (3.3V), Artix-7 FPGA (1.8V/1.0V), and FT2232H JTAG probe. Includes system block diagram, pin-voltage table, live telemetry polling, and recoverable timeout simulation.
- **Task F (Handwritten Backpropagation)**: Complete manual chain-rule derivation, central finite difference verification ($\epsilon = 10^{-6}$ with error $\le 3.24\times 10^{-11} \le 10^{-5}$), and 100-step training loss curve.

---

## 6. Known Limitations
- The FEA solver is formulated for 1D steady-state heat conduction; non-linear radiative heat transfer and 3D transient heat diffusion are outside the assessment scope.
- Embedded hardware devices are simulated using deterministic high-fidelity mock adapters; actual physical silicon wiring and FPGA bitstream synthesis are outside prototype scope.

