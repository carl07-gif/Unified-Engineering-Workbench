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

    std::wstring serverExe = appDir + L"\\workbench_server.exe";
    std::wstring serverCmd = L"\"" + serverExe + L"\" 7474 \"" + appDir + L"\"";

    // Start C++ HTTP server process if present (non-blocking, hidden window)
    DWORD fileAttr = GetFileAttributesW(serverExe.c_str());
    if (fileAttr != INVALID_FILE_ATTRIBUTES && !(fileAttr & FILE_ATTRIBUTE_DIRECTORY)) {
        STARTUPINFOW si;
        PROCESS_INFORMATION pi;
        ZeroMemory(&si, sizeof(si));
        si.cb = sizeof(si);
        si.dwFlags = STARTF_USESHOWWINDOW;
        si.wShowWindow = SW_HIDE; // Hidden console window
        ZeroMemory(&pi, sizeof(pi));

        // Create writable buffer for command line
        wchar_t cmdBuf[1024];
        wcsncpy_s(cmdBuf, serverCmd.c_str(), _countof(cmdBuf) - 1);

        if (CreateProcessW(NULL, cmdBuf, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, appDir.c_str(), &si, &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            // Brief wait for socket bind
            Sleep(250);
        }
    }

    // Launch default web browser pointing to local C++ server on 127.0.0.1:7474
    // If server is active, serves via HTTP; fallback to direct index.html if offline
    LPCWSTR targetUrl = L"http://127.0.0.1:7474/index.html";
    HINSTANCE res = ShellExecuteW(NULL, L"open", targetUrl, NULL, appDir.c_str(), SW_SHOWNORMAL);

    if ((INT_PTR)res <= 32) {
        // Fallback: try opening index.html directly
        std::wstring htmlPath = appDir + L"\\index.html";
        ShellExecuteW(NULL, L"open", htmlPath.c_str(), NULL, appDir.c_str(), SW_SHOWNORMAL);
    }

    return 0;
}

