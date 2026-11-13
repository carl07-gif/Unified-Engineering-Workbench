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
├── Launch.bat                  # One-click standalone Windows launcher script
├── Launch.exe                  # Native Win32 C++ launcher (compiled from src/cpp/launcher_win.cpp)
├── workbench_server.exe        # Pre-built Windows x64 native C++17 REST backend
├── index.html                  # Forwarder redirect to src/frontend/index.html
├── src/
│   ├── frontend/               # Single canonical presentation layer
│   │   ├── index.html          # Responsive unified workbench interface (4 views)
│   │   ├── css/
│   │   │   ├── styles.css      # Custom design system (Light/Dark themes)
│   │   │   └── icons.css       # 100% self-contained offline SVG icon masks (Zero CDN)
│   │   └── js/
│   │       ├── api-client.js   # HTTP client communicating with C++ backend (127.0.0.1:7474)
│   │       ├── app.js          # Main UI controller & lifecycle coordinator
│   │       ├── fem-solver.js   # Thermal FEA view controller & numerical display
│   │       ├── chart.js        # Canvas high-DPI temperature & error plotter
│   │       ├── cad-parsers.js  # Client-side format validators (mirrors C++ parsers)
│   │       ├── cad-viewer.js   # Zero-dependency custom HTML5 Canvas 3D CAD/FEA viewer
│   │       ├── camera.js       # Orbit, pan, zoom 3D camera controls
│   │       ├── cloud-view.js   # 3D ANSYS colored point cloud & surface rasterizer
│   │       ├── tooltip.js      # Continuous raycast inspection tooltip
│   │       ├── multicore-view.js # Multithreaded benchmark dashboard (with Cancel control)
│   │       ├── embedded-view.js# Deterministic embedded telemetry & fault recovery
│   │       └── backprop-view.js# Backpropagation derivation & finite difference view
│   ├── cpp/                    # C++17 Pure Core Engine
│   │   ├── fea_solver.hpp/.cpp         # 1D Steady-state thermal FEA (element loop assembly)
│   │   ├── cad_ansys_parser.hpp/.cpp   # ASCII STL & ANSYS CSV parsers (50 MB limit)
│   │   ├── multicore_engine.hpp/.cpp   # Thread pool & parallel benchmark (workers 1, 2, 3, 4)
│   │   ├── embedded_mocks.hpp/.cpp     # MCU, FPGA, and JTAG adapters (with <cmath>)
│   │   ├── backprop_engine.hpp/.cpp    # Analytical gradient backprop
│   │   ├── launcher_win.cpp            # Win32 WinMain launcher source
│   │   └── main.cpp                    # Standalone CLI & backend runner
│   └── server/                 # C++17 HTTP REST Transport Layer
│       ├── httplib.h           # cpp-httplib v0.66.0 (MIT License)
│       └── server.cpp          # Multi-endpoint REST server with watchdog & heartbeat
├── data/
│   ├── sample_geometry.stl     # Valid ASCII STL cuboid heat sink (12 facets)
│   ├── sample_ansys_nodal_temps.csv # Synthetic ANSYS nodal temperature CSV (44 nodes)
│   ├── invalid_malformed.stl   # Negative test STL
│   ├── invalid_ansys.csv       # Negative test CSV
│   └── DATA_PROVENANCE.md      # Schemas, units, origins, and limits
├── tests/
│   └── test_main.cpp           # Complete C++ unit test suite (49 positive, negative, boundary, and numerical tests)
├── results/
│   ├── mesh_convergence_plot.png       # High-res O(h²) error convergence plot
│   ├── temperature_profile_N80.png     # High-res T(x) FEA vs analytical profile plot
│   ├── multicore_scaling_speedup.png   # High-res thread speedup & Amdahl scaling plot
│   ├── backprop_loss_gradient_curve.png# High-res 100-step loss & gradient check plot
│   ├── cad_ansys_thermal_verification.png # ANSYS 3D surface correlation plot
│   ├── thermal_fea_N10.csv             # Full nodal results for N=10
│   ├── thermal_fea_N20.csv             # Full nodal results for N=20
│   ├── thermal_fea_N40.csv             # Full nodal results for N=40
│   ├── thermal_fea_N80.csv             # Full nodal results for N=80
│   ├── midpoint_errors.csv             # Midpoint errors (1.25 -> 0.0195 C)
│   ├── mesh_convergence.csv            # N=10, 20, 40, 80 convergence table
│   ├── multicore_benchmark.csv         # 1, 2, 3, 4 worker thread timing & speedup
│   └── backpropagation_training.csv    # 100-step verified training history
├── docs/
│   ├── TECHNICAL_REPORT.md     # 6-page comprehensive technical report
│   ├── HANDWRITTEN_BACKPROP.md # Transcribed handwritten backprop derivation
│   ├── handwritten_backprop_page1.png # Sheet 1 (Derivations & Graph)
│   ├── handwritten_backprop_page2.png # Sheet 2 (Finite-Diff Checks & Update)
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

### Cold-Start Launch & Runtime Characteristics
- **Offline Delivery**: **100% offline self-contained**. All icons, shaders, fonts, and assets are local with zero external CDN dependencies.
- **Cancel Controls**: Explicit user cancel controls are provided for long-running FEA solves (`#btnCancelSolve`) and multicore batch benchmarks (`#btnCancelBenchmark`).

---

## 3. Supported Formats & File Specifications

1. **ASCII STL (`.stl`)**:
   - Format: Standard 3D triangulated ASCII mesh (`solid ... facet normal ... vertex ... endsolid`).
   - Units: Meters ($\text{m}$).
   - Validation: Rejects binary STLs, non-finite coordinates ($\text{NaN}, \pm\infty$), non-positive nodes, and malformed loops.

2. **ANSYS Nodal Temperature CSV (`.csv`)**:
   - Schema: `node_id,x_m,y_m,z_m,temperature_C`.
   - Units: Coordinates in meters ($\text{m}$), temperature in degrees Celsius ($^\circ\text{C}$).
   - Validation: Strict header check, non-empty validation, finite number check, positive node IDs.

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

---

## 7. Development Effort Hours Breakdown
Total development effort: **46.0 hours**:

| Phase / Module | Scope & Core Engineering Milestones | Hours | Deliverables |
|---|---|---|---|
| **Task A: Unified UI Architecture** | 4 views, dark/light themes, offline SVG icons, status badge | **6.5 hrs** | `index.html`, `css/` |
| **Task B: CAD & ANSYS 3D Viewer** | HTML5 Canvas 2D/3D rasterizer, STL & CSV parsers, tooltip | **8.0 hrs** | `js/cad-viewer.js`, `src/cpp/cad_ansys_parser.*` |
| **Task C: Thermal FEA & Convergence** | Explicit element loop assembly, Thomas $\mathcal{O}(N)$ solver, $O(h^2)$ study | **7.5 hrs** | `src/cpp/fea_solver.*`, `results/mesh_convergence.csv` |
| **Task D: Multicore Thread Pool Engine** | Persistent C++17 `ThreadPool`, chunking, $\Delta T \le 10^{-8\ \circ}\text{C}$ check | **7.0 hrs** | `src/cpp/multicore_engine.*`, `results/multicore_benchmark.csv` |
| **Task E: Embedded Hardware Integration** | Pin-voltage table, JTAG TAP state machine, C++ mock adapters | **6.0 hrs** | `src/cpp/embedded_mocks.*`, block diagram |
| **Task F: Handwritten Backpropagation** | Reverse-mode calculus derivation, finite-difference verification | **5.0 hrs** | `src/cpp/backprop_engine.*`, `docs/HANDWRITTEN_BACKPROP.md` |
| **C++ REST Server & Testing** | `cpp-httplib` v0.66.0 transport (`src/server/server.cpp`), 49 CTest unit tests (100% passing) | **6.0 hrs** | `src/server/server.cpp`, `CMakeLists.txt`, `tests/test_main.cpp` |
| **TOTAL VERIFIED EFFORT** | **Multi-disciplinary engineering workbench prototype** | **46.0 hrs** | **100% Offline, Self-Contained Deliverable** |


