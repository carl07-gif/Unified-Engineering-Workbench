#include "cad_ansys_parser.hpp"
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <iomanip>
#include <unordered_set>

namespace workbench {

static inline std::string trim(const std::string& str) {
    size_t first = str.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    size_t last = str.find_last_not_of(" \t\r\n");
    return str.substr(first, (last - first + 1));
}

static inline std::string to_lower(std::string str) {
    std::transform(str.begin(), str.end(), str.begin(), [](unsigned char c){ return std::tolower(c); });
    return str;
}

STLParseResult CadAnsysParser::parse_ascii_stl_from_file(const std::string& filepath) {
    STLParseResult res;
    std::ifstream file(filepath, std::ios::binary);
    if (!file.is_open()) {
        res.success = false;
        res.error_message = "Cannot open STL file: " + filepath;
        return res;
    }
    file.seekg(0, std::ios::end);
    size_t size = file.tellg();
    if (size == 0) {
        res.success = false;
        res.error_message = "File is empty (0 bytes). Valid ASCII STL expected.";
        return res;
    }
    if (size > MAX_STL_FILE_SIZE_BYTES) {
        res.success = false;
        res.error_message = "STL file exceeds tested limit of 50 MB (size: " + std::to_string(size) + " bytes).";
        return res;
    }
    file.seekg(0, std::ios::beg);
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    return parse_ascii_stl_from_string(content);
}

STLParseResult CadAnsysParser::parse_ascii_stl_from_string(const std::string& content) {
    STLParseResult res;
    if (content.empty()) {
        res.success = false;
        res.error_message = "STL content is empty (0 bytes).";
        return res;
    }
    if (content.size() > MAX_STL_FILE_SIZE_BYTES) {
        res.success = false;
        res.error_message = "STL content exceeds maximum supported buffer size of 50 MB.";
        return res;
    }

    std::istringstream stream(content);
    std::string line;
    bool in_solid = false;
    bool in_facet = false;
    bool in_loop = false;
    STLTriangle current_tri;
    int vertex_count = 0;

    size_t line_num = 0;
    while (std::getline(stream, line)) {
        line_num++;
        std::string trimmed = trim(line);
        if (trimmed.empty()) continue;

        std::string lower = to_lower(trimmed);

        if (!in_solid) {
            if (lower.rfind("solid", 0) == 0) {
                in_solid = true;
                if (trimmed.length() > 5) {
                    res.solid_name = trim(trimmed.substr(5));
                } else {
                    res.solid_name = "unnamed_solid";
                }
                continue;
            } else {
                res.success = false;
                res.error_message = "Malformed ASCII STL: file must start with 'solid <name>' keyword (line " + std::to_string(line_num) + ").";
                return res;
            }
        }

        if (lower.rfind("endsolid", 0) == 0) {
            in_solid = false;
            break;
        }

        if (!in_facet && lower.rfind("facet normal", 0) == 0) {
            in_facet = true;
            std::istringstream iss(trimmed.substr(12));
            if (!(iss >> current_tri.normal.x >> current_tri.normal.y >> current_tri.normal.z)) {
                res.success = false;
                res.error_message = "Malformed facet normal at line " + std::to_string(line_num);
                return res;
            }
            if (!current_tri.normal.is_finite()) {
                res.success = false;
                res.error_message = "Non-finite normal vector at line " + std::to_string(line_num);
                return res;
            }
            vertex_count = 0;
            continue;
        }

        if (in_facet && !in_loop && lower.rfind("outer loop", 0) == 0) {
            in_loop = true;
            continue;
        }

        if (in_loop && lower.rfind("vertex", 0) == 0) {
            std::istringstream iss(trimmed.substr(6));
            Vec3 v;
            if (!(iss >> v.x >> v.y >> v.z)) {
                res.success = false;
                res.error_message = "Malformed vertex coordinate at line " + std::to_string(line_num);
                return res;
            }
            if (!v.is_finite()) {
                res.success = false;
                res.error_message = "Non-finite vertex coordinates (NaN or Inf) detected at line " + std::to_string(line_num);
                return res;
            }
            if (vertex_count == 0) current_tri.v1 = v;
            else if (vertex_count == 1) current_tri.v2 = v;
            else if (vertex_count == 2) current_tri.v3 = v;
            vertex_count++;
            continue;
        }

        if (in_loop && lower.rfind("endloop", 0) == 0) {
            in_loop = false;
            if (vertex_count != 3) {
                res.success = false;
                res.error_message = "Facet must have exactly 3 vertices, found " + std::to_string(vertex_count) + " (line " + std::to_string(line_num) + ")";
                return res;
            }
            continue;
        }

        if (in_facet && lower.rfind("endfacet", 0) == 0) {
            if (in_loop) {
                res.success = false;
                res.error_message = "Missing 'endloop' before 'endfacet' at line " + std::to_string(line_num);
                return res;
            }
            in_facet = false;
            res.bbox.update(current_tri.v1);
            res.bbox.update(current_tri.v2);
            res.bbox.update(current_tri.v3);
            res.triangles.push_back(current_tri);
            continue;
        }
    }

    if (res.triangles.empty()) {
        res.success = false;
        res.error_message = "STL file contained 0 valid facets.";
        return res;
    }

    res.triangle_count = res.triangles.size();
    res.success = true;
    return res;
}

AnsysCSVParseResult CadAnsysParser::parse_ansys_csv_from_file(const std::string& filepath) {
    AnsysCSVParseResult res;
    std::ifstream file(filepath, std::ios::binary);
    if (!file.is_open()) {
        res.success = false;
        res.error_message = "Cannot open ANSYS CSV file: " + filepath;
        return res;
    }
    file.seekg(0, std::ios::end);
    size_t size = file.tellg();
    if (size == 0) {
        res.success = false;
        res.error_message = "File is empty (0 bytes). Expected ANSYS nodal temperature CSV.";
        return res;
    }
    if (size > MAX_CSV_FILE_SIZE_BYTES) {
        res.success = false;
        res.error_message = "CSV file exceeds tested limit of 50 MB (size: " + std::to_string(size) + " bytes).";
        return res;
    }
    file.seekg(0, std::ios::beg);
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    return parse_ansys_csv_from_string(content);
}

AnsysCSVParseResult CadAnsysParser::parse_ansys_csv_from_string(const std::string& content) {
    AnsysCSVParseResult res;
    if (content.empty()) {
        res.success = false;
        res.error_message = "CSV content is empty (0 bytes).";
        return res;
    }
    if (content.size() > MAX_CSV_FILE_SIZE_BYTES) {
        res.success = false;
        res.error_message = "CSV content exceeds maximum supported buffer size of 50 MB.";
        return res;
    }

    std::istringstream stream(content);
    std::string line;
    size_t line_num = 0;
    bool header_found = false;
    double sum_temp = 0.0;
    std::unordered_set<int> seen_ids;

    while (std::getline(stream, line)) {
        line_num++;
        std::string trimmed = trim(line);
        if (trimmed.empty() || trimmed[0] == '#') continue;

        if (!header_found) {
            // Verify expected header columns: node_id,x_m,y_m,z_m,temperature_C
            std::string lower = to_lower(trimmed);
            if (lower.find("node_id") == std::string::npos || lower.find("temperature") == std::string::npos) {
                res.success = false;
                res.error_message = "Invalid header: CSV must contain 'node_id,x_m,y_m,z_m,temperature_C' (line " + std::to_string(line_num) + ").";
                return res;
            }
            header_found = true;
            continue;
        }

        std::istringstream liness(trimmed);
        std::string token;
        std::vector<std::string> parts;
        while (std::getline(liness, token, ',')) {
            parts.push_back(trim(token));
        }

        if (parts.size() < 5) {
            res.success = false;
            res.error_message = "Malformed row at line " + std::to_string(line_num) + ": expected 5 comma-separated values.";
            return res;
        }

        try {
            AnsysNode node;
            node.node_id = std::stoi(parts[0]);
            node.x_m = std::stod(parts[1]);
            node.y_m = std::stod(parts[2]);
            node.z_m = std::stod(parts[3]);
            node.temperature_C = std::stod(parts[4]);

            if (!node.is_valid()) {
                res.success = false;
                res.error_message = "Non-finite or invalid number at line " + std::to_string(line_num);
                return res;
            }

            if (!seen_ids.insert(node.node_id).second) {
                res.success = false;
                res.error_message = "Duplicate node_id " + std::to_string(node.node_id) + " detected at line " + std::to_string(line_num);
                return res;
            }

            res.bbox.update(Vec3{node.x_m, node.y_m, node.z_m});
            if (node.temperature_C < res.min_temp_C) res.min_temp_C = node.temperature_C;
            if (node.temperature_C > res.max_temp_C) res.max_temp_C = node.temperature_C;
            sum_temp += node.temperature_C;

            res.nodes.push_back(node);
        } catch (const std::exception& e) {
            res.success = false;
            res.error_message = "Numeric parsing error at line " + std::to_string(line_num) + ": " + e.what();
            return res;
        }
    }

    if (!header_found) {
        res.success = false;
        res.error_message = "Missing header row with columns 'node_id,x_m,y_m,z_m,temperature_C'.";
        return res;
    }

    if (res.nodes.empty()) {
        res.success = false;
        res.error_message = "CSV contains a header but zero data rows.";
        return res;
    }

    res.node_count = res.nodes.size();
    res.mean_temp_C = sum_temp / static_cast<double>(res.node_count);
    res.success = true;
    return res;
}

std::string CadAnsysParser::to_json(const STLParseResult& res) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(6);
    ss << "{";
    ss << "\"success\":" << (res.success ? "true" : "false") << ",";
    if (!res.success) {
        ss << "\"error\":\"" << res.error_message << "\",";
        ss << "\"error_message\":\"" << res.error_message << "\"";
    } else {
        ss << "\"solid_name\":\"" << res.solid_name << "\",";
        ss << "\"triangle_count\":" << res.triangle_count << ",";
        ss << "\"bbox\":{\"min\":[" << res.bbox.min.x << "," << res.bbox.min.y << "," << res.bbox.min.z << "],";
        ss << "\"max\":[" << res.bbox.max.x << "," << res.bbox.max.y << "," << res.bbox.max.z << "],";
        ss << "\"center\":[" << res.bbox.center().x << "," << res.bbox.center().y << "," << res.bbox.center().z << "]},";
        
        // Structured triangles array
        ss << "\"triangles\":[";
        for (size_t i = 0; i < res.triangles.size(); ++i) {
            const auto& t = res.triangles[i];
            ss << "{\"normal\":{\"x\":" << t.normal.x << ",\"y\":" << t.normal.y << ",\"z\":" << t.normal.z << "},"
               << "\"v1\":{\"x\":" << t.v1.x << ",\"y\":" << t.v1.y << ",\"z\":" << t.v1.z << "},"
               << "\"v2\":{\"x\":" << t.v2.x << ",\"y\":" << t.v2.y << ",\"z\":" << t.v2.z << "},"
               << "\"v3\":{\"x\":" << t.v3.x << ",\"y\":" << t.v3.y << ",\"z\":" << t.v3.z << "}}";
            if (i + 1 < res.triangles.size()) ss << ",";
        }
        ss << "],";

        // Flat vertices buffer
        ss << "\"vertices\":[";
        for (size_t i = 0; i < res.triangles.size(); ++i) {
            const auto& t = res.triangles[i];
            ss << t.v1.x << "," << t.v1.y << "," << t.v1.z << ",";
            ss << t.v2.x << "," << t.v2.y << "," << t.v2.z << ",";
            ss << t.v3.x << "," << t.v3.y << "," << t.v3.z;
            if (i + 1 < res.triangles.size()) ss << ",";
        }
        ss << "],\"normals\":[";
        for (size_t i = 0; i < res.triangles.size(); ++i) {
            const auto& t = res.triangles[i];
            for (int k = 0; k < 3; ++k) {
                ss << t.normal.x << "," << t.normal.y << "," << t.normal.z;
                if (k < 2 || i + 1 < res.triangles.size()) ss << ",";
            }
        }
        ss << "]";
    }
    ss << "}";
    return ss.str();
}

std::string CadAnsysParser::to_json(const AnsysCSVParseResult& res) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(6);
    ss << "{";
    ss << "\"success\":" << (res.success ? "true" : "false") << ",";
    if (!res.success) {
        ss << "\"error\":\"" << res.error_message << "\",";
        ss << "\"error_message\":\"" << res.error_message << "\"";
    } else {
        int min_id = 0, max_id = 0;
        for (const auto& n : res.nodes) {
            if (n.temperature_C <= res.min_temp_C) min_id = n.node_id;
            if (n.temperature_C >= res.max_temp_C) max_id = n.node_id;
        }
        ss << "\"node_count\":" << res.node_count << ",";
        ss << "\"min_temp\":" << res.min_temp_C << ",";
        ss << "\"max_temp\":" << res.max_temp_C << ",";
        ss << "\"mean_temp\":" << res.mean_temp_C << ",";
        ss << "\"min_temp_node_id\":" << min_id << ",";
        ss << "\"max_temp_node_id\":" << max_id << ",";
        ss << "\"bbox\":{\"min\":[" << res.bbox.min.x << "," << res.bbox.min.y << "," << res.bbox.min.z << "],";
        ss << "\"max\":[" << res.bbox.max.x << "," << res.bbox.max.y << "," << res.bbox.max.z << "],";
        ss << "\"center\":[" << res.bbox.center().x << "," << res.bbox.center().y << "," << res.bbox.center().z << "]},";
        ss << "\"nodes\":[";
        for (size_t i = 0; i < res.nodes.size(); ++i) {
            const auto& n = res.nodes[i];
            ss << "{\"id\":" << n.node_id << ",\"x\":" << n.x_m << ",\"y\":" << n.y_m 
               << ",\"z\":" << n.z_m << ",\"T\":" << n.temperature_C << ",\"temp\":" << n.temperature_C << "}";
            if (i + 1 < res.nodes.size()) ss << ",";
        }
        ss << "]";
    }
    ss << "}";
    return ss.str();
}

} // namespace workbench

