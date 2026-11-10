#include "fea_solver.hpp"
#include "cad_ansys_parser.hpp"
#include "multicore_engine.hpp"
#include "embedded_mocks.hpp"
#include "backprop_engine.hpp"

#include <iostream>
#include <cassert>
#include <cmath>
#include <string>

#define TEST_ASSERT(cond, msg) \
    do { \
        if (!(cond)) { \
            std::cerr << "FAIL: " << msg << " (" << __FILE__ << ":" << __LINE__ << ")\n"; \
            test_failures++; \
        } else { \
            test_successes++; \
        } \
    } while(0)

int test_successes = 0;
int test_failures = 0;

void test_thermal_fea() {
    std::cout << "[TEST] Thermal 1D FEA Solver...\n";

    workbench::ThermalRodParams p;
    p.L = 1.0;
    p.A = 1e-4;
    p.k = 10.0;
    p.q = 10000.0;
    p.T0 = 100.0;
    p.TL = 20.0;
    p.N = 80;

    auto res = workbench::ThermalRodSolver::solve(p);
    TEST_ASSERT(res.success, "Thermal solve should succeed");
    TEST_ASSERT(std::abs(res.T_fem.front() - 100.0) < 1e-12, "T(0) must equal 100 C");
    TEST_ASSERT(std::abs(res.T_fem.back() - 20.0) < 1e-12, "T(L) must equal 20 C");

    // Theoretical maximum midpoint error for N=10: e = q*h^2 / (8*k) = 10000*(0.1^2)/(80) = 1.25 C
    p.N = 10;
    auto res10 = workbench::ThermalRodSolver::solve(p);
    TEST_ASSERT(std::abs(res10.max_midpoint_error - 1.2500) < 1e-4, "Midpoint error for N=10 should be 1.2500 C");

    // N=20: h=0.05 => e = 0.3125 C
    p.N = 20;
    auto res20 = workbench::ThermalRodSolver::solve(p);
    TEST_ASSERT(std::abs(res20.max_midpoint_error - 0.3125) < 1e-4, "Midpoint error for N=20 should be 0.3125 C");

    // N=40: h=0.025 => e = 0.078125 C
    p.N = 40;
    auto res40 = workbench::ThermalRodSolver::solve(p);
    TEST_ASSERT(std::abs(res40.max_midpoint_error - 0.078125) < 1e-4, "Midpoint error for N=40 should be 0.0781 C");

    // N=80: h=0.0125 => e = 0.01953125 C
    p.N = 80;
    auto res80 = workbench::ThermalRodSolver::solve(p);
    TEST_ASSERT(std::abs(res80.max_midpoint_error - 0.01953125) < 1e-4, "Midpoint error for N=80 should be 0.0195 C");

    // Negative validation test
    p.N = 0;
    auto res_bad = workbench::ThermalRodSolver::solve(p);
    TEST_ASSERT(!res_bad.success, "Solve with N=0 must fail validation");
}

void test_cad_ansys_parser() {
    std::cout << "[TEST] CAD / ANSYS Parsers...\n";

    // Valid STL test string
    std::string valid_stl = 
        "solid test_wedge\n"
        "  facet normal 0.0 0.0 1.0\n"
        "    outer loop\n"
        "      vertex 0.0 0.0 0.0\n"
        "      vertex 1.0 0.0 0.0\n"
        "      vertex 0.0 1.0 0.0\n"
        "    endloop\n"
        "  endfacet\n"
        "endsolid test_wedge\n";

    auto stl_res = workbench::CadAnsysParser::parse_ascii_stl_from_string(valid_stl);
    TEST_ASSERT(stl_res.success, "Valid STL must parse successfully");
    TEST_ASSERT(stl_res.triangle_count == 1, "Triangle count must be 1");
    TEST_ASSERT(stl_res.solid_name == "test_wedge", "Solid name must be parsed");

    // Malformed STL (missing endfacet)
    std::string bad_stl = "solid bad\n facet normal 0 0 1\n vertex 0 0 0\n endsolid bad";
    auto bad_stl_res = workbench::CadAnsysParser::parse_ascii_stl_from_string(bad_stl);
    TEST_ASSERT(!bad_stl_res.success, "Malformed STL must be rejected");

    // Valid ANSYS CSV
    std::string valid_csv = 
        "node_id,x_m,y_m,z_m,temperature_C\n"
        "1,0.0,0.0,0.0,100.0\n"
        "2,0.5,0.0,0.0,187.5\n"
        "3,1.0,0.0,0.0,20.0\n";

    auto csv_res = workbench::CadAnsysParser::parse_ansys_csv_from_string(valid_csv);
    TEST_ASSERT(csv_res.success, "Valid ANSYS CSV must parse successfully");
    TEST_ASSERT(csv_res.node_count == 3, "Node count must equal 3");
    TEST_ASSERT(std::abs(csv_res.max_temp_C - 187.5) < 1e-5, "Max temp must be 187.5 C");
    TEST_ASSERT(std::abs(csv_res.min_temp_C - 20.0) < 1e-5, "Min temp must be 20.0 C");

    // Malformed ANSYS CSV (non-finite value)
    std::string nan_csv = 
        "node_id,x_m,y_m,z_m,temperature_C\n"
        "1,0.0,0.0,0.0,NaN\n";
    auto nan_csv_res = workbench::CadAnsysParser::parse_ansys_csv_from_string(nan_csv);
    TEST_ASSERT(!nan_csv_res.success, "Non-finite CSV data must be rejected");
}

void test_multicore_engine() {
    std::cout << "[TEST] Multicore Engine & Numerical Agreement...\n";

    auto cases = workbench::MulticoreEngine::generate_reproducible_batch(200, 20, 12345);
    TEST_ASSERT(cases.size() == 200, "Must generate exactly 200 cases");

    auto serial_res = workbench::MulticoreEngine::solve_batch_serial(cases);
    auto parallel_res = workbench::MulticoreEngine::solve_batch_parallel(cases, 2);

    TEST_ASSERT(serial_res.size() == parallel_res.size(), "Result sizes must match");

    double max_diff = 0.0;
    for (size_t i = 0; i < serial_res.size(); ++i) {
        for (size_t j = 0; j < serial_res[i].T_fem.size(); ++j) {
            double diff = std::abs(serial_res[i].T_fem[j] - parallel_res[i].T_fem[j]);
            if (diff > max_diff) max_diff = diff;
        }
    }

    TEST_ASSERT(max_diff <= 1e-8, "Serial and parallel solutions must match within 1e-8 C");
}

void test_embedded_mocks() {
    std::cout << "[TEST] Embedded Mock Adapters & Recoverable Faults...\n";

    workbench::EmbeddedWorkbenchManager mgr;
    auto devices = mgr.get_all_devices();
    TEST_ASSERT(devices.size() == 3, "Must have MCU, FPGA, and JTAG adapters");

    // Test MCU timeout fault and recovery
    auto mcu = devices[0];
    mcu->trigger_simulated_fault("timeout");
    auto tel = mcu->poll_telemetry();
    TEST_ASSERT(mcu->get_status() == workbench::ConnectionStatus::Degraded_Timeout, "MCU must detect timeout fault");

    mcu->clear_fault();
    tel = mcu->poll_telemetry();
    TEST_ASSERT(mcu->get_status() == workbench::ConnectionStatus::Connected, "MCU must recover after clearing fault");
}

void test_backpropagation() {
    std::cout << "[TEST] Handwritten Backpropagation & Gradient Check...\n";

    auto report = workbench::BackpropEngine::run_training(100, 0.1);
    TEST_ASSERT(std::abs(report.initial_loss - 1.18255) < 0.001, "Initial loss must equal ~1.18255");
    TEST_ASSERT(report.all_grad_checks_passed, "All initial gradient checks (eps=1e-6) must pass with error <= 1e-5");

    // Check monotonic decrease of loss over 100 steps
    double first_loss = report.training_history.front().loss;
    double last_loss = report.training_history.back().loss;
    TEST_ASSERT(last_loss < first_loss, "Training loss must decrease after 100 steps");
    TEST_ASSERT(last_loss < 0.05, "Training loss after 100 steps must be near zero");
}

int main() {
    std::cout << "========================================\n";
    std::cout << "   WORKBENCH UNIT TEST SUITE (C++17)    \n";
    std::cout << "========================================\n\n";

    test_thermal_fea();
    test_cad_ansys_parser();
    test_multicore_engine();
    test_embedded_mocks();
    test_backpropagation();

    std::cout << "\n========================================\n";
    std::cout << "Tests Passed: " << test_successes 
              << " | Tests Failed: " << test_failures << "\n";
    std::cout << "========================================\n";

    return (test_failures == 0) ? 0 : 1;
}

