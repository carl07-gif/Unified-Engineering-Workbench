#pragma once

#include <vector>
#include <string>
#include <cmath>

namespace workbench {

struct BackpropWeights {
    double w = 0.5;
    double b = 0.0;
    double v = 1.0;
    double c = 0.0;
};

struct BackpropGradients {
    double dJ_dw = 0.0;
    double dJ_db = 0.0;
    double dJ_dv = 0.0;
    double dJ_dc = 0.0;
};

struct GradientCheckResult {
    std::string param_name;
    double analytical_grad = 0.0;
    double numerical_grad = 0.0;
    double abs_error = 0.0;
    bool passed = false; // error <= 1e-5
};

struct StepRecord {
    int step = 0;
    double loss = 0.0;
    double y_hat = 0.0;
    double w = 0.0;
    double b = 0.0;
    double v = 0.0;
    double c = 0.0;
};

struct BackpropReport {
    BackpropWeights initial_weights;
    double initial_loss = 0.0;
    double initial_y_hat = 0.0;
    BackpropGradients initial_analytical_grads;
    BackpropWeights updated_weights_step1;
    std::vector<GradientCheckResult> gradient_checks;
    bool all_grad_checks_passed = false;
    std::vector<StepRecord> training_history; // 100 steps
};

class BackpropEngine {
public:
    static constexpr double DEFAULT_X = 1.0;
    static constexpr double DEFAULT_Y = 2.0;
    static constexpr double DEFAULT_LR = 0.1;
    static constexpr double EPSILON = 1e-6;

    // Forward pass: returns { z, h, y_hat, loss }
    static double forward(double x, double y, const BackpropWeights& w, 
                          double& out_z, double& out_h, double& out_yhat);

    // Compute exact analytical gradients via manual chain rule
    static BackpropGradients compute_analytical_gradients(double x, double y, const BackpropWeights& w);

    // Central finite difference verification: [J(theta + eps) - J(theta - eps)] / (2*eps)
    static std::vector<GradientCheckResult> verify_gradients_finite_diff(
        double x, double y, const BackpropWeights& w, double eps = EPSILON);

    // Train for N steps and return complete report
    static BackpropReport run_training(int steps = 100, double lr = DEFAULT_LR);

    // JSON export helper
    static std::string to_json(const BackpropReport& report);
};

} // namespace workbench

