cmake_minimum_required(VERSION 3.16)
project(UnifiedEngineeringWorkbench VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Optimization flags for MSVC and GCC/Clang
if(MSVC)
    add_compile_options(/W4 /O2 /permissive- /EHsc)
    add_definitions(-D_CRT_SECURE_NO_WARNINGS)
else()
    add_compile_options(-Wall -Wextra -O3 -pthread)
endif()

# Core include directories
include_directories(src/cpp)

# Core library
add_library(workbench_core STATIC
    src/cpp/fea_solver.cpp
    src/cpp/cad_ansys_parser.cpp
    src/cpp/multicore_engine.cpp
    src/cpp/embedded_mocks.cpp
    src/cpp/backprop_engine.cpp
)

# Main CLI & Local Backend Server Executable
add_executable(workbench_backend
    src/cpp/main.cpp
)
target_link_libraries(workbench_backend PRIVATE workbench_core)

# Standalone Test Suite Executable
add_executable(workbench_tests
    tests/test_main.cpp
)
target_link_libraries(workbench_tests PRIVATE workbench_core)

# Launcher executable for one-click Windows target
if(WIN32)
    add_executable(Launch
        src/cpp/launcher_win.cpp
    )
endif()

