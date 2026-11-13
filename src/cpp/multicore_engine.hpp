#pragma once

#include "fea_solver.hpp"
#include <vector>
#include <string>
#include <thread>
#include <mutex>
#include <queue>
#include <condition_variable>
#include <atomic>
#include <functional>

namespace workbench {

struct BatchCase {
    int case_id = 0;
    ThermalRodParams params;
};

struct BatchSolveSummary {
    int case_id = 0;
    double max_midpoint_error = 0.0;
    double peak_temperature_C = 0.0;
    double x_peak_m = 0.0;
};

struct WorkerTimingRun {
    int worker_count = 1;
    std::vector<double> repetition_times_ms; // 5 repetitions
    double median_time_ms = 0.0;
    double speedup = 1.0;                    // T_1 / T_p
    double efficiency = 1.0;                 // (T_1 / T_p) / p
};

struct MulticoreBenchmarkReport {
    std::string cpu_model = "x86_64";
    unsigned int physical_cores = 1;
    unsigned int logical_cores = 1;
    double ram_gb = 0.0;
    std::string ram_detection_method;
    std::string compiler_info;
    std::string optimization_flags;
    int total_cases = 1000;
    int mesh_size_N = 40;
    uint32_t random_seed = 42;
    double warmup_time_ms = 0.0;
    double launch_to_ready_ms = 0.0;
    double max_serial_parallel_diff_C = 0.0;
    bool numerical_agreement_passed = false; // diff <= 1e-8 C
    bool cancelled = false;
    std::vector<WorkerTimingRun> thread_runs;
};

class ThreadPool {
public:
    explicit ThreadPool(size_t threads);
    ~ThreadPool();

    void enqueue(std::function<void()> task);
    void wait_all();

private:
    std::vector<std::thread> workers;
    std::queue<std::function<void()>> tasks;
    std::mutex queue_mutex;
    std::condition_variable cv_task;
    std::condition_variable cv_finished;
    std::atomic<bool> stop{false};
    std::atomic<size_t> active_tasks{0};
};

class MulticoreEngine {
public:
    // Generates a deterministic, reproducible batch of thermal problems
    static std::vector<BatchCase> generate_reproducible_batch(int case_count = 1000, 
                                                              int mesh_size_N = 40, 
                                                              uint32_t seed = 42);

    // Serial execution
    static std::vector<ThermalSolveResult> solve_batch_serial(const std::vector<BatchCase>& cases);

    // Parallel execution with bounded worker pool
    static std::vector<ThermalSolveResult> solve_batch_parallel(const std::vector<BatchCase>& cases, 
                                                                int num_workers);

    // Full benchmark suite executing warmup + 5 reps across 1, 2, 4 threads (supports cancellation & real progress)
    static MulticoreBenchmarkReport run_benchmark(int case_count = 1000, 
                                                  int mesh_size_N = 40, 
                                                  uint32_t seed = 42,
                                                  const std::atomic<bool>* cancel_token = nullptr,
                                                  std::function<void(int)> progress_cb = nullptr,
                                                  bool write_csv = true);

    // JSON export helper
    static std::string to_json(const MulticoreBenchmarkReport& report);
};

} // namespace workbench

