#include "multicore_engine.hpp"
#include <random>
#include <algorithm>
#include <sstream>
#include <iomanip>
#include <cmath>

namespace workbench {

ThreadPool::ThreadPool(size_t threads) {
    if (threads == 0) threads = 1;
    for (size_t i = 0; i < threads; ++i) {
        workers.emplace_back([this]() {
            while (true) {
                std::function<void()> task;
                {
                    std::unique_lock<std::mutex> lock(this->queue_mutex);
                    this->cv_task.wait(lock, [this]() {
                        return this->stop.load() || !this->tasks.empty();
                    });
                    if (this->stop.load() && this->tasks.empty()) {
                        return;
                    }
                    task = std::move(this->tasks.front());
                    this->tasks.pop();
                }
                task();
                {
                    std::unique_lock<std::mutex> lock(this->queue_mutex);
                    --this->active_tasks;
                    if (this->tasks.empty() && this->active_tasks == 0) {
                        this->cv_finished.notify_all();
                    }
                }
            }
        });
    }
}

ThreadPool::~ThreadPool() {
    stop.store(true);
    cv_task.notify_all();
    for (std::thread& worker : workers) {
        if (worker.joinable()) worker.join();
    }
}

void ThreadPool::enqueue(std::function<void()> task) {
    {
        std::unique_lock<std::mutex> lock(queue_mutex);
        tasks.push(std::move(task));
        ++active_tasks;
    }
    cv_task.notify_one();
}

void ThreadPool::wait_all() {
    std::unique_lock<std::mutex> lock(queue_mutex);
    cv_finished.wait(lock, [this]() {
        return this->tasks.empty() && this->active_tasks == 0;
    });
}

std::vector<BatchCase> MulticoreEngine::generate_reproducible_batch(int case_count, int mesh_size_N, uint32_t seed) {
    std::vector<BatchCase> cases;
    cases.reserve(case_count);

    std::mt19937 rng(seed);
    std::uniform_real_distribution<double> dist_k(2.0, 50.0);       // Conductivity: 2 to 50 W/(m*K)
    std::uniform_real_distribution<double> dist_q(1000.0, 50000.0); // Heat gen: 1 kW/m^3 to 50 kW/m^3
    std::uniform_real_distribution<double> dist_L(0.5, 2.0);        // Length: 0.5 to 2.0 m
    std::uniform_real_distribution<double> dist_T0(50.0, 150.0);    // T(0): 50 to 150 C
    std::uniform_real_distribution<double> dist_TL(10.0, 40.0);     // T(L): 10 to 40 C

    for (int i = 0; i < case_count; ++i) {
        BatchCase bc;
        bc.case_id = i;
        bc.params.L = dist_L(rng);
        bc.params.A = 1e-4;
        bc.params.k = dist_k(rng);
        bc.params.q = dist_q(rng);
        bc.params.T0 = dist_T0(rng);
        bc.params.TL = dist_TL(rng);
        bc.params.N = mesh_size_N;
        cases.push_back(bc);
    }
    return cases;
}

std::vector<ThermalSolveResult> MulticoreEngine::solve_batch_serial(const std::vector<BatchCase>& cases) {
    std::vector<ThermalSolveResult> results;
    results.reserve(cases.size());
    for (const auto& bc : cases) {
        results.push_back(ThermalRodSolver::solve(bc.params));
    }
    return results;
}

std::vector<ThermalSolveResult> MulticoreEngine::solve_batch_parallel(const std::vector<BatchCase>& cases, int num_workers) {
    if (num_workers <= 1) {
        return solve_batch_serial(cases);
    }

    const size_t total = cases.size();
    std::vector<ThermalSolveResult> results(total);
    ThreadPool pool(num_workers);

    // Chunk size heuristic to minimize task queue overhead
    const size_t chunk_size = std::max<size_t>(16, total / (num_workers * 8));

    for (size_t start = 0; start < total; start += chunk_size) {
        size_t end = std::min(start + chunk_size, total);
        pool.enqueue([&cases, &results, start, end]() {
            for (size_t i = start; i < end; ++i) {
                results[i] = ThermalRodSolver::solve(cases[i].params);
            }
        });
    }

    pool.wait_all();
    return results;
}

MulticoreBenchmarkReport MulticoreEngine::run_benchmark(int case_count, int mesh_size_N, uint32_t seed) {
    auto t_launch_start = std::chrono::high_resolution_clock::now();
    MulticoreBenchmarkReport report;
    report.total_cases = case_count;
    report.mesh_size_N = mesh_size_N;
    report.random_seed = seed;
    report.logical_cores = std::thread::hardware_concurrency();

#if defined(_MSC_VER)
    report.compiler_info = "MSVC " + std::to_string(_MSC_VER);
    report.optimization_flags = "/O2 /W4 /EHsc";
#elif defined(__clang__)
    report.compiler_info = "Clang " + std::string(__clang_version__);
    report.optimization_flags = "-O3 -Wall -pthread";
#elif defined(__GNUC__)
    report.compiler_info = "GCC " + std::to_string(__GNUC__) + "." + std::to_string(__GNUC_MINOR__);
    report.optimization_flags = "-O3 -Wall -pthread";
#else
    report.compiler_info = "Standard C++17 Compiler";
    report.optimization_flags = "-O2";
#endif

    // Generate cases
    auto cases = generate_reproducible_batch(case_count, mesh_size_N, seed);

    auto t_launch_end = std::chrono::high_resolution_clock::now();
    report.launch_to_ready_ms = std::chrono::duration<double, std::milli>(t_launch_end - t_launch_start).count();

    // 1. Warmup run (serial)
    auto t_w0 = std::chrono::high_resolution_clock::now();
    auto warmup_results = solve_batch_serial(cases);
    auto t_w1 = std::chrono::high_resolution_clock::now();
    report.warmup_time_ms = std::chrono::duration<double, std::milli>(t_w1 - t_w0).count();

    // Thread worker counts to test: 1, 2, and up to 4 (capped at available logical CPUs)
    std::vector<int> workers_to_test = {1};
    if (report.logical_cores >= 2) workers_to_test.push_back(2);
    if (report.logical_cores >= 4) workers_to_test.push_back(4);
    else if (report.logical_cores > 2 && report.logical_cores < 4) workers_to_test.push_back(report.logical_cores);

    double t1_median = 0.0;
    std::vector<ThermalSolveResult> baseline_serial_results;

    for (int p : workers_to_test) {
        WorkerTimingRun run;
        run.worker_count = p;
        run.repetition_times_ms.reserve(5);

        for (int rep = 0; rep < 5; ++rep) {
            auto t0 = std::chrono::high_resolution_clock::now();
            std::vector<ThermalSolveResult> current_results;
            if (p == 1) {
                current_results = solve_batch_serial(cases);
                if (rep == 0) baseline_serial_results = current_results;
            } else {
                current_results = solve_batch_parallel(cases, p);
                // Verify numerical agreement against serial baseline on first repetition
                if (rep == 0 && !baseline_serial_results.empty()) {
                    for (size_t c = 0; c < cases.size(); ++c) {
                        for (size_t n = 0; n < baseline_serial_results[c].T_fem.size(); ++n) {
                            double diff = std::abs(baseline_serial_results[c].T_fem[n] - current_results[c].T_fem[n]);
                            if (diff > report.max_serial_parallel_diff_C) {
                                report.max_serial_parallel_diff_C = diff;
                            }
                        }
                    }
                }
            }
            auto t1 = std::chrono::high_resolution_clock::now();
            double dur = std::chrono::duration<double, std::milli>(t1 - t0).count();
            run.repetition_times_ms.push_back(dur);
        }

        // Calculate median of 5 repetitions
        std::vector<double> sorted_times = run.repetition_times_ms;
        std::sort(sorted_times.begin(), sorted_times.end());
        run.median_time_ms = sorted_times[2]; // Index 2 is the median of 5 items

        if (p == 1) {
            t1_median = run.median_time_ms;
            run.speedup = 1.0;
            run.efficiency = 1.0;
        } else {
            run.speedup = (run.median_time_ms > 0.0) ? (t1_median / run.median_time_ms) : 1.0;
            run.efficiency = run.speedup / static_cast<double>(p);
        }

        report.thread_runs.push_back(run);
    }

    report.numerical_agreement_passed = (report.max_serial_parallel_diff_C <= 1e-8);
    return report;
}

std::string MulticoreEngine::to_json(const MulticoreBenchmarkReport& report) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(4);
    ss << "{";
    ss << "\"cpu_model\":\"" << report.cpu_model << "\",";
    ss << "\"logical_cores\":" << report.logical_cores << ",";
    ss << "\"compiler_info\":\"" << report.compiler_info << "\",";
    ss << "\"optimization_flags\":\"" << report.optimization_flags << "\",";
    ss << "\"total_cases\":" << report.total_cases << ",";
    ss << "\"mesh_size_N\":" << report.mesh_size_N << ",";
    ss << "\"random_seed\":" << report.random_seed << ",";
    ss << "\"warmup_time_ms\":" << report.warmup_time_ms << ",";
    ss << "\"launch_to_ready_ms\":" << report.launch_to_ready_ms << ",";
    ss << "\"max_serial_parallel_diff_C\":" << std::scientific << std::setprecision(2) 
       << report.max_serial_parallel_diff_C << std::fixed << std::setprecision(4) << ",";
    ss << "\"numerical_agreement_passed\":" << (report.numerical_agreement_passed ? "true" : "false") << ",";
    ss << "\"runs\":[";
    for (size_t i = 0; i < report.thread_runs.size(); ++i) {
        const auto& r = report.thread_runs[i];
        ss << "{\"workers\":" << r.worker_count << ",";
        ss << "\"median_ms\":" << r.median_time_ms << ",";
        ss << "\"speedup\":" << r.speedup << ",";
        ss << "\"efficiency\":" << r.efficiency << ",";
        ss << "\"repetitions\":[";
        for (size_t j = 0; j < r.repetition_times_ms.size(); ++j) {
            ss << r.repetition_times_ms[j];
            if (j + 1 < r.repetition_times_ms.size()) ss << ",";
        }
        ss << "]}";
        if (i + 1 < report.thread_runs.size()) ss << ",";
    }
    ss << "]}";
    return ss.str();
}

} // namespace workbench

