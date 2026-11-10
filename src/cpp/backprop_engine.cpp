#include "backprop_engine.hpp"
#include <sstream>
#include <iomanip>
#include <cmath>

namespace workbench {

double BackpropEngine::forward(double x, double y, const BackpropWeights& p, 
                               double& out_z, double& out_h, double& out_yhat) {
    out_z = p.w * x + p.b;
    out_h = std::tanh(out_z);
    out_yhat = p.v * out_h + p.c;
    double diff = out_yhat - y;
    return 0.5 * diff * diff;
}

BackpropGradients BackpropEngine::compute_analytical_gradients(double x, double y, const BackpropWeights& p) {
    double z = 0.0, h = 0.0, y_hat = 0.0;
    forward(x, y, p, z, h, y_hat);

    // Chain rule derivation:
    // Loss J = 0.5 * (y_hat - y)^2
    // dJ/dy_hat = y_hat - y
    double dJ_dyhat = y_hat - y;

    // y_hat = v * h + c
    // dJ/dc = dJ/dy_hat * 1
    double dJ_dc = dJ_dyhat;

    // dJ/dv = dJ/dy_hat * h
    double dJ_dv = dJ_dyhat * h;

    // dJ/dh = dJ/dy_hat * v
    double dJ_dh = dJ_dyhat * p.v;

    // h = tanh(z) => dh/dz = 1 - tanh^2(z) = 1 - h^2
    double dh_dz = 1.0 - h * h;

    // dJ/dz = dJ/dh * dh/dz = (y_hat - y) * v * (1 - h^2)
    double dJ_dz = dJ_dh * dh_dz;

    // z = w * x + b
    // dJ/dw = dJ/dz * x
    double dJ_dw = dJ_dz * x;

    // dJ/db = dJ/dz * 1
    double dJ_db = dJ_dz;

    BackpropGradients grads;
    grads.dJ_dw = dJ_dw;
    grads.dJ_db = dJ_db;
    grads.dJ_dv = dJ_dv;
    grads.dJ_dc = dJ_dc;
    return grads;
}

std::vector<GradientCheckResult> BackpropEngine::verify_gradients_finite_diff(
    double x, double y, const BackpropWeights& w, double eps) {
    
    BackpropGradients analytical = compute_analytical_gradients(x, y, w);
    std::vector<GradientCheckResult> results;

    double dummy_z, dummy_h, dummy_yhat;

    auto check_param = [&](const std::string& name, double analytical_val, auto mutate_fn) {
        BackpropWeights w_plus = w;
        BackpropWeights w_minus = w;
        mutate_fn(w_plus, +eps);
        mutate_fn(w_minus, -eps);

        double J_plus = forward(x, y, w_plus, dummy_z, dummy_h, dummy_yhat);
        double J_minus = forward(x, y, w_minus, dummy_z, dummy_h, dummy_yhat);
        double numerical_val = (J_plus - J_minus) / (2.0 * eps);

        GradientCheckResult r;
        r.param_name = name;
        r.analytical_grad = analytical_val;
        r.numerical_grad = numerical_val;
        r.abs_error = std::abs(analytical_val - numerical_val);
        r.passed = (r.abs_error <= 1e-5);
        results.push_back(r);
    };

    check_param("w", analytical.dJ_dw, [](BackpropWeights& p, double d){ p.w += d; });
    check_param("b", analytical.dJ_db, [](BackpropWeights& p, double d){ p.b += d; });
    check_param("v", analytical.dJ_dv, [](BackpropWeights& p, double d){ p.v += d; });
    check_param("c", analytical.dJ_dc, [](BackpropWeights& p, double d){ p.c += d; });

    return results;
}

BackpropReport BackpropEngine::run_training(int steps, double lr) {
    BackpropReport report;
    report.initial_weights = BackpropWeights{0.5, 0.0, 1.0, 0.0};
    
    double z, h;
    report.initial_loss = forward(DEFAULT_X, DEFAULT_Y, report.initial_weights, z, h, report.initial_y_hat);
    report.initial_analytical_grads = compute_analytical_gradients(DEFAULT_X, DEFAULT_Y, report.initial_weights);
    
    // Initial 1-step simultaneous update
    report.updated_weights_step1.w = report.initial_weights.w - lr * report.initial_analytical_grads.dJ_dw;
    report.updated_weights_step1.b = report.initial_weights.b - lr * report.initial_analytical_grads.dJ_db;
    report.updated_weights_step1.v = report.initial_weights.v - lr * report.initial_analytical_grads.dJ_dv;
    report.updated_weights_step1.c = report.initial_weights.c - lr * report.initial_analytical_grads.dJ_dc;

    // Finite difference check
    report.gradient_checks = verify_gradients_finite_diff(DEFAULT_X, DEFAULT_Y, report.initial_weights, EPSILON);
    report.all_grad_checks_passed = true;
    for (const auto& chk : report.gradient_checks) {
        if (!chk.passed) report.all_grad_checks_passed = false;
    }

    // 100-step training loop
    BackpropWeights curr = report.initial_weights;
    report.training_history.reserve(steps + 1);

    for (int step = 0; step <= steps; ++step) {
        double y_hat;
        double loss = forward(DEFAULT_X, DEFAULT_Y, curr, z, h, y_hat);
        
        StepRecord rec;
        rec.step = step;
        rec.loss = loss;
        rec.y_hat = y_hat;
        rec.w = curr.w;
        rec.b = curr.b;
        rec.v = curr.v;
        rec.c = curr.c;
        report.training_history.push_back(rec);

        if (step < steps) {
            BackpropGradients g = compute_analytical_gradients(DEFAULT_X, DEFAULT_Y, curr);
            // Simultaneous gradient descent update
            curr.w -= lr * g.dJ_dw;
            curr.b -= lr * g.dJ_db;
            curr.v -= lr * g.dJ_dv;
            curr.c -= lr * g.dJ_dc;
        }
    }

    return report;
}

std::string BackpropEngine::to_json(const BackpropReport& rep) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(8);
    ss << "{";
    ss << "\"initial_loss\":" << rep.initial_loss << ",";
    ss << "\"initial_y_hat\":" << rep.initial_y_hat << ",";
    ss << "\"initial_weights\":{\"w\":" << rep.initial_weights.w << ",\"b\":" << rep.initial_weights.b 
       << ",\"v\":" << rep.initial_weights.v << ",\"c\":" << rep.initial_weights.c << "},";
    ss << "\"initial_gradients\":{\"dJ_dw\":" << rep.initial_analytical_grads.dJ_dw 
       << ",\"dJ_db\":" << rep.initial_analytical_grads.dJ_db 
       << ",\"dJ_dv\":" << rep.initial_analytical_grads.dJ_dv 
       << ",\"dJ_dc\":" << rep.initial_analytical_grads.dJ_dc << "},";
    ss << "\"updated_step1\":{\"w\":" << rep.updated_weights_step1.w << ",\"b\":" << rep.updated_weights_step1.b 
       << ",\"v\":" << rep.updated_weights_step1.v << ",\"c\":" << rep.updated_weights_step1.c << "},";
    ss << "\"all_grad_checks_passed\":" << (rep.all_grad_checks_passed ? "true" : "false") << ",";
    ss << "\"gradient_checks\":[";
    for (size_t i = 0; i < rep.gradient_checks.size(); ++i) {
        const auto& c = rep.gradient_checks[i];
        ss << "{\"param\":\"" << c.param_name << "\",\"analytical\":" << c.analytical_grad 
           << ",\"numerical\":" << c.numerical_grad << ",\"abs_error\":" << c.abs_error 
           << ",\"passed\":" << (c.passed ? "true" : "false") << "}";
        if (i + 1 < rep.gradient_checks.size()) ss << ",";
    }
    ss << "],\"history\":[";
    for (size_t i = 0; i < rep.training_history.size(); ++i) {
        const auto& h = rep.training_history[i];
        ss << "{\"step\":" << h.step << ",\"loss\":" << h.loss << ",\"y_hat\":" << h.y_hat 
           << ",\"w\":" << h.w << ",\"b\":" << h.b << ",\"v\":" << h.v << ",\"c\":" << h.c << "}";
        if (i + 1 < rep.training_history.size()) ss << ",";
    }
    ss << "]}";
    return ss.str();
}

} // namespace workbench

