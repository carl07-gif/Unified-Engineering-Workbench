# Software Dependencies & Environment Lock Information

This document specifies the target versions, compilers, language standards, runtime dependencies, and lock information for the **Unified Engineering Workbench (CandidateID_Workbench)**.

---

## 1. Operating System & Target Platform
- **Operating System**: Windows 11 x64 (Version 22H2 / 23H2 or later)
- **Binary Compatibility**: Windows 10 x64 (Version 1909 or later)
- **Architecture**: `x86_64` (AMD64 / Intel 64)

---

## 2. Compiler & Language Standards
| Component | Standard / Runtime | Minimum Version | Tested & Locked Version |
| :--- | :--- | :--- | :--- |
| **C++ Core Engine** | ISO C++17 (`/std:c++17` or `-std=c++17`) | CMake 3.16+ | MSVC 19.38 / GCC 13.2 / Clang 17 |
| **Windows Launcher** | Win32 / .NET Framework (Native GUI) | .NET 4.0 (Windows Built-in) | .NET Framework 4.8.1 (`csc.exe 14.8`) |
| **Frontend Presentation** | HTML5, CSS3, ES2020 JavaScript | Modern Web Standards | Microsoft Edge 120+ / Chrome 120+ |

---

## 3. Runtime Dependencies & Zero-Install Policy
- **External C++ Dependencies**: **None (Zero Third-Party C++ Libraries)**.
  - All numerical linear algebra (Thomas tridiagonal $\mathcal{O}(N)$ solver), ASCII STL parser, ANSYS CSV parser, thread pool, and backpropagation engine use standard C++17 library headers (`<vector>`, `<cmath>`, `<thread>`, `<mutex>`, `<chrono>`, `<fstream>`, `<sstream>`).
- **External Python / Node / Pip / NPM Dependencies**: **None**.
  - No Python runtime, no Node.js runtime, and no package manager is required.
- **Redistributable C++ Runtime**:
  - The C++ code is compiled with standard Windows CRT linkage (`ucrtbase.dll` / `msvcp140.dll`), which is pre-installed on all Windows 10 and Windows 11 systems.

---

## 4. Frontend Rendering & Asset Lock
- **3D Engine**: Pure HTML5 Canvas 2D Perspective Engine (Zero CDN dependencies; self-contained in `js/cad-viewer.js`).
- **2D Plotter**: Native Vector SVG Rendering Engine (Zero Chart.js / D3 dependencies; self-contained in `js/chart.js`).
- **Icons**: Tabler Icons Webfont (Local fallback CSS icons included for completely offline environments).

---

## 5. Build Configuration Lock (`CMakeLists.txt`)
```cmake
cmake_minimum_required(VERSION 3.16)
project(UnifiedEngineeringWorkbench VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# MSVC Configuration
if(MSVC)
    add_compile_options(/W4 /EHsc /O2 /permissive-)
else()
    add_compile_options(-Wall -Wextra -O3 -pthread)
endif()
```
