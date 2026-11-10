git add .gitignore CMakeLists.txt DEPENDENCIES.md README.md
git commit -m "chore: initial repository scaffold, CMakeLists.txt and dependency lock"

git add data src/cpp/cad_ansys_parser.hpp src/cpp/cad_ansys_parser.cpp
git commit -m "feat(cad-ansys): implement Task B ASCII STL and ANSYS CSV parsers with validation"

git add src/cpp/fea_solver.hpp src/cpp/fea_solver.cpp results/thermal_fea_N80.csv results/mesh_convergence.csv
git commit -m "feat(fea): implement Task C 1D steady-state thermal FEA solver with midpoint convergence"

git add src/cpp/multicore_engine.hpp src/cpp/multicore_engine.cpp results/multicore_benchmark.csv
git commit -m "feat(multicore): implement Task D thread pool engine with batch scaling benchmark"

git add src/cpp/embedded_mocks.hpp src/cpp/embedded_mocks.cpp
git commit -m "feat(embedded): implement Task E MCU, FPGA, and JTAG mock adapters with fault recovery"

git add src/cpp/backprop_engine.hpp src/cpp/backprop_engine.cpp docs/HANDWRITTEN_BACKPROP.md docs/handwritten_backprop_2page.html results/backpropagation_training.csv
git commit -m "feat(backprop): implement Task F analytical backprop derivation and central FD check"

git add -A
git commit -m "feat(packaging): implement one-click Launch.exe binary, technical report, and verification suite"

git log --graph --oneline --decorate
