/* ═════════════════════════════════════════════════════════════════════
   C++ Backend API Client — HTTP / REST Transport Layer
   Connects browser UI to native C++17 cpp-httplib server (127.0.0.1:7474)
   ═════════════════════════════════════════════════════════════════════ */

"use strict";

const ApiClient = (() => {
  // Determine API base URL: relative if served via HTTP on 7474; absolute if file://
  const isHostedOnServer = (window.location.protocol === "http:" || window.location.protocol === "https:") &&
                           (window.location.port === "7474" || window.location.port === "");
  const API_BASE = isHostedOnServer ? "" : "http://127.0.0.1:7474";

  let backendOnline = false;
  let healthListeners = [];
  let pollTimer = null;

  async function checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(`${API_BASE}/api/ping`, {
        method: "GET",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setOnline(true, data);
        sendHeartbeat();
        return true;
      }
    } catch (_) {
      // Server unreachable
    }
    setOnline(false, null);
    return false;
  }

  function setOnline(online, info) {
    backendOnline = online;
    healthListeners.forEach(fn => fn(online, info));
    updateHeaderBadge(online);
  }

  function updateHeaderBadge(online) {
    const badge = document.getElementById("backendBadge");
    const dot = document.getElementById("backendDot");
    const label = document.getElementById("backendLabel");
    if (label) {
      if (online) {
        label.textContent = "C++17 Engine Connected (127.0.0.1:7474)";
        if (dot) {
          dot.style.color = "#10b981";
          dot.className = "ti ti-circle-filled status-dot";
        }
        if (badge) {
          badge.style.borderColor = "rgba(16, 185, 129, 0.4)";
          badge.style.color = "#10b981";
        }
      } else {
        label.textContent = "Backend Offline (127.0.0.1:7474)";
        if (dot) {
          dot.style.color = "#ef4444";
          dot.className = "ti ti-circle-filled status-dot";
        }
        if (badge) {
          badge.style.borderColor = "rgba(239, 68, 68, 0.4)";
          badge.style.color = "#ef4444";
        }
      }
    }
  }

  async function sendHeartbeat() {
    if (!backendOnline) return;
    try {
      await fetch(`${API_BASE}/api/heartbeat`, { method: "POST" });
    } catch (_) {}
  }

  function onHealthChange(fn) {
    healthListeners.push(fn);
  }

  function startHealthMonitoring(intervalMs = 3500) {
    checkHealth();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(checkHealth, intervalMs);
  }

  /* ─────────────────────────────────────────────────────────────
     Task C: Thermal FEA (POST /api/thermal)
     ───────────────────────────────────────────────────────────── */
  async function solveThermal(params) {
    const res = await fetch(`${API_BASE}/api/thermal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  /* ─────────────────────────────────────────────────────────────
     Task B: ASCII STL Parser (POST /api/parse/stl)
     ───────────────────────────────────────────────────────────── */
  async function parseSTL(content) {
    const res = await fetch(`${API_BASE}/api/parse/stl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error_message || data.error || `STL parse failed (HTTP ${res.status})`);
    }
    return data;
  }

  /* ─────────────────────────────────────────────────────────────
     Task B: ANSYS CSV Parser (POST /api/parse/ansys)
     ───────────────────────────────────────────────────────────── */
  async function parseANSYS(content) {
    const res = await fetch(`${API_BASE}/api/parse/ansys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error_message || data.error || `ANSYS CSV parse failed (HTTP ${res.status})`);
    }
    return data;
  }

  /* ─────────────────────────────────────────────────────────────
     Task D: Multicore Benchmark (POST/GET /api/benchmark/*)
     ───────────────────────────────────────────────────────────── */
  async function startBenchmark(cases = 1000, segments = 40, seed = 42) {
    const res = await fetch(`${API_BASE}/api/benchmark/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cases, segments, seed })
    });
    return await res.json();
  }

  async function getBenchmarkStatus() {
    const res = await fetch(`${API_BASE}/api/benchmark/status`, { method: "GET" });
    return await res.json();
  }

  async function cancelBenchmark() {
    const res = await fetch(`${API_BASE}/api/benchmark/cancel`, { method: "POST" });
    return await res.json();
  }

  /* ─────────────────────────────────────────────────────────────
     Task E: Embedded Hardware Mocks (GET/POST /api/embedded/*)
     ───────────────────────────────────────────────────────────── */
  async function getEmbeddedDevices() {
    const res = await fetch(`${API_BASE}/api/embedded/devices`, { method: "GET" });
    return await res.json();
  }

  async function getEmbeddedTelemetry() {
    const res = await fetch(`${API_BASE}/api/embedded/telemetry`, { method: "GET" });
    return await res.json();
  }

  async function triggerFault(deviceId, fault) {
    const res = await fetch(`${API_BASE}/api/embedded/fault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, fault: fault })
    });
    return await res.json();
  }

  async function clearFault(deviceId) {
    const res = await fetch(`${API_BASE}/api/embedded/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId })
    });
    return await res.json();
  }

  /* ─────────────────────────────────────────────────────────────
     Task F: Backpropagation Training (GET /api/backprop)
     ───────────────────────────────────────────────────────────── */
  async function getBackpropagation(steps = 100, lr = 0.1) {
    const res = await fetch(`${API_BASE}/api/backprop?steps=${steps}&lr=${lr}`, { method: "GET" });
    return await res.json();
  }

  return {
    isOnline: () => backendOnline,
    checkHealth,
    startHealthMonitoring,
    onHealthChange,
    solveThermal,
    parseSTL,
    parseANSYS,
    startBenchmark,
    getBenchmarkStatus,
    cancelBenchmark,
    getEmbeddedDevices,
    getEmbeddedTelemetry,
    triggerFault,
    clearFault,
    getBackpropagation
  };
})();
