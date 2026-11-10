#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#include <string>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    (void)hInstance;
    (void)hPrevInstance;
    (void)lpCmdLine;
    (void)nCmdShow;

    // Get the current directory of Launch.exe
    wchar_t buffer[MAX_PATH];
    GetModuleFileNameW(NULL, buffer, MAX_PATH);
    std::wstring exePath(buffer);
    size_t lastSlash = exePath.find_last_of(L"\\/");
    std::wstring appDir = (lastSlash != std::wstring::npos) ? exePath.substr(0, lastSlash) : L".";

    std::wstring htmlPath = appDir + L"\\index.html";

    // Launch default web browser to open the packaged application directly
    HINSTANCE res = ShellExecuteW(NULL, L"open", htmlPath.c_str(), NULL, appDir.c_str(), SW_SHOWNORMAL);

    if ((INT_PTR)res <= 32) {
        // Fallback: try relative open
        ShellExecuteW(NULL, L"open", L"index.html", NULL, NULL, SW_SHOWNORMAL);
    }

    return 0;
}

