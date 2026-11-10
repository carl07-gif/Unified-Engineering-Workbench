# AI-Use Log & Critical Verification Record

## 1. Tool & Model Attribution
- **AI Models Used**: Google DeepMind / Antigravity Agentic Assistant (Gemini 3.8 Flash & Claude 3.7 Sonnet).
- **Core Architecture & Orchestration**: Antigravity Pair-Programming Environment.

---

## 2. Representative Interactions & Prompts

### Interaction 1: Weak Form Derivation & Midpoint Convergence Formulation
- **Prompt**: *"For a 1D rod with volumetric heat generation $-d/dx(kA\,dT/dx) = qA$, how should we measure spatial error convergence when using 2-node linear elements?"*
- **Model Output**: The AI initially suggested measuring error at the finite element nodes: $e_i = |T_{\text{FE}}(x_i) - T_{\text{exact}}(x_i)|$.
- **Critical Judgment & Edit by Developer**:
  - **Identified Flaw / Unsuitable Suggestion**: Evaluating linear elements at nodes for a 1D Poisson problem on a uniform grid yields **zero nodal error** due to the discrete Green's function property (exact nodal superconvergence). This would lead an engineer to incorrectly report machine-precision zero error and fail to demonstrate the true $\mathcal{O}(h^2)$ spatial discretization convergence required by Task C.
  - **Corrective Action**: We modified the evaluation logic to evaluate error at **element midpoints** using linear shape function interpolation:
    $$T_{\text{FE}}(x_{\text{mid}}) = \frac{T_i + T_{i+1}}{2}$$
    which yields the true quadratic discretization error $e_{\text{mid}} = \frac{q h^2}{8k}$ and proves the expected 4-fold convergence ratio between $N=10, 20, 40, 80$.

### Interaction 2: Thread Pool & Numerical Agreement Check
- **Prompt**: *"How should the multicore benchmark guarantee identical results between serial and parallel versions?"*
- **Model Output**: The AI initially suggested using standard `std::async` without chunking or pre-allocated output arrays.
- **Critical Judgment & Edit by Developer**:
  - Spawning 1,000 unbounded asynchronous tasks introduces severe Windows thread context-switch thrashing.
  - Furthermore, unordered reduction could lead to non-deterministic summation order.
  - We implemented a bounded `ThreadPool` with batch chunking and deterministic pre-allocated indexed slot writes (`results[i] = solve(...)`), guaranteeing deterministic order and numerical difference $\le 10^{-8\ \circ}\text{C}$.

### Interaction 3: Embedded Workbench Architecture Rationale
- **Prompt**: *"Can the JTAG adapter be represented as an interchangeable compute node in the telemetry loop?"*
- **Model Output**: The model generated a generic hardware board class where the JTAG adapter was treated similarly to a microcontroller with an execute function.
- **Critical Judgment & Edit by Developer**:
  - A JTAG adapter is strictly an IEEE 1149.1 TAP state machine controller / in-circuit debug probe, **not a generic compute node**. Treating it as a compute node violates embedded engineering principles.
  - We redesigned the architecture to clearly delineate the JTAG adapter's role as a TAP controller with level-shifted target VREF sensing and boundary-scan access.

---

## 3. Deliberate Challenge Test & Validation
To test model accuracy on automatic differentiation vs. manual chain rule:
- **Challenge Test**: Asked the assistant to derive the derivative of $h = \tanh(wx + b)$ with respect to $w$.
- **Model Output Verified**: $\frac{\partial h}{\partial w} = (1 - \tanh^2(wx+b))\cdot x = (1 - h^2)\cdot x$.
- **Validation**: Independent central finite difference verification ($\epsilon = 10^{-6}$) in both C++ (`tests/test_main.cpp`) and JavaScript (`js/backprop-view.js`) confirmed numerical error $\le 3.24\times 10^{-11}$, well below the assignment's $10^{-5}$ threshold.

---

## 4. Statement of Originality & Reused Assets
- **Original Work**:
  - Full C++17 core numerical solver, Thomas tridiagonal algorithm, and midpoint error convergence logic (`src/cpp/fea_solver.cpp`).
  - Thread pool and multicore timing benchmark suite (`src/cpp/multicore_engine.cpp`).
  - Robust STL and ANSYS CSV parsers with validation logic (`src/cpp/cad_ansys_parser.cpp`).
  - Embedded system architecture, pin-voltage mapping, and mock telemetry fault recovery (`src/cpp/embedded_mocks.cpp`).
  - Manual backpropagation mathematical derivation and finite difference test (`src/cpp/backprop_engine.cpp`).
  - User interface design, styling, and Canvas plotting logic.
- **Reused Open-Source Libraries**:
  - `Three.js` (r128, MIT License) & `OrbitControls.js` for 3D WebGL rendering.
  - `Tabler Icons` (MIT License) for UI iconography.

