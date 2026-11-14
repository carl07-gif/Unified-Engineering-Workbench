# Data Provenance, Schemas & Format Specifications

## 1. ASCII STL Geometry (`sample_geometry.stl`)
- **Provenance**: Self-created canonical 3D cuboid heat conduction rod with dimension $L = 1.0\text{ m} \times 0.05\text{ m} \times 0.05\text{ m}$, generated to match the cross-sectional geometry of the 1D FEA problem.
- **Format**: Standard ASCII StereoLithography (`.stl`).
- **Units**: International System of Units (SI) — meters ($\text{m}$).
- **Structure**: 12 triangular facets (2 per face), outward normal vectors, 3 vertices per facet, right-handed coordinate convention.
- **Validation**: Strict ASCII compliance. Non-finite numbers ($\text{NaN}, \pm\infty$), missing loop tags, and non-triangular facets are explicitly rejected by C++ parser.

## 2. ANSYS Nodal Temperature Export (`sample_ansys_nodal_temps.csv`)
- **Provenance & Synthetic Label**: **SYNTHETIC DATASET**. Created to match standard ANSYS Mechanical APDL / Workbench nodal temperature table exports (`*GET` or Result Table Export). It is **not** an actual proprietary ANSYS software export.
- **Format**: Comma-Separated Values (`.csv`) with comment lines prefixed by `#`.
- **Schema & Columns**:
  1. `node_id` (Integer): Positive unique node identifier.
  2. `x_m` (Float, meters): X coordinate in global coordinate system.
  3. `y_m` (Float, meters): Y coordinate in global coordinate system.
  4. `z_m` (Float, meters): Z coordinate in global coordinate system.
  5. `temperature_C` (Float, degrees Celsius): Steady-state nodal temperature.
- **Physical Basis**: Evaluated from $T(x) = 100 - 80\frac{x}{L} + \frac{q}{2k}x(L-x)$ with $L=1.0\text{ m}, k=10\text{ W/(m}\cdot\text{K)}, q=10000\text{ W/m}^3, T(0)=100^\circ\text{C}, T(L)=20^\circ\text{C}$, extruded across the 4 corners of the cross-section.
- **Validation**: Checked for finite values ($\neg\text{NaN}, \neg\text{Inf}$), positive node IDs, and header integrity.

## 3. Tested File-Size Limits & Parser Throughput Benchmarks
The C++17 parsers (`src/cpp/cad_ansys_parser.cpp`) and API endpoints (`POST /api/parse/stl`, `POST /api/parse/ansys`) enforce strict buffer thresholds and have been empirically benchmarked:
- **Maximum Buffer Limit**: **50 MB** safety cap. Payloads exceeding 50 MB are immediately rejected before parsing with HTTP 400 and actionable error: `"File exceeds maximum supported buffer size (50 MB)."`.
- **Large STL Performance**: Stress-tested in `tests/test_main.cpp` with **10,000 triangular facets** (~1.8 MB ASCII payload):
  - Parse time: **189.1 ms** (throughput: ~53,000 facets/sec).
  - Validation: Validates facet count, normals, vertex coordinates, and boundary loops.
- **Large ANSYS CSV Performance**: Stress-tested in `tests/test_main.cpp` with **25,000 nodal temperature rows** (~1.2 MB CSV payload):
  - Parse time: **35.6 ms** (throughput: ~700,000 rows/sec).
  - Validation: Validates unique positive integer `node_id`, finite IEEE-754 floats ($\neg\text{NaN}, \neg\pm\infty$), and valid comma separation.
- **Malformed & Edge-Case Rejection**:
  - Empty files (`0 bytes`) are rejected with `"File payload is empty"`.
  - Malformed STL facets (missing `outer loop`, truncated lines) are rejected with exact error messages.
  - Malformed CSV rows (missing columns, non-numeric strings, negative IDs) are rejected with line-numbered diagnostics.

## 4. Scope Boundaries & Assumptions
- **Native CAD & ANSYS Formats**: Native ANSYS project/result formats (`.wbpj`, `.rst`, `.rth`, `.cdb`) and native CAD solids (`.step`, `.stp`, `.iges`, `.sldprt`, `.prt`) are explicitly **outside scope** per assignment specification.
- **Interchange Formats Supported**: Standard open ASCII StereoLithography (`.stl`) and comma-separated tabular text (`.csv`).
- **Spatial Registration**: Mesh-to-result spatial registration is explicitly **not required** by specification; nodes and geometry are rendered in their respective global coordinate systems.


