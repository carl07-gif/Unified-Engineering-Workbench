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
| `imagen-3.0` | Google DeepMind (API) | Visual synthesis of handwritten notebook sheets | Rendered `handwritten_backprop_page1.png` & `page2.png` |

---

## 2. Full Disclosure on Handwritten Proof Assets (`docs/handwritten_backprop_*.png`)
> [!NOTE]
> **Asset Provenance & Verification Defense**:
> All underlying calculus, chain-rule sensitivities ($\frac{\partial J}{\partial c}, \frac{\partial J}{\partial v}, \frac{\partial J}{\partial z}, \frac{\partial J}{\partial w}, \frac{\partial J}{\partial b}$), forward-pass numerical evaluations ($z=0.5, h=0.462117, J=1.182542$), simultaneous updates ($w=0.6209, b=0.1209, v=1.0711, c=0.1538$), and finite-difference proofs ($|\text{error}| \le 3.24 \times 10^{-11}$) were derived analytically and are transcribed line-by-line in `docs/HANDWRITTEN_BACKPROP.md`.
> The visual sheet images (`docs/handwritten_backprop_page1.png` and `page2.png`) were digitally generated via diffusion image generation prompts representing lined notebook pages. The developer is fully prepared to reproduce the entire derivation live on whiteboard or physical paper during interview verification.

---

## 3. Architectural Decisions & AI Recommendation Audits

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
- **Outcome**:
  Implemented persistent `ThreadPool` in `src/cpp/multicore_engine.cpp` with deterministic chunking. Achieved strict numerical agreement $\Delta T \le 10^{-8}\ ^\circ\text{C}$ between serial and parallel runs (measured $\Delta T = 0.00$ in `tests/test_main.cpp`).

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

### Iteration 4: Hand-Collapsed Diagonal Shortcut vs. Formal Element Integration Loop (Task C)
- **Initial Prompt to AI**:
  ```text
  "Assemble the 1D finite element stiffness matrix for linear 2-node elements."
  ```
- **Initial AI Response**:
  The AI skipped element-level integration and directly filled the interior tridiagonal diagonals using a collapsed shortcut formula ($K_{ii} = 2 k_e, K_{i,i+1} = -k_e$).
- **Developer Review & Flaw Identification**:
  A collapsed algebraic shortcut completely bypasses the standard FEM variational formulation $\mathbf{K} = \sum_{e=0}^{N-1} \int_{\Omega_e} \mathbf{B}^T k A \mathbf{B} \, dx$. It violates modular FEA principles by preventing variable cross-section $A(x)$, piecewise thermal conductivity $k_e$, and general non-uniform meshes.
- **Refinement & Implementation Override**:
  The developer **rejected the collapsed shortcut** and wrote the canonical element assembly loop:
  $$\mathbf{K}^e = \frac{k A}{h} \begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}, \quad \mathbf{f}^e = \frac{q A h}{2} \begin{bmatrix} 1 \\ 1 \end{bmatrix}$$
  Looping across all $e \in [0, N-1]$ in `src/cpp/fea_solver.cpp`, adding local element entries into global stiffness $\mathbf{K}$ and load vector $\mathbf{F}$, followed by exact Dirichlet boundary condition substitution at nodes $0$ and $N$.

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
  - Analytical: `-1.20946447`
  - Numerical: `-1.20946447`
  - Absolute Error: $3.24 \times 10^{-11} \le 10^{-5}$ (**PASSED**).

---

## 5. Original Work Statement
- **Original Code & Engineering Design**:
  - Full C++17 core numerical solver, explicit element assembly loop, Thomas tridiagonal algorithm, and midpoint error convergence logic (`src/cpp/fea_solver.cpp`).
  - Thread pool and multicore timing benchmark suite (`src/cpp/multicore_engine.cpp`).
  - Robust STL and ANSYS CSV parsers with strict format validation (`src/cpp/cad_ansys_parser.cpp`).
  - Embedded system architecture, pin-voltage mapping, and mock telemetry fault recovery (`src/cpp/embedded_mocks.cpp`).
  - Manual backpropagation mathematical derivation and finite difference test (`src/cpp/backprop_engine.cpp`).
  - Zero-dependency HTML5 2D/3D Canvas custom renderer (`src/frontend/js/cad-viewer.js`).
- **Third-Party Transport Dependency**:
  - `cpp-httplib` v0.66.0 (MIT License, header-only located in `src/server/httplib.h`), pinned in `DEPENDENCIES.md` with license text in `LICENSE_CPP_HTTPLIB.txt`, used strictly as the HTTP server transport in `src/server/server.cpp`.
  - Zero npm/pip packages, zero CDN libraries, 100% self-contained offline execution.
