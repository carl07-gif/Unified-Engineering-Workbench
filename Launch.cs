using System;
using System.Diagnostics;
using System.IO;

namespace WorkbenchLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string htmlPath = Path.Combine(baseDir, "index.html");

                if (File.Exists(htmlPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = htmlPath,
                        UseShellExecute = true
                    };
                    Process.Start(psi);
                    return;
                }
            }
            catch
            {
                // Fallback attempt: launch direct Microsoft Edge
                try
                {
                    string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                    string htmlPath = Path.Combine(baseDir, "index.html");
                    Process.Start("msedge.exe", "\"" + htmlPath + "\"");
                }
                catch { }
            }
        }
    }
}

