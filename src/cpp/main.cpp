#include "fea_solver.hpp"
#include "cad_ansys_parser.hpp"
#include "multicore_engine.hpp"
#include "embedded_mocks.hpp"
#include "backprop_engine.hpp"

#include <iostream>
#include <fstream>
#include <string>
#include <vector>

void print_banner() {
    std::cout << "========================================================\n";
    std::cout << "       UNIFIED ENGINEERING WORKBENCH - C++17 CORE       \n";
    std::cout << "   PASS Science Works | Common Technical Assignment     \n";
    std::cout << "========================================================\n\n";
}

int main(int argc, char* argv[]) {
    print_banner();

    if (argc < 2) {
        std::cout << "Running complete internal system verification...\n\n";

        // 1. Thermal FEA Test
        std::cout << "--- [Task C: Thermal 1D FEA & Convergence] ---\n";
        workbench::ThermalRodParams tp;
        tp.L = 1.0;
        tp.A = 1e-4;
        tp.k = 10.0;
        tp.q = 10000.0;
        tp.T0 = 100.0;
        tp.TL = 20.0;
        
        auto conv = workbench::ThermalRodSolver::run_convergence_study(tp, {10, 20, 40, 80});
        for (const auto& pt : conv) {
            std::cout << "  N = " << pt.N 
                      << " | Max Midpoint Error: " << pt.max_midpoint_error << " deg C"
                      << " | Theoretical: " << pt.theoretical_error << " deg C"
                      << " | Solve Time: " << pt.solve_time_ms << " ms\n";
        }

        // Export thermal results
        workbench::ThermalSolveResult t_res = workbench::ThermalRodSolver::solve(tp);
        std::ofstream out_csv("results/thermal_fea_N80.csv");
        if (out_csv.is_open()) {
            out_csv << workbench::ThermalRodSolver::export_csv(t_res, tp);
            std::cout << "  -> Exported raw CSV to results/thermal_fea_N80.csv\n\n";
        }

        // 2. Multicore Benchmark
        std::cout << "--- [Task D: Multicore / Multithreaded Execution] ---\n";
        auto bench = workbench::MulticoreEngine::run_benchmark(1000, 40, 42);
        std::cout << "  Logical CPU Cores: " << bench.logical_cores << "\n";
        std::cout << "  Warmup (1000 cases): " << bench.warmup_time_ms << " ms\n";
        for (const auto& r : bench.thread_runs) {
            std::cout << "  Workers: " << r.worker_count 
                      << " | Median Time: " << r.median_time_ms << " ms"
                      << " | Speedup: " << r.speedup << "x"
                      << " | Efficiency: " << (r.efficiency * 100.0) << "%\n";
        }
        std::cout << "  Max Serial-Parallel Diff: " << bench.max_serial_parallel_diff_C << " deg C\n";
        std::cout << "  Numerical Agreement (<= 1e-8 C): " 
                  << (bench.numerical_agreement_passed ? "PASSED" : "FAILED") << "\n\n";

        // 3. Embedded Mock Verification
        std::cout << "--- [Task E: Embedded-System Mock Adapters] ---\n";
        workbench::EmbeddedWorkbenchManager emgr;
        for (auto& dev : emgr.get_all_devices()) {
            auto caps = dev->get_capabilities();
            auto tel = dev->poll_telemetry();
            std::cout << "  Device: " << caps.device_name 
                      << " [" << caps.hardware_id << "] - " 
                      << dev->get_status_message() << "\n";
            std::cout << "    Telemetry: " << tel.core_voltage_V << " V, " 
                      << tel.die_temperature_C << " deg C, " 
                      << tel.current_draw_mA << " mA\n";
        }
        std::cout << "\n";

        // 4. Backpropagation Gradient Check & Training
        std::cout << "--- [Task F: Handwritten Backpropagation & Gradient Check] ---\n";
        auto bp = workbench::BackpropEngine::run_training(100, 0.1);
        std::cout << "  Initial Loss: " << bp.initial_loss << " (y_hat = " << bp.initial_y_hat << ")\n";
        std::cout << "  Gradient checks with epsilon = 1e-6 (threshold <= 1e-5):\n";
        for (const auto& chk : bp.gradient_checks) {
            std::cout << "    dJ/d" << chk.param_name 
                      << " | Analytical: " << chk.analytical_grad 
                      << " | Numerical: " << chk.numerical_grad 
                      << " | Abs Error: " << chk.abs_error 
                      << " [" << (chk.passed ? "PASSED" : "FAILED") << "]\n";
        }
        std::cout << "  All gradient checks passed: " << (bp.all_grad_checks_passed ? "YES" : "NO") << "\n";
        std::cout << "  Updated parameters (step 1):\n";
        std::cout << "    w = " << bp.updated_weights_step1.w 
                  << ", b = " << bp.updated_weights_step1.b 
                  << ", v = " << bp.updated_weights_step1.v 
                  << ", c = " << bp.updated_weights_step1.c << "\n";
        std::cout << "  Final loss after 100 steps: " << bp.training_history.back().loss 
                  << " (y_hat = " << bp.training_history.back().y_hat << ")\n\n";

        std::cout << "All core C++17 modules validated successfully.\n";
        return 0;
    }

    std::string cmd = argv[1];
    if (cmd == "--benchmark") {
        int case_count = 1000;
        int mesh_size = 40;
        if (argc >= 3) {
            try { case_count = std::stoi(argv[2]); } catch (...) {}
        }
        if (argc >= 4) {
            try { mesh_size = std::stoi(argv[3]); } catch (...) {}
        }
        auto report = workbench::MulticoreEngine::run_benchmark(case_count, mesh_size, 42);
        std::cout << workbench::MulticoreEngine::to_json(report) << "\n";
    } else if (cmd == "--backprop") {
        auto report = workbench::BackpropEngine::run_training(100, 0.1);
        std::cout << workbench::BackpropEngine::to_json(report) << "\n";
    } else if (cmd == "--thermal") {
        workbench::ThermalRodParams p;
        auto res = workbench::ThermalRodSolver::solve(p);
        std::cout << workbench::ThermalRodSolver::export_csv(res, p) << "\n";
    } else if (cmd == "--parse-stl" && argc >= 3) {
        auto res = workbench::CadAnsysParser::parse_ascii_stl_from_file(argv[2]);
        std::cout << workbench::CadAnsysParser::to_json(res) << "\n";
    } else if (cmd == "--parse-ansys" && argc >= 3) {
        auto res = workbench::CadAnsysParser::parse_ansys_csv_from_file(argv[2]);
        std::cout << workbench::CadAnsysParser::to_json(res) << "\n";
    } else {
        std::cerr << "Unknown command: " << cmd << "\n";
        return 1;
    }

    return 0;
}

