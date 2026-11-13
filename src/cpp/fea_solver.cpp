#include "fea_solver.hpp"
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cmath>

namespace workbench {

double ThermalRodSolver::exact_temperature(double x, const ThermalRodParams& p) noexcept {
    // T_exact(x) = T0 + (TL - T0)*(x/L) + [q/(2k)]*x*(L - x)
    return p.T0 + (p.TL - p.T0) * (x / p.L) + (p.q / (2.0 * p.k)) * x * (p.L - x);
}

bool ThermalRodSolver::solve_tridiagonal(int n, const double* a, const double* b, const double* c, 
                                        const double* d, double* x) {
    if (n <= 0) return false;
    std::vector<double> cp(n, 0.0);
    std::vector<double> dp(n, 0.0);

    if (std::abs(b[0]) < 1e-15) return false;
    cp[0] = c[0] / b[0];
    dp[0] = d[0] / b[0];

    for (int i = 1; i < n; ++i) {
        double denom = b[i] - a[i] * cp[i - 1];
        if (std::abs(denom) < 1e-15) return false;
        cp[i] = (i < n - 1) ? (c[i] / denom) : 0.0;
        dp[i] = (d[i] - a[i] * dp[i - 1]) / denom;
    }

    x[n - 1] = dp[n - 1];
    for (int i = n - 2; i >= 0; --i) {
        x[i] = dp[i] - cp[i] * x[i + 1];
    }
    return true;
}

ThermalSolveResult ThermalRodSolver::solve(const ThermalRodParams& p, const std::atomic<bool>* cancel_token) {
    auto t_start = std::chrono::high_resolution_clock::now();
    ThermalSolveResult res;

    if (cancel_token && cancel_token->load()) {
        res.success = false;
        res.error_message = "Thermal solve cancelled by user.";
        return res;
    }

    // Parameter validation
    if (p.N < 1) {
        res.success = false;
        res.error_message = "Element count N must be at least 1.";
        return res;
    }
    if (p.L <= 0.0 || p.k <= 0.0 || p.A <= 0.0) {
        res.success = false;
        res.error_message = "Length, conductivity, and cross-sectional area must be strictly positive.";
        return res;
    }

    const int N = p.N;
    const int num_nodes = N + 1;
    const double h = p.L / static_cast<double>(N);

    res.x_coords.resize(num_nodes);
    res.T_fem.resize(num_nodes);
    res.T_exact.resize(num_nodes);

    for (int i = 0; i < num_nodes; ++i) {
        double x = i * h;
        if (i == N) x = p.L; // Guard against numerical roundoff at boundary
        res.x_coords[i] = x;
        res.T_exact[i] = exact_temperature(x, p);
    }

    // Set boundary conditions
    res.T_fem[0] = p.T0;
    res.T_fem[N] = p.TL;

    if (N == 1) {
        // Trivial 1 element case with both ends prescribed
        // Midpoint calculation:
        double x_mid = 0.5 * p.L;
        res.x_midpoints.push_back(x_mid);
        double t_fe_mid = 0.5 * (res.T_fem[0] + res.T_fem[1]);
        double t_ex_mid = exact_temperature(x_mid, p);
        res.T_mid_fem.push_back(t_fe_mid);
        res.T_mid_exact.push_back(t_ex_mid);
        double err = std::abs(t_fe_mid - t_ex_mid);
        res.midpoint_errors.push_back(err);
        res.max_midpoint_error = err;
        res.success = true;
        auto t_end = std::chrono::high_resolution_clock::now();
        res.solve_time_ms = std::chrono::duration<double, std::milli>(t_end - t_start).count();
        return res;
    }

    // Standard FEM Global Assembly via Explicit Element Loop
    // Allocate global system for all nodes 0 to N (size = num_nodes)
    std::vector<double> K_diag(num_nodes, 0.0);
    std::vector<double> K_sub(num_nodes, 0.0);
    std::vector<double> K_sup(num_nodes, 0.0);
    std::vector<double> F_global(num_nodes, 0.0);

    // Loop over each 2-node linear element e in [0, N-1]
    for (int e = 0; e < N; ++e) {
        if (cancel_token && (e % 1024 == 0) && cancel_token->load()) {
            res.success = false;
            res.error_message = "Thermal solve cancelled by user.";
            return res;
        }
        int n1 = e;
        int n2 = e + 1;

        // Local element stiffness matrix K^e (2x2):
        // K^e = (k * A / h) * [  1, -1 ]
        //                     [ -1,  1 ]
        const double ke = (p.k * p.A) / h;
        const double k_elem[2][2] = {
            {  ke, -ke },
            { -ke,  ke }
        };

        // Local element load vector F^e (2x1) for uniform volumetric heat generation q:
        // F^e = (q * A * h / 2) * [ 1 ]
        //                         [ 1 ]
        const double fe = (p.q * p.A * h) / 2.0;
        const double f_elem[2] = { fe, fe };

        // Assemble element stiffness into global tridiagonal entries
        K_diag[n1] += k_elem[0][0];
        K_diag[n2] += k_elem[1][1];
        K_sup[n1]   = k_elem[0][1]; // Coupling from n1 to n2
        K_sub[n2]   = k_elem[1][0]; // Coupling from n2 to n1

        // Assemble element load into global RHS vector
        F_global[n1] += f_elem[0];
        F_global[n2] += f_elem[1];
    }

    // Reduce to interior free degrees of freedom (nodes 1 to N-1)
    const int num_free = N - 1;
    std::vector<double> a(num_free, 0.0); // subdiagonal
    std::vector<double> b(num_free, 0.0); // main diagonal
    std::vector<double> c(num_free, 0.0); // superdiagonal
    std::vector<double> d(num_free, 0.0); // RHS load vector

    for (int i = 0; i < num_free; ++i) {
        int global_node = i + 1;
        b[i] = K_diag[global_node];
        a[i] = K_sub[global_node];
        c[i] = K_sup[global_node];
        d[i] = F_global[global_node];
    }

    // Apply essential Dirichlet boundary conditions at endpoints
    // Node 0: T(0) = T0, transfer coupling -ke * T0 to RHS as +ke * T0
    d[0]            -= K_sub[1] * p.T0;
    // Node N: T(L) = TL, transfer coupling -ke * TL to RHS as +ke * TL
    d[num_free - 1] -= K_sup[N - 1] * p.TL;

    std::vector<double> T_free(num_free, 0.0);
    if (!solve_tridiagonal(num_free, a.data(), b.data(), c.data(), d.data(), T_free.data())) {
        res.success = false;
        res.error_message = "Singular matrix encountered during tridiagonal linear solve.";
        return res;
    }

    for (int i = 0; i < num_free; ++i) {
        res.T_fem[i + 1] = T_free[i];
    }

    // Evaluate finite element linear interpolation at midpoints of each element
    res.x_midpoints.resize(N);
    res.T_mid_fem.resize(N);
    res.T_mid_exact.resize(N);
    res.midpoint_errors.resize(N);
    res.max_midpoint_error = 0.0;

    for (int e = 0; e < N; ++e) {
        double x_mid = (res.x_coords[e] + res.x_coords[e + 1]) * 0.5;
        // FE linear interpolation: T(x_mid) = N1(x_mid)*T_e + N2(x_mid)*T_{e+1} = 0.5*(T_e + T_{e+1})
        double t_fe_mid = 0.5 * (res.T_fem[e] + res.T_fem[e + 1]);
        double t_ex_mid = exact_temperature(x_mid, p);
        double err = std::abs(t_fe_mid - t_ex_mid);

        res.x_midpoints[e] = x_mid;
        res.T_mid_fem[e] = t_fe_mid;
        res.T_mid_exact[e] = t_ex_mid;
        res.midpoint_errors[e] = err;
        if (err > res.max_midpoint_error) {
            res.max_midpoint_error = err;
        }
    }

    res.success = true;
    auto t_end = std::chrono::high_resolution_clock::now();
    res.solve_time_ms = std::chrono::duration<double, std::milli>(t_end - t_start).count();
    return res;
}

std::vector<ConvergenceDataPoint> ThermalRodSolver::run_convergence_study(
    const ThermalRodParams& base_params, 
    const std::vector<int>& mesh_sizes) {
    
    std::vector<ConvergenceDataPoint> study;
    for (int N : mesh_sizes) {
        ThermalRodParams p = base_params;
        p.N = N;
        ThermalSolveResult res = solve(p);
        ConvergenceDataPoint pt;
        pt.N = N;
        pt.h = p.L / static_cast<double>(N);
        pt.max_midpoint_error = res.max_midpoint_error;
        pt.solve_time_ms = res.solve_time_ms;
        // Theoretical midpoint error for uniform 1D linear FE: e = (q * h^2) / (8 * k)
        pt.theoretical_error = (p.q * pt.h * pt.h) / (8.0 * p.k);
        study.push_back(pt);
    }
    return study;
}

std::string ThermalRodSolver::export_csv(const ThermalSolveResult& res, const ThermalRodParams& p) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(8);
    ss << "# Unified Engineering Workbench - 1D Thermal FEA Export\n";
    ss << "# Parameters: L=" << p.L << " m, A=" << p.A << " m2, k=" << p.k 
       << " W/(m*K), q=" << p.q << " W/m3, T0=" << p.T0 << " C, TL=" << p.TL << " C, N=" << p.N << "\n";
    ss << "# Node Results\n";
    ss << "node_index,x_m,T_fem_C,T_exact_C,nodal_error_C\n";
    for (size_t i = 0; i < res.x_coords.size(); ++i) {
        double err = std::abs(res.T_fem[i] - res.T_exact[i]);
        ss << i << "," << res.x_coords[i] << "," << res.T_fem[i] << "," 
           << res.T_exact[i] << "," << err << "\n";
    }
    ss << "\n# Element Midpoint Results (FE Interpolation vs Exact)\n";
    ss << "element_index,x_mid_m,T_mid_fem_C,T_mid_exact_C,midpoint_error_C\n";
    for (size_t e = 0; e < res.x_midpoints.size(); ++e) {
        ss << e << "," << res.x_midpoints[e] << "," << res.T_mid_fem[e] << "," 
           << res.T_mid_exact[e] << "," << res.midpoint_errors[e] << "\n";
    }
    return ss.str();
}

std::string ThermalRodSolver::export_convergence_csv(const std::vector<ConvergenceDataPoint>& study) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(8);
    ss << "N_elements,element_size_h_m,max_midpoint_error_C,theoretical_error_C,solve_time_ms\n";
    for (const auto& pt : study) {
        ss << pt.N << "," << pt.h << "," << pt.max_midpoint_error << "," 
           << pt.theoretical_error << "," << pt.solve_time_ms << "\n";
    }
    return ss.str();
}

} // namespace workbench

