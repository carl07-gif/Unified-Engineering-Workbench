#pragma once

#include <vector>
#include <string>
#include <limits>
#include <cmath>

namespace workbench {

struct Vec3 {
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;

    bool is_finite() const noexcept {
        return std::isfinite(x) && std::isfinite(y) && std::isfinite(z);
    }
};

struct STLTriangle {
    Vec3 normal;
    Vec3 v1;
    Vec3 v2;
    Vec3 v3;
};

struct BoundingBox {
    Vec3 min{std::numeric_limits<double>::infinity(), 
             std::numeric_limits<double>::infinity(), 
             std::numeric_limits<double>::infinity()};
    Vec3 max{-std::numeric_limits<double>::infinity(), 
             -std::numeric_limits<double>::infinity(), 
             -std::numeric_limits<double>::infinity()};

    void update(const Vec3& p) noexcept {
        if (p.x < min.x) min.x = p.x;
        if (p.y < min.y) min.y = p.y;
        if (p.z < min.z) min.z = p.z;
        if (p.x > max.x) max.x = p.x;
        if (p.y > max.y) max.y = p.y;
        if (p.z > max.z) max.z = p.z;
    }

    Vec3 center() const noexcept {
        return Vec3{(min.x + max.x) * 0.5, (min.y + max.y) * 0.5, (min.z + max.z) * 0.5};
    }

    Vec3 extents() const noexcept {
        return Vec3{max.x - min.x, max.y - min.y, max.z - min.z};
    }
};

struct STLParseResult {
    bool success = false;
    std::string error_message;
    std::string solid_name;
    std::vector<STLTriangle> triangles;
    BoundingBox bbox;
    size_t triangle_count = 0;
};

struct AnsysNode {
    int node_id = 0;
    double x_m = 0.0;
    double y_m = 0.0;
    double z_m = 0.0;
    double temperature_C = 0.0;

    bool is_valid() const noexcept {
        return node_id >= 0 && std::isfinite(x_m) && std::isfinite(y_m) && 
               std::isfinite(z_m) && std::isfinite(temperature_C);
    }
};

struct AnsysCSVParseResult {
    bool success = false;
    std::string error_message;
    std::vector<AnsysNode> nodes;
    BoundingBox bbox;
    double min_temp_C = std::numeric_limits<double>::infinity();
    double max_temp_C = -std::numeric_limits<double>::infinity();
    double mean_temp_C = 0.0;
    size_t node_count = 0;
};

class CadAnsysParser {
public:
    // Tested practical limits to protect against memory exhaustion:
    static constexpr size_t MAX_STL_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
    static constexpr size_t MAX_CSV_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

    // Parse ASCII STL from file or in-memory string
    static STLParseResult parse_ascii_stl_from_file(const std::string& filepath);
    static STLParseResult parse_ascii_stl_from_string(const std::string& content);

    // Parse ANSYS CSV from file or in-memory string
    static AnsysCSVParseResult parse_ansys_csv_from_file(const std::string& filepath);
    static AnsysCSVParseResult parse_ansys_csv_from_string(const std::string& content);

    // JSON export helper for web transport
    static std::string to_json(const STLParseResult& res);
    static std::string to_json(const AnsysCSVParseResult& res);
};

} // namespace workbench

