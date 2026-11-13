#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#endif

#include "httplib.h"
#include "../cpp/fea_solver.hpp"
#include "../cpp/cad_ansys_parser.hpp"
#include "../cpp/multicore_engine.hpp"
#include "../cpp/embedded_mocks.hpp"
#include "../cpp/backprop_engine.hpp"

#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <atomic>
#include <thread>
#include <chrono>
#include <mutex>
#include <iomanip>
#include <algorithm>

namespace {

// Helper: extract simple numeric or string value from JSON string
double get_json_double(const std::string& json, const std::string& key, double def_val) {
    size_t pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return def_val;
    pos = json.find(':', pos);
    if (pos == std::string::npos) return def_val;
    size_t start = pos + 1;
    while (start < json.size() && (json[start] == ' ' || json[start] == '\t')) ++start;
    size_t end = start;
    while (end < json.size() && (std::isdigit(json[end]) || json[end] == '.' || json[end] == '-' || json[end] == '+' || json[end] == 'e' || json[end] == 'E')) ++end;
    if (end > start) {
        try { return std::stod(json.substr(start, end - start)); } catch (...) {}
    }
    return def_val;
}

int get_json_int(const std::string& json, const std::string& key, int def_val) {
    return static_cast<int>(get_json_double(json, key, static_cast<double>(def_val)));
}

std::string get_json_string(const std::string& json, const std::string& key, const std::string& def_val) {
    size_t pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return def_val;
    pos = json.find(':', pos);
    if (pos == std::string::npos) return def_val;
    size_t q1 = json.find('"', pos);
    if (q1 == std::string::npos) return def_val;
    size_t q2 = json.find('"', q1 + 1);
    if (q2 == std::string::npos) return def_val;
    return json.substr(q1 + 1, q2 - q1 - 1);
}

// Background benchmark state machine
std::mutex g_bench_mutex;
std::atomic<bool> g_bench_running{false};
std::atomic<bool> g_bench_cancelled{false};
std::atomic<int> g_bench_progress{0};
std::string g_bench_job_id = "";
std::string g_bench_result_json = "{}";

// Heartbeat tracking for safe process termination
std::atomic<bool> g_heartbeat_initialized{false};
std::atomic<int64_t> g_last_heartbeat_ms{0};

int64_t current_time_ms() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
}

void set_cors_headers(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Accept");
}

} // anonymous namespace

int main(int argc, char* argv[]) {
    int port = 7474;
    std::string root_dir = ".";

    if (argc > 1) {
        try { port = std::stoi(argv[1]); } catch (...) {}
    }
    if (argc > 2) {
        root_dir = argv[2];
    }

    std::cout << "========================================================\n";
    std::cout << "       UNIFIED ENGINEERING WORKBENCH - C++17 HTTP SERVER\n";
    std::cout << "   Transport Layer: cpp-httplib v0.66.0 (MIT License)   \n";
    std::cout << "   Listening on: http://127.0.0.1:" << port << "\n";
    std::cout << "   Serving root: " << root_dir << "\n";
    std::cout << "========================================================\n";

    httplib::Server svr;

    // Handle Pre-flight CORS OPTIONS
    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);
        res.status = 204;
    });

    // 1. Health & Ping
    svr.Get("/api/ping", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);
        std::ostringstream ss;
        ss << R"({"status":"ok","backend":"cpp17","version":"1.0.0","server":"cpp-httplib/0.66.0"})";
        res.set_content(ss.str(), "application/json");
    });

    // 2. Client Heartbeat (Auto-exit if browser closed for > 12s)
    svr.Post("/api/heartbeat", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);
        g_heartbeat_initialized = true;
        g_last_heartbeat_ms = current_time_ms();
        res.set_content(R"({"status":"alive","timestamp":)" + std::to_string(g_last_heartbeat_ms.load()) + "}", "application/json");
    });

    // 3. Thermal FEA Endpoint (POST /api/thermal)
    svr.Post("/api/thermal", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);

        workbench::ThermalRodParams p;
        p.L  = get_json_double(req.body, "L", 1.0);
        p.A  = get_json_double(req.body, "A", 1e-4);
        p.k  = get_json_double(req.body, "k", 10.0);
        p.q  = get_json_double(req.body, "q", 10000.0);
        p.T0 = get_json_double(req.body, "T0", 100.0);
        p.TL = get_json_double(req.body, "TL", 20.0);
        p.N  = get_json_int(req.body, "N", 80);

        if (p.L <= 0.0 || p.k <= 0.0 || p.A <= 0.0 || p.N < 2) {
            res.status = 400;
            res.set_content(R"({"success":false,"error":"Invalid physical parameters: L, A, k must be > 0 and N >= 2."})", "application/json");
            return;
        }

        auto start = std::chrono::steady_clock::now();
        workbench::ThermalSolveResult sol = workbench::ThermalRodSolver::solve(p);
        auto conv = workbench::ThermalRodSolver::run_convergence_study(p, {10, 20, 40, 80});
        auto elapsed_ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();

        std::ostringstream ss;
        ss << std::fixed << std::setprecision(6);
        ss << "{\n";
        ss << R"(  "success": true,)" << "\n";
        ss << R"(  "backend": "C++17 Thomas O(N) Solver",)" << "\n";
        ss << R"(  "solve_time_ms": )" << elapsed_ms << ",\n";
        ss << R"(  "N": )" << p.N << ",\n";
        ss << R"(  "max_midpoint_error": )" << sol.max_midpoint_error << ",\n";
        
        // Nodes array
        ss << R"(  "nodes": [)";
        for (size_t i = 0; i < sol.x_coords.size(); ++i) {
            double err = std::abs(sol.T_fem[i] - sol.T_exact[i]);
            if (i > 0) ss << ",";
            ss << "{\"id\":" << i << ",\"x\":" << sol.x_coords[i] 
               << ",\"T\":" << sol.T_fem[i] << ",\"exact\":" << sol.T_exact[i] 
               << ",\"err\":" << err << "}";
        }
        ss << "],\n";

        // Convergence array
        ss << R"(  "convergence": [)";
        for (size_t i = 0; i < conv.size(); ++i) {
            if (i > 0) ss << ",";
            ss << "{\"N\":" << conv[i].N << ",\"h\":" << conv[i].h 
               << ",\"max_err\":" << conv[i].max_midpoint_error 
               << ",\"theoretical\":" << conv[i].theoretical_error 
               << ",\"time_ms\":" << conv[i].solve_time_ms << "}";
        }
        ss << "]\n";
        ss << "}\n";

        res.set_content(ss.str(), "application/json");
    });

    // 4. ASCII STL Parser Endpoint (POST /api/parse/stl)
    svr.Post("/api/parse/stl", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);
        std::string content = req.body;
        // Check if wrapped in JSON { "content": "..." }
        if (content.size() > 10 && content.front() == '{' && content.find("\"content\"") != std::string::npos) {
            content = get_json_string(content, "content", content);
        }

        auto result = workbench::CadAnsysParser::parse_ascii_stl_from_string(content);
        if (!result.success) {
            res.status = 400;
        }
        res.set_content(workbench::CadAnsysParser::to_json(result), "application/json");
    });

    // 5. ANSYS CSV Parser Endpoint (POST /api/parse/ansys)
    svr.Post("/api/parse/ansys", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);
        std::string content = req.body;
        if (content.size() > 10 && content.front() == '{' && content.find("\"content\"") != std::string::npos) {
            content = get_json_string(content, "content", content);
        }

        auto result = workbench::CadAnsysParser::parse_ansys_csv_from_string(content);
        if (!result.success) {
            res.status = 400;
        }
        res.set_content(workbench::CadAnsysParser::to_json(result), "application/json");
    });

    // 6. Multicore Benchmark Endpoints
    svr.Post("/api/benchmark/start", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);

        std::lock_guard<std::mutex> lock(g_bench_mutex);
        if (g_bench_running) {
            res.status = 409;
            res.set_content(R"({"status":"already_running","job_id":")" + g_bench_job_id + R"("})", "application/json");
            return;
        }

        int cases = get_json_int(req.body, "cases", 1000);
        int segments = get_json_int(req.body, "segments", 40);
        int seed = get_json_int(req.body, "seed", 42);

        g_bench_running = true;
        g_bench_cancelled = false;
        g_bench_progress = 0;
        g_bench_job_id = "bench_" + std::to_string(current_time_ms());

        // Launch in background thread
        std::thread([cases, segments, seed]() {
            for (int p = 5; p <= 90; p += 15) {
                if (g_bench_cancelled) break;
                g_bench_progress = p;
                std::this_thread::sleep_for(std::chrono::milliseconds(40));
            }

            if (!g_bench_cancelled) {
                auto rep = workbench::MulticoreEngine::run_benchmark(cases, segments, seed);
                std::lock_guard<std::mutex> lk(g_bench_mutex);
                g_bench_result_json = workbench::MulticoreEngine::to_json(rep);
                g_bench_progress = 100;
            }

            g_bench_running = false;
        }).detach();

        res.set_content(R"({"status":"started","job_id":")" + g_bench_job_id + R"("})", "application/json");
    });

    svr.Get("/api/benchmark/status", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);
        std::lock_guard<std::mutex> lock(g_bench_mutex);

        std::ostringstream ss;
        ss << "{\n";
        ss << R"(  "job_id": ")" << g_bench_job_id << "\",\n";
        ss << R"(  "running": )" << (g_bench_running ? "true" : "false") << ",\n";
        ss << R"(  "cancelled": )" << (g_bench_cancelled ? "true" : "false") << ",\n";
        ss << R"(  "progress": )" << g_bench_progress.load() << ",\n";
        ss << R"(  "result": )" << g_bench_result_json << "\n";
        ss << "}\n";

        res.set_content(ss.str(), "application/json");
    });

    svr.Post("/api/benchmark/cancel", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);
        g_bench_cancelled = true;
        g_bench_running = false;
        res.set_content(R"({"status":"cancelled"})", "application/json");
    });

    // 7. Backpropagation Endpoint (GET /api/backprop)
    svr.Get("/api/backprop", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);
        int steps = 100;
        double lr = 0.1;
        if (req.has_param("steps")) {
            try { steps = std::stoi(req.get_param_value("steps")); } catch (...) {}
        }
        if (req.has_param("lr")) {
            try { lr = std::stod(req.get_param_value("lr")); } catch (...) {}
        }

        auto bp = workbench::BackpropEngine::run_training(steps, lr);
        res.set_content(workbench::BackpropEngine::to_json(bp), "application/json");
    });

    // 8. Embedded Hardware Endpoints
    static workbench::EmbeddedWorkbenchManager g_embedded_mgr;

    svr.Get("/api/embedded/devices", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);
        auto devs = g_embedded_mgr.get_all_devices();

        std::ostringstream ss;
        ss << "[\n";
        for (size_t i = 0; i < devs.size(); ++i) {
            auto caps = devs[i]->get_capabilities();
            if (i > 0) ss << ",\n";
            ss << "  {\n";
            ss << R"(    "name": ")" << caps.device_name << "\",\n";
            ss << R"(    "hardware_id": ")" << caps.hardware_id << "\",\n";
            ss << R"(    "serial": ")" << caps.serial_number << "\",\n";
            ss << R"(    "voltage_V": )" << caps.io_voltage_V << ",\n";
            ss << R"(    "role": ")" << caps.role_description << "\",\n";
            ss << R"(    "status": ")" << devs[i]->get_status_message() << "\",\n";
            ss << R"(    "is_simulated": true)" << "\n";
            ss << "  }";
        }
        ss << "\n]\n";
        res.set_content(ss.str(), "application/json");
    });

    svr.Get("/api/embedded/telemetry", [](const httplib::Request&, httplib::Response& res) {
        set_cors_headers(res);
        auto devs = g_embedded_mgr.get_all_devices();

        std::ostringstream ss;
        ss << "[\n";
        for (size_t i = 0; i < devs.size(); ++i) {
            auto tel = devs[i]->poll_telemetry();
            auto caps = devs[i]->get_capabilities();
            if (i > 0) ss << ",\n";
            ss << "  {\n";
            ss << R"(    "hardware_id": ")" << caps.hardware_id << "\",\n";
            ss << R"(    "seq": )" << tel.packet_sequence << ",\n";
            ss << R"(    "time_s": )" << tel.timestamp_sec << ",\n";
            ss << R"(    "voltage_V": )" << tel.core_voltage_V << ",\n";
            ss << R"(    "temp_C": )" << tel.die_temperature_C << ",\n";
            ss << R"(    "current_mA": )" << tel.current_draw_mA << ",\n";
            ss << R"(    "status": ")" << devs[i]->get_status_message() << "\",\n";
            ss << R"(    "flags": ")" << tel.status_flags << "\",\n";
            ss << R"(    "is_simulated": true)" << "\n";
            ss << "  }";
        }
        ss << "\n]\n";
        res.set_content(ss.str(), "application/json");
    });

    svr.Post("/api/embedded/fault", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);
        std::string dev_id = get_json_string(req.body, "device_id", "FTDI_FT2232H");
        std::string fault = get_json_string(req.body, "fault", "USB_BUS_POWER_SAG");

        auto dev = g_embedded_mgr.get_device_by_id(dev_id);
        if (dev) {
            dev->trigger_simulated_fault(fault);
            res.set_content(R"({"success":true,"status":")" + dev->get_status_message() + R"("})", "application/json");
        } else {
            res.status = 404;
            res.set_content(R"({"success":false,"error":"Device not found"})", "application/json");
        }
    });

    svr.Post("/api/embedded/recover", [](const httplib::Request& req, httplib::Response& res) {
        set_cors_headers(res);
        std::string dev_id = get_json_string(req.body, "device_id", "FTDI_FT2232H");

        auto dev = g_embedded_mgr.get_device_by_id(dev_id);
        if (dev) {
            dev->clear_fault();
            res.set_content(R"({"success":true,"status":")" + dev->get_status_message() + R"("})", "application/json");
        } else {
            res.status = 404;
            res.set_content(R"({"success":false,"error":"Device not found"})", "application/json");
        }
    });

    // 9. Static Files Mount (relative to root_dir)
    svr.set_mount_point("/", root_dir.c_str());

    // 10. Watchdog thread for client heartbeat auto-exit
    std::thread watchdog([&svr]() {
        // Wait 15 seconds after start before enforcing heartbeat
        std::this_thread::sleep_for(std::chrono::seconds(15));
        while (true) {
            std::this_thread::sleep_for(std::chrono::seconds(2));
            if (g_heartbeat_initialized) {
                int64_t diff = current_time_ms() - g_last_heartbeat_ms.load();
                if (diff > 12000) { // 12 seconds with no heartbeat
                    std::cout << "[Watchdog] Client disconnected (no heartbeat for " << diff / 1000 
                              << "s). Terminating C++ server cleanly to prevent orphan processes.\n";
                    svr.stop();
                    break;
                }
            }
        }
    });
    watchdog.detach();

    std::cout << "Backend server ready. Press Ctrl+C to stop.\n";
    svr.listen("127.0.0.1", port);

    std::cout << "Server stopped.\n";
    return 0;
}
