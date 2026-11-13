#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <shellapi.h>
#include <string>

#pragma comment(lib, "ws2_32.lib")

namespace {

bool ping_server(int port) {
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        return false;
    }

    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) {
        WSACleanup();
        return false;
    }

    // Set 250ms socket timeout
    DWORD timeout = 250;
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout, sizeof(timeout));
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, (const char*)&timeout, sizeof(timeout));

    sockaddr_in addr;
    ZeroMemory(&addr, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<u_short>(port));
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");

    bool ok = false;
    if (connect(s, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) == 0) {
        const char req[] = "GET /api/ping HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
        send(s, req, sizeof(req) - 1, 0);

        char buf[512];
        int n = recv(s, buf, sizeof(buf) - 1, 0);
        if (n > 0) {
            buf[n] = '\0';
            if (strstr(buf, "200 OK") != nullptr || strstr(buf, "\"status\":\"ok\"") != nullptr) {
                ok = true;
            }
        }
    }

    closesocket(s);
    WSACleanup();
    return ok;
}

} // anonymous namespace

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    (void)hInstance;
    (void)hPrevInstance;
    (void)lpCmdLine;
    (void)nCmdShow;

    // Get current directory of Launch.exe
    wchar_t buffer[MAX_PATH];
    GetModuleFileNameW(NULL, buffer, MAX_PATH);
    std::wstring exePath(buffer);
    size_t lastSlash = exePath.find_last_of(L"\\/");
    std::wstring appDir = (lastSlash != std::wstring::npos) ? exePath.substr(0, lastSlash) : L".";

    std::wstring serverExe = appDir + L"\\workbench_server.exe";
    std::wstring serverCmd = L"\"" + serverExe + L"\" 7474 \"" + appDir + L"\"";

    // 1. Start C++ HTTP server process if present (non-blocking, hidden window)
    DWORD fileAttr = GetFileAttributesW(serverExe.c_str());
    if (fileAttr != INVALID_FILE_ATTRIBUTES && !(fileAttr & FILE_ATTRIBUTE_DIRECTORY)) {
        STARTUPINFOW si;
        PROCESS_INFORMATION pi;
        ZeroMemory(&si, sizeof(si));
        si.cb = sizeof(si);
        si.dwFlags = STARTF_USESHOWWINDOW;
        si.wShowWindow = SW_HIDE; // Hidden console window
        ZeroMemory(&pi, sizeof(pi));

        wchar_t cmdBuf[1024];
        wcsncpy_s(cmdBuf, serverCmd.c_str(), _countof(cmdBuf) - 1);

        if (CreateProcessW(NULL, cmdBuf, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, appDir.c_str(), &si, &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
        }
    }

    // 2. Poll /api/ping with retry (up to 20 attempts x 100ms = 2.0s)
    bool serverOnline = false;
    for (int attempt = 0; attempt < 20; ++attempt) {
        if (ping_server(7474)) {
            serverOnline = true;
            break;
        }
        Sleep(100);
    }

    // 3. Show message box if server fails to respond
    if (!serverOnline) {
        MessageBoxW(NULL, 
            L"The Unified Engineering Workbench C++ backend server failed to respond on http://127.0.0.1:7474/api/ping within 2 seconds.\n\nOpening presentation interface directly. Please ensure workbench_server.exe is compiled and port 7474 is available.",
            L"Workbench Backend Startup Notice", 
            MB_OK | MB_ICONWARNING);
    }

    // 4. Launch default web browser pointing to 127.0.0.1:7474/index.html
    LPCWSTR targetUrl = L"http://127.0.0.1:7474/index.html";
    HINSTANCE res = ShellExecuteW(NULL, L"open", targetUrl, NULL, appDir.c_str(), SW_SHOWNORMAL);

    if (reinterpret_cast<INT_PTR>(res) <= 32) {
        // Fallback: direct index.html
        std::wstring htmlPath = appDir + L"\\src\\frontend\\index.html";
        ShellExecuteW(NULL, L"open", htmlPath.c_str(), NULL, appDir.c_str(), SW_SHOWNORMAL);
    }

    return 0;
}
