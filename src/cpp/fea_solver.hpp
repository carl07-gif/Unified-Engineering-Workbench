#pragma once

#include <vector>
#include <string>
#include <cmath>
#include <chrono>

namespace workbench {

struct ThermalRodParams {
    double L = 1.0;          // Length (m)
    double A = 1e-4;         // Cross-sectional area (m^2)
    double k = 10.0;         // Thermal conductivity (W/(m*K))
    double q = 10000.0;      // Volumetric heat generation (W/m^3)
    double T0 = 100.0;       // Temperature at x = 0 (deg C)
    double TL = 20.0;        // Temperature at x = L (deg C)
    int N = 80;              // Number of uniform linear elements
};

struct ThermalSolveResult {
    std::vector<double> x_coords;          // Node coordinates (m)
    std::vector<double> T_fem;             // Finite element nodal temperatures (deg C)
    std::vector<double> T_exact;           // Exact analytical temperatures at nodes (deg C)
    std::vector<double> x_midpoints;       // Element midpoint coordinates (m)
    std::vector<double> T_mid_fem;         // Interpolated FE temperatures at midpoints (deg C)
    std::vector<double> T_mid_exact;       // Exact temperatures at midpoints (deg C)
    std::vector<double> midpoint_errors;   // Absolute error at each midpoint (|T_fem - T_exact|)
    double max_midpoint_error = 0.0;       // Maximum absolute error at element midpoints
    double solve_time_ms = 0.0;            // Execution time in milliseconds
    bool success = false;
    std::string error_message;
};

struct ConvergenceDataPoint {
    int N = 0;
    double h = 0.0;
    double max_midpoint_error = 0.0;
    double solve_time_ms = 0.0;
    double theoretical_error = 0.0;
};

class ThermalRodSolver {
public:
    static double exact_temperature(double x, const ThermalRodParams& p) noexcept;
    
    // Solves the 1D steady-state heat equation with uniform 2-node linear elements
    static ThermalSolveResult solve(const ThermalRodParams& p);

    // Runs mesh convergence across N in {10, 20, 40, 80}
    static std::vector<ConvergenceDataPoint> run_convergence_study(const ThermalRodParams& base_params, 
                                                                  const std::vector<int>& mesh_sizes = {10, 20, 40, 80});

    // Exports results to CSV formatted string
    static std::string export_csv(const ThermalSolveResult& result, const ThermalRodParams& p);
    
    // Exports convergence study to CSV formatted string
    static std::string export_convergence_csv(const std::vector<ConvergenceDataPoint>& study);

private:
    // Tridiagonal matrix solver (Thomas algorithm) for O(N) linear solve
    static bool solve_tridiagonal(int n, const double* a, const double* b, const double* c, 
                                 const double* d, double* x);
};

} // namespace workbench

