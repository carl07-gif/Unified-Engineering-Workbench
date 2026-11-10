/* ═══════════════════════════════════════════════════════════════
   FEM Thermal Solver — 1-D Steady-State Heat Conduction
   ═══════════════════════════════════════════════════════════════
   Governing equation:  −k · d²T/dx² = q   on [0, L]
   Boundary conditions: T(0) = T₀,  T(L) = T_L  (Dirichlet)
   
   Discretisation:      Linear (2-node) elements, N uniform
   Solver:              Thomas algorithm (tridiagonal)
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const FEMSolver = (() => {

  /* ─────────────────────────────────────────────
     Exact (analytical) solution
     T(x) = T₀ + (T_L − T₀)(x/L) + (q/2k)·x·(L − x)
     ───────────────────────────────────────────── */
  function exactSolution(x, L, k, q, T0, TL) {
    return T0 + (TL - T0) * (x / L) + (q / (2 * k)) * x * (L - x);
  }

  /* ─────────────────────────────────────────────
     Generate exact solution at many points
     ───────────────────────────────────────────── */
  function exactCurve(L, k, q, T0, TL, numPts = 201) {
    const xs = [], ts = [];
    for (let i = 0; i < numPts; i++) {
      const x = (i / (numPts - 1)) * L;
      xs.push(x);
      ts.push(exactSolution(x, L, k, q, T0, TL));
    }
    return { x: xs, T: ts };
  }

  /* ─────────────────────────────────────────────
     Thomas algorithm for tridiagonal system
       a[i]·x[i-1] + b[i]·x[i] + c[i]·x[i+1] = d[i]
     ───────────────────────────────────────────── */
  function thomasSolve(a, b, c, d) {
    const n = b.length;
    const cp = new Float64Array(n);
    const dp = new Float64Array(n);
    const x  = new Float64Array(n);

    // Forward sweep
    cp[0] = c[0] / b[0];
    dp[0] = d[0] / b[0];
    for (let i = 1; i < n; i++) {
      const m = a[i] / (b[i] - a[i] * cp[i - 1]);
      cp[i] = c[i] / (b[i] - a[i] * cp[i - 1]);
      dp[i] = (d[i] - a[i] * dp[i - 1]) / (b[i] - a[i] * cp[i - 1]);
    }

    // Back-substitution
    x[n - 1] = dp[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      x[i] = dp[i] - cp[i] * x[i + 1];
    }
    return x;
  }

  /* ─────────────────────────────────────────────
     Assemble and solve the FEM system
     Returns { x[], T[], solveTimeMs }
     ───────────────────────────────────────────── */
  function solve(params) {
    const { L, k, q, T0, TL, N } = params;
    const h   = L / N;
    const n   = N + 1;          // total nodes
    const nf  = N - 1;          // free (interior) nodes

    const t0 = performance.now();

    // If there are no interior nodes, just return BCs
    if (nf <= 0) {
      return {
        x: [0, L],
        T: [T0, TL],
        solveTimeMs: performance.now() - t0,
      };
    }

    // Tridiagonal coefficients for interior nodes (indices 1 … N-1)
    const a = new Float64Array(nf);  // sub-diagonal
    const b = new Float64Array(nf);  // main diagonal
    const c = new Float64Array(nf);  // super-diagonal
    const d = new Float64Array(nf);  // RHS

    const ke = k / h;               // element stiffness factor
    const fe = q * h / 2;           // element load factor

    for (let i = 0; i < nf; i++) {
      b[i] = 2 * ke;                // two elements share interior node
      a[i] = -ke;
      c[i] = -ke;
      d[i] = 2 * fe;                // load from two elements
    }

    // Adjust RHS for Dirichlet BCs
    d[0]      += ke * T0;           // left BC
    d[nf - 1] += ke * TL;           // right BC

    // Solve
    const Tinterior = thomasSolve(a, b, c, d);

    // Build full solution vector
    const xArr = new Float64Array(n);
    const TArr = new Float64Array(n);
    xArr[0] = 0;    TArr[0] = T0;
    xArr[N] = L;    TArr[N] = TL;
    for (let i = 1; i < N; i++) {
      xArr[i] = i * h;
      TArr[i] = Tinterior[i - 1];
    }

    const solveTimeMs = performance.now() - t0;
    const fullRes = {
      x: Array.from(xArr),
      T: Array.from(TArr),
      solveTimeMs,
    };
    fullRes.max_midpoint_error = maxMidpointError(fullRes, params);
    return fullRes;
  }

  /* ─────────────────────────────────────────────
     Compute max error at element midpoints
     (FEM linear interpolation vs. exact at midpoint)
     ───────────────────────────────────────────── */
  function maxMidpointError(femResult, params) {
    const { L, k, q, T0, TL } = params;
    const { x: xn, T: Tn } = femResult;
    let maxErr = 0;
    for (let i = 0; i < xn.length - 1; i++) {
      const xMid = (xn[i] + xn[i + 1]) / 2;
      const tFem = (Tn[i] + Tn[i + 1]) / 2;   // linear interp
      const tExact = exactSolution(xMid, L, k, q, T0, TL);
      maxErr = Math.max(maxErr, Math.abs(tFem - tExact));
    }
    return maxErr;
  }

  /* ─────────────────────────────────────────────
     Convergence study — solve for several N values
     Returns [ { N, maxErr, solveTimeMs }, … ]
     ───────────────────────────────────────────── */
  function convergenceStudy(params, Ns = [10, 20, 40, 80]) {
    return Ns.map(N => {
      const p = { ...params, N };
      const res = solve(p);
      const maxErr = maxMidpointError(res, p);
      return { N, maxErr, solveTimeMs: res.solveTimeMs };
    });
  }

  /* ─────────────────────────────────────────────
     Export results to CSV string
     ───────────────────────────────────────────── */
  function toCSV(femResult, params) {
    const { x, T } = femResult;
    const { L, k, q, T0, TL } = params;
    const lines = ["x (m),T_FEM (°C),T_exact (°C),Error (°C)"];
    for (let i = 0; i < x.length; i++) {
      const tEx = exactSolution(x[i], L, k, q, T0, TL);
      const err = Math.abs(T[i] - tEx);
      lines.push(`${x[i].toFixed(6)},${T[i].toFixed(6)},${tEx.toFixed(6)},${err.toExponential(4)}`);
    }
    return lines.join("\n");
  }

  // Public API
  return { solve, exactSolution, exactCurve, maxMidpointError, convergenceStudy, toCSV };
})();

