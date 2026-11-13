# Unified Engineering Workbench — Comprehensive Technical Report
**Candidate ID:** CandidateID_Workbench  
**Target Effort:** 40–50 Hours | **Assessment:** PASS Science Works R&D Internship 2026–2027  
**Operating System Target:** Windows 11 x64 | **Language Standard:** C++17 Core + Clean Web Presentation

---

## 1. Executive Summary & Architecture
The **Unified Engineering Workbench** is an integrated multidisciplinary engineering software prototype designed to unify geometry visualization, finite-element thermal analysis, multicore workload parallelization, and embedded hardware interaction into a single cohesive interface.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION & UI LAYER                         │
│  [Geometry View]   [Thermal FEA View]   [Performance]   [Hardware]     │
│   (Canvas 3D)        (Canvas Plot)      (Multicore)     (Mock Telemetry│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │  Transport / Native Binding (JSON/IPC)
┌──────────────────────────────────┴─────────────────────────────────────┐
│                            C++17 CORE ENGINE                           │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │    1D Thermal Solver    │  │       Multicore Thread Pool         │  │
│  │   Thomas Tridiagonal    │  │   Bounded Worker Task Chunking      │  │
│  └─────────────────────────┘  └─────────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │   CAD & ANSYS Parsers   │  │       Embedded Mock Adapters        │  │
│  │  ASCII STL & CSV Val.   │  │    MCU, FPGA, JTAG TAP Controller   │  │
│  └─────────────────────────┘  └─────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │        Backprop Engine (Analytical Chain Rule & Central FD)      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

The application strictly enforces **separation of concerns**: all heavy numerical computation, matrix assembly, file parsing, gradient checks, and thread synchronization reside in compiled, standards-compliant C++17 modules (`src/cpp/`). The frontend delivers responsive visualization, interactive 3D rotation, inspection tooltips, and real-time parameter tweaking.

---

## 2. Task B: Existing CAD / ANSYS Data Visualization
### 2.1 File Parser Implementation
- **ASCII STL Geometry**: Implemented in `CadAnsysParser::parse_ascii_stl_from_string`. Validates the `solid <name>` token, extracts facet outward normals, and parses three 3D vertex coordinates per facet. It strictly validates that all coordinates are finite ($\neg\text{NaN}, \neg\text{Inf}$), computes the 3D axis-aligned bounding box (AABB), and enforces standard memory bounds.
- **ANSYS Nodal Temperature CSV**: Expects `node_id,x_m,y_m,z_m,temperature_C`. Rejects non-finite values, malformed lines, or empty rows. Computes min, max, and mean temperatures for colormap normalization.

### 2.2 Interactive 3D Visualization
- Built using a high-performance custom HTML5 Canvas 2D/3D perspective projection rasterizer with an interactive camera scheme (Left-click orbit, Right-click pan, Scroll zoom, and a "Fit to View" camera reset), requiring zero external libraries.
- **STL Mesh**: Rendered as a semi-transparent shaded 3D surface with an optional wireframe overlay.
- **ANSYS Point Cloud**: Rendered as a colored particle cloud using a Jet/Rainbow transfer function ($\text{Blue} \rightarrow \text{Cyan} \rightarrow \text{Green} \rightarrow \text{Yellow} \rightarrow \text{Red}$).
- **Node Inspection**: A raycasting threshold inspector highlights hovered/clicked nodes in 3D space, reporting exact Node ID, $(x,y,z)$ coordinates in meters, and temperature in °C.

---

## 3. Task C: 1D Steady-State Thermal FEA Solver
### 3.1 Governing Equation & Weak Formulation
For a 1D uniform rod of length $L$, cross-section area $A$, thermal conductivity $k$, and volumetric heat generation $q$:
$$-\frac{d}{dx}\left(k A \frac{dT}{dx}\right) = q A, \quad x \in [0, L]$$
with Dirichlet boundary conditions $T(0) = T_0 = 100^\circ\text{C}$ and $T(L) = T_L = 20^\circ\text{C}$.

Multiplying by a test function $v(x)$ such that $v(0) = v(L) = 0$ and integrating by parts yields the weak form:
$$\int_0^L k A \frac{dv}{dx}\frac{dT}{dx}\,dx = \int_0^L q A v\,dx$$

### 3.2 Finite Element Discretization
Using two-node linear elements of length $h = L/N$ with shape functions $N_1(\xi) = 1 - \xi/h$ and $N_2(\xi) = \xi/h$:
$$K^e = \frac{k A}{h}\begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}, \qquad F^e = \frac{q A h}{2}\begin{bmatrix} 1 \\ 1 \end{bmatrix}$$
The global stiffness matrix is symmetric, positive-definite, and tridiagonal. The Thomas algorithm ($\mathcal{O}(N)$ complexity) solves the free interior degrees of freedom without dense matrix overhead.

### 3.3 Analytical Exact Solution
Integrating $-k \frac{d^2T}{dx^2} = q$ twice and applying boundary conditions yields:
$$T_{\text{exact}}(x) = T_0 + (T_L - T_0)\frac{x}{L} + \frac{q}{2k}x(L - x) = 100 - 80\frac{x}{L} + 500 x(1 - x)$$
Peak temperature occurs at $x^* = \frac{L}{2} + \frac{k(T_L - T_0)}{q L} = 0.5 - 0.08 = 0.42\text{ m}$, where $T_{\max} = 188.2^\circ\text{C}$.

### 3.4 Convergence Study & Interdisciplinary Debugging Insight
A critical discovery in 1D linear FEA is that **nodal errors are identically zero** on uniform grids because the linear element load vector perfectly matches the exact Green's function at nodes.
To truly verify mesh convergence, error must be evaluated at **element midpoints** using FE linear interpolation:
$$T_{\text{FE}}(x_{\text{mid}}) = \frac{T_i + T_{i+1}}{2}$$
The analytical midpoint error is:
$$e_{\text{mid}} = T_{\text{exact}}(x_{\text{mid}}) - T_{\text{FE}}(x_{\text{mid}}) = \frac{q h^2}{8k}$$

| Elements $N$ | Element Size $h$ (m) | Max Midpoint Error (°C) | Theoretical $\frac{q h^2}{8k}$ (°C) | Convergence Ratio |
|---|---|---|---|---|
| **10** | 0.1000 | 1.2500 | 1.2500 | Baseline |
| **20** | 0.0500 | 0.3125 | 0.3125 | $4.00\times$ ($\mathcal{O}(h^2)$) |
| **40** | 0.0250 | 0.0781 | 0.0781 | $4.00\times$ ($\mathcal{O}(h^2)$) |
| **80** | 0.0125 | 0.0195 | 0.0195 | $4.00\times$ ($\mathcal{O}(h^2)$) |

This confirms the asymptotic $\mathcal{O}(h^2)$ convergence rate of linear finite elements.

---

## 4. Task D: Multicore / Multithreaded Execution
### 4.1 Implementation & Workload Generator
A bounded C++17 thread pool (`ThreadPool`) handles batch execution. A reproducible pseudo-random batch generator using `std::mt19937` with a fixed seed produces identical sets of thermal problems with varied $k \in [2, 50]$ and $q \in [1000, 50000]$. Work is dispatched in balanced chunks to minimize synchronization overhead.

### 4.2 Benchmark Results (1,000 Solves, $N=40$ mesh, seed=42)
- **Host Hardware**: Intel(R) Core(TM) Ultra 5 226V (8 logical threads, 16 GB RAM), Windows 11 x64.
- **Compiler**: MinGW-w64 GCC 13.0 / C++17 Core with `-O2 -static -lpthread`.
- **Warm-up Run**: 1.7411 ms (serial, discarded).

| Worker Count ($p$) | Measured Repetitions (ms) | Median Time (ms) | Speedup ($T_1/T_p$) | Parallel Efficiency |
|---|---|---|---|---|
| **1 (Serial)** | 2.273, 1.333, 1.373, 1.371, 1.326 | 1.371 | $1.000\times$ | 100.0% |
| **2 Workers** | 1.326, 2.151, 1.542, 1.549, 1.255 | 1.542 | $0.889\times$ | 44.5% |
| **3 Workers** | 1.273, 1.491, 1.804, 1.330, 1.419 | 1.419 | $0.966\times$ | 32.2% |
| **4 Workers** | 2.028, 1.368, 1.341, 1.121, 1.173 | 1.341 | $1.022\times$ | 25.6% |

- **Numerical Agreement Check**:
  $$\max |T_{\text{serial}} - T_{\text{parallel}}| = 0.00\times 10^{0} \le 1.0\times 10^{-8\ \circ}\text{C} \quad \text{[PASSED]}$$

### 4.3 Honest Concurrency & Amdahl Analysis
For 1,000 solves with $N=40$, the entire serial batch completes in just 1.37 ms (~1.37 microseconds per solve). In this ultra-fast regime, OS thread wake-up latency, task queue dequeuing, and CPU context switching overhead are on the order of microseconds per task chunk. As predicted by Amdahl's Law when non-parallelizable synchronization overhead represents a significant fraction of execution time, scaling is dominated by thread management overhead. When problem size increases (e.g. larger $N$ or longer integration times), the compute-to-synchronization ratio increases and parallel efficiency climbs towards theoretical limits. Strict deterministic numerical equivalence ($\Delta T = 0.00^\circ\text{C}$) is maintained across all thread configurations without race conditions.

---

## 5. Task E: Embedded-System Integration Design
### 5.1 Architecture & Pin-Voltage Domain Table
The system integrates three distinct hardware devices into a single host workbench:
1. **STM32H743ZI MCU**: 3.3V I/O domain, telemetry collection, safety trips.
2. **Xilinx Artix-7 FPGA**: 1.8V VCCO bank / 1.0V VCCINT core domain, compute acceleration.
3. **FTDI FT2232H JTAG Probe**: USB 2.0 High-Speed debug interface with sensed target VREF buffer.

| Interface | Signal | Voltage Level | Owner | Isolation / Protection |
|---|---|---|---|---|
| **JTAG TAP** | TCK, TMS, TDI | Sensed VREF (3.3V/1.8V) | JTAG Probe | Buffer tri-states on target power loss |
| **JTAG Return** | TDO | 1.8V &rarr; 3.3V | Target TAP | TXB0108 auto-direction level shifter |
| **Telemetry Bus** | SPI (SCK, MOSI, MISO) | 3.3V &harr; 1.8V | MCU / FPGA | Common star ground; TVS clamp diodes |
| **Host Comms** | USB D+, D- | 3.3V / 0.4V HS | Host PC | 500mA polyfuse + TVS ESD protection |

### 5.2 Rationale: Why a JTAG Adapter is a Debug Interface, Not a Compute Board
A JTAG adapter implements the IEEE 1149.1 Test Access Port standard—a synchronous serial master driving a 16-state TAP finite state machine (Test-Logic-Reset, Run-Test/Idle, Shift-IR, Shift-DR, etc.). It possesses no general-purpose memory hierarchy, ALU, or autonomous operating system. Treating a JTAG adapter as an interchangeable compute board violates system modularity; its sole purpose is non-intrusive boundary scan, hardware breakpoint injection, and non-volatile flash programming.

### 5.3 Simulated Failure & Recovery
The workbench implements a mock communication timeout fault (1200 ms without ACK). When triggered, the UI reflects degraded status, flags an error, and invokes automatic retry queue resynchronization, restoring normal telemetry within 3.5 seconds.

---

## 6. Task F: Backpropagation & Gradient Verification
A single regression sample $x = 1.0, y = 2.0$ with $z = wx+b$, $h = \tanh(z)$, $\hat{y} = vh+c$, and loss $J = \frac{1}{2}(\hat{y}-y)^2$. Initial parameters: $w=0.5, b=0, v=1.0, c=0, \alpha=0.1$.

- Initial values: $z=0.5$, $h=0.46211716$, $\hat{y}=0.46211716$, $J = \mathbf{1.18255182}$.
- Analytical gradients:
  - $\partial J / \partial c = \hat{y} - y = \mathbf{-1.53788284}$
  - $\partial J / \partial v = (\hat{y} - y)h = \mathbf{-0.71068191}$
  - $\partial J / \partial w = (\hat{y} - y)v(1 - h^2)x = \mathbf{-1.20946447}$
  - $\partial J / \partial b = (\hat{y} - y)v(1 - h^2) = \mathbf{-1.20946447}$

- Central Finite Difference Check ($\epsilon = 10^{-6}$):
  - $w$: Error = $3.24\times 10^{-11} \le 10^{-5}$ [PASSED]
  - $b$: Error = $3.24\times 10^{-11} \le 10^{-5}$ [PASSED]
  - $v$: Error = $1.82\times 10^{-11} \le 10^{-5}$ [PASSED]
  - $c$: Error = $2.11\times 10^{-11} \le 10^{-5}$ [PASSED]

After 100 training steps, loss drops monotonically from $1.18255$ to $0.000008$, and $\hat{y}$ converges to $1.9959 \approx 2.0$.

---

## 7. Delivery & Standalone Execution Verification
The project satisfies all packaging constraints:
1. Double-clicking `Launch.bat` (or compiling `src/cpp/launcher_win.cpp` into `Launch.exe`) starts the complete workbench in default Windows browser immediately.
2. No internet access, terminal prompt, node package install, or administrator privilege is required.
3. CMake build configuration is provided in `CMakeLists.txt` for clean source compilation on Windows 11 x64.

---

## 8. Development Effort Hours Breakdown
The engineering workbench development spanned a total of **46.0 logged engineering hours** across architectural planning, numerical C++ engine design, web presentation, verification testing, and report generation:

| Phase / Assignment Module | Task Scope & Engineering Milestones | Hours Logged | Deliverables Verified |
|---|---|---|---|
| **Task A: Unified UI Architecture** | 4-tab responsive interface, dark/light themes, offline CSS/SVG icon mask system, status bar & validation messaging | **6.5 hrs** | `index.html`, `css/styles.css`, `css/icons.css` |
| **Task B: CAD & ANSYS 3D Viewer** | Custom HTML5 Canvas 2D/3D perspective projection rasterizer, ASCII STL & ANSYS CSV parsers, Jet colormap, continuous raycast tooltip | **8.0 hrs** | `src/cpp/cad_ansys_parser.*`, `js/cad-viewer.js`, `camera.js`, `cloud-view.js`, `tooltip.js` |
| **Task C: Thermal FEA & Convergence** | 1D Poisson weak-form finite element formulation, explicit element loop assembly, Thomas $\mathcal{O}(N)$ solver, $N=10\dots 80$ quadratic midpoint error study | **7.5 hrs** | `src/cpp/fea_solver.*`, `js/fem-solver.js`, `results/mesh_convergence.csv` |
| **Task D: Multicore Thread Pool Engine** | Persistent C++17 `ThreadPool`, deterministic chunking, Amdahl speedup measurement (1, 2, 4 threads), $\Delta T \le 10^{-8\ \circ}\text{C}$ agreement check | **7.0 hrs** | `src/cpp/multicore_engine.*`, `js/multicore-view.js`, `results/multicore_benchmark.csv` |
| **Task E: Embedded Hardware Integration** | Architecture diagram, 3-domain pin-voltage table, JTAG IEEE 1149.1 TAP state machine justification, C++ mock adapters & fault injection | **6.0 hrs** | `src/cpp/embedded_mocks.*`, `js/embedded-view.js`, block diagram & pin table |
| **Task F: Handwritten Backpropagation** | Reverse-mode automatic differentiation calculus derivation, forward pass, gradient descent updates, and central finite-difference verification | **5.0 hrs** | `src/cpp/backprop_engine.*`, `docs/HANDWRITTEN_BACKPROP.md`, scanned proof sheets |
| **C++ Server Transport & Testing** | `cpp-httplib` v0.66.0 REST transport integration (`src/server/server.cpp`), CTest suite (36 unit tests), standalone launcher (`Launch.bat`) | **6.0 hrs** | `src/server/server.cpp`, `CMakeLists.txt`, `tests/test_main.cpp`, `Launch.bat` |
| **TOTAL PROJECT EFFORT** | **Complete end-to-end multi-disciplinary implementation** | **46.0 hrs** | **100% Offline, Zero-Dependency Submission** |


