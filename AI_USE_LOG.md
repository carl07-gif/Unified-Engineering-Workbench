# AI-Use Log & Critical Verification Record
**PASS Science Works R&D Internship 2026–2027 | Unified Engineering Workbench**

---

## 1. Tool & Model Attribution
All automated code assistance and scaffolding were logged with exact versioned model identifiers and reviewed by the lead candidate:

| AI Model Identifier | Provider / Platform | Primary Role in Project | Verification Method |
|---|---|---|---|
| `anthropic/claude-3-5-sonnet-20241022` | Anthropic (API) | Initial FEA & C++ thread pool scaffolding | Unit tests (`tests/test_main.cpp`), GCC/Clang/MSVC builds |
| `google/gemini-2.5-pro-exp` | Google DeepMind | Technical report synthesis & math verification | KaTeX derivations, finite-difference gradient checks |
| `openai/gpt-4o` | OpenAI (API) | Cross-validation & edge-case stress prompts | Independent analytical checks, ASCII STL parsing edge cases |

---

## 2. Architectural Decisions & AI Recommendation Audits

### 2.1 Major Architectural Override: Rejection of Three.js in Favor of Pure Canvas
> [!IMPORTANT]
> **Resolution of Dependency Disclosure**:
> During initial architectural design, AI models (`Claude 3.5 Sonnet` and `GPT-4o`) strongly recommended importing `three.min.js` and `OrbitControls.js` via CDN to render the 3D cylindrical heat sink. 
> 
> **Developer Critical Audit**:
> 1. Importing Three.js violates the assignment's core requirement of **100% self-contained, air-gapped offline execution** with zero external network dependencies.
> 2. Bundling a 600 KB minified library adds unnecessary opaque runtime overhead for a well-defined cylindrical geometry.
> 3. **Action Taken**: The developer **rejected the Three.js proposal** and implemented a custom, lightweight, zero-dependency 3D perspective projection rasterizer in native HTML5 Canvas 2D (`js/cad-viewer.js`). As documented in `DEPENDENCIES.md`, the final workbench contains **zero third-party JavaScript libraries**.

---

## 3. Iterative Prompt Engineering Records

### Iteration 1: Spatial Discretization Convergence Metric (Task C)
- **Initial Prompt to AI**:
  ```text
  "For a 1D rod with volumetric heat generation -d/dx(kA dT/dx) = qA, how should we measure spatial error convergence when using 2-node linear elements?"
  ```
- **Initial AI Response**:
  The AI suggested computing nodal error: $e_i = |T_{\text{FE}}(x_i) - T_{\text{exact}}(x_i)|$.
- **Developer Review & Flaw Identification**:
  Evaluating linear 1D elements at finite element nodes for a uniform Poisson problem yields **exact nodal superconvergence ($e_i \approx 0$)** due to the discrete Green's function property. Reporting nodal error would falsely indicate machine-precision zero error and completely mask the true $\mathcal{O}(h^2)$ spatial discretization error required by Task C.
- **Refinement Prompt**:
  ```text
  "Explain why 1D linear elements exhibit superconvergence at the nodes, and formulate an element midpoint evaluation scheme to demonstrate true O(h^2) convergence."
  ```
- **Final Outcome**:
  Implemented midpoint error evaluation:
  $$e_{\text{mid}} = \left| \frac{T_i + T_{i+1}}{2} - T_{\text{exact}}\left(x_i + \frac{h}{2}\right) \right| = \frac{q h^2}{8k}$$
  Verified exact quadratic convergence across $N = 10, 20, 40, 80$ ($1.25^\circ\text{C} \to 0.3125^\circ\text{C} \to 0.0781^\circ\text{C} \to 0.0195^\circ\text{C}$).

---

### Iteration 2: Thread Pool Race Conditions & Numerical Agreement (Task D)
- **Initial Prompt to AI**:
  ```text
  "Write a parallel benchmark running 1,000 independent 1D thermal solves across 1, 2, and 4 threads."
  ```
- **Initial AI Response**:
  The AI provided code using `std::async(std::launch::async, ...)` pushing to a `std::vector` guarded by a mutex.
- **Developer Review & Flaw Identification**:
  1. Spawning 1,000 individual `std::async` tasks causes thread thrashing and OS scheduler overhead, skewing Amdahl scaling measurements.
  2. Mutex-guarded vector pushes result in non-deterministic result ordering, making bitwise serial-parallel verification impossible.
- **Refinement Prompt**:
  ```text
  "Design a persistent worker ThreadPool with static contiguous chunking. Each worker must write into pre-allocated indexed slots results[i] without locking, guaranteeing deterministic order and zero thread contention."
  ```
- **Final Outcome**:
  Implemented persistent `ThreadPool` in `src/cpp/multicore_engine.cpp` with deterministic chunking. Achieved bitwise numerical agreement $\Delta T \le 10^{-12}\ ^\circ\text{C}$ between serial and parallel runs.

---

### Iteration 3: JTAG Probe Role in Embedded System Architecture (Task E)
- **Initial Prompt to AI**:
  ```text
  "Provide a class hierarchy for the hardware workbench managing MCU, FPGA, and JTAG."
  ```
- **Initial AI Response**:
  The AI created an abstract base class `ComputeNode` inherited equally by `Microcontroller`, `FpgaAccelerator`, and `JtagAdapter`, giving the JTAG adapter an `execute()` method.
- **Developer Review & Flaw Identification**:
  In embedded systems engineering, an FTDI FT2232H JTAG adapter is **never a peer computing node**. It is an **IEEE 1149.1 Test Access Port (TAP) state machine master** used for boundary scan, hardware breakpoint injection, and register inspection.
- **Refinement Prompt**:
  ```text
  "Re-architect the embedded manager: separate compute nodes from debug probes. Model the JTAG adapter as an IEEE 1149.1 TAP state machine with TCK/TMS/TDI/TDO signal lines and level-shifted VREF sensing."
  ```
- **Final Outcome**:
  Produced technically rigorous embedded architecture with proper bidirectional level shifting (TXB0108), star ground topology, and realistic recoverable timeout fault handling.

---

## 4. Challenge Test & Numerical Verification
To independently verify mathematical rigor against automatic differentiation hallucination:
- **Challenge Prompt**:
  ```text
  "Derive the exact analytical gradient of J = 0.5*(v*tanh(w*x + b) + c - y)^2 with respect to w, and provide the numerical finite-difference verification formula."
  ```
- **Model Output**:
  $$\frac{\partial J}{\partial w} = (\hat{y} - y) \cdot v \cdot (1 - \tanh^2(w x + b)) \cdot x$$
- **Independent Validation**:
  Central finite difference verification ($\epsilon = 10^{-6}$) in `tests/test_main.cpp`:
  $$\frac{\partial J}{\partial w}\bigg|_{\text{FD}} = \frac{J(w + \epsilon) - J(w - \epsilon)}{2\epsilon}$$
  - Analytical: `-1.20946445`
  - Numerical: `-1.20946445`
  - Absolute Error: $3.24 \times 10^{-11} \le 10^{-5}$ (**PASSED**).

---

## 5. Original Work Statement
- **Original Code & Engineering Design**:
  - Full C++17 core numerical solver, Thomas tridiagonal algorithm, and midpoint error convergence logic (`src/cpp/fea_solver.cpp`).
  - Thread pool and multicore timing benchmark suite (`src/cpp/multicore_engine.cpp`).
  - Robust STL and ANSYS CSV parsers with strict format validation (`src/cpp/cad_ansys_parser.cpp`).
  - Embedded system architecture, pin-voltage mapping, and mock telemetry fault recovery (`src/cpp/embedded_mocks.cpp`).
  - Manual backpropagation mathematical derivation and finite difference test (`src/cpp/backprop_engine.cpp`).
  - Zero-dependency HTML5 2D/3D Canvas custom renderer (`js/cad-viewer.js`).
- **Third-Party Runtime Dependencies**: **NONE** (100% Vanilla JS + HTML5 Canvas + Native C++17).
