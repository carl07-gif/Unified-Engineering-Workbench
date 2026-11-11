/* ═══════════════════════════════════════════════════════════════
   Embedded Hardware View Controller (Task E)
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const EmbeddedViewController = (() => {
  let devicesState = [
    {
      id: "mcu",
      name: "STM32H743ZI Microcontroller",
      role: "Telemetry Supervisor & Safety Loop",
      hwId: "0483:374B",
      image: "stm32h743zi_mcu.jpg",
      voltageDomain: "3.3V I/O",
      status: "connected", // "connected", "timeout", "disconnected"
      statusMsg: "Operating normally (480 MHz, RTOS tick 1 kHz)",
      voltage: 3.30,
      temp: 42.5,
      current: 185.0,
      seq: 1420
    },
    {
      id: "fpga",
      name: "Xilinx Artix-7 XC7A100T FPGA",
      role: "Matrix & Mesh Compute Accelerator",
      hwId: "03FD:0008",
      image: "artix7_fpga.jpg",
      voltageDomain: "1.8V VCCO / 1.0V VCCINT",
      status: "connected",
      statusMsg: "Bitstream verified (AXI4-Lite & SPI synchronized)",
      voltage: 1.01,
      temp: 51.4,
      current: 420.0,
      seq: 2890
    },
    {
      id: "jtag",
      name: "FTDI FT2232H JTAG Debug Probe",
      role: "IEEE 1149.1 TAP Controller Master",
      hwId: "0403:6010",
      image: "ft2232h_jtag.jpg",
      voltageDomain: "3.3V Target VREF Sensed",
      status: "connected",
      statusMsg: "TAP State: Run-Test/Idle (TCK 15.0 MHz)",
      voltage: 3.31,
      temp: 36.8,
      current: 68.0,
      seq: 852
    }
  ];

  let pollInterval = null;

  function init() {
    renderDeviceCards();
    setupEventListeners();
    startPolling();
  }

  function setupEventListeners() {
    // Device selection
    const selDev = document.getElementById("selHwDevice");
    const btnConnect = document.getElementById("btnConnectDev");
    const btnDisconnect = document.getElementById("btnDisconnectDev");
    const btnTimeout = document.getElementById("btnInjectTimeout");
    const btnClearFault = document.getElementById("btnClearFault");

    if (btnConnect) {
      btnConnect.addEventListener("click", () => {
        const id = selDev ? selDev.value : "mcu";
        const dev = devicesState.find(d => d.id === id);
        if (dev) {
          dev.status = "connected";
          dev.statusMsg = "Connected and streaming telemetry (1 kHz).";
          renderDeviceCards();
        }
      });
    }

    if (btnDisconnect) {
      btnDisconnect.addEventListener("click", () => {
        const id = selDev ? selDev.value : "mcu";
        const dev = devicesState.find(d => d.id === id);
        if (dev) {
          dev.status = "disconnected";
          dev.statusMsg = "Disconnected safely by user command.";
          renderDeviceCards();
        }
      });
    }

    if (btnTimeout) {
      btnTimeout.addEventListener("click", () => {
        const id = selDev ? selDev.value : "mcu";
        const dev = devicesState.find(d => d.id === id);
        if (dev) {
          dev.status = "timeout";
          dev.statusMsg = "COMM TIMEOUT: No ACK received within 1200 ms! Initiating auto-retry queue...";
          renderDeviceCards();

          // Auto-recovery demonstration after 3.5 seconds
          setTimeout(() => {
            if (dev.status === "timeout") {
              dev.status = "connected";
              dev.statusMsg = "Auto-recovery succeeded: Resynchronized via secondary packet handshake.";
              renderDeviceCards();
            }
          }, 3500);
        }
      });
    }

    if (btnClearFault) {
      btnClearFault.addEventListener("click", () => {
        devicesState.forEach(d => {
          if (d.status === "timeout") {
            d.status = "connected";
            d.statusMsg = "Fault manually cleared. Communication resynchronized.";
          }
        });
        renderDeviceCards();
      });
    }

    if (selDev) {
      selDev.addEventListener("change", () => {
        renderDeviceCards();
      });
    }

    // Interactive Diagram Node Clicking
    const diagNodes = document.querySelectorAll(".diag-node-box");
    diagNodes.forEach(node => {
      node.addEventListener("click", () => {
        const devId = node.dataset.dev;
        if (devId && selDev) {
          selDev.value = devId;
          renderDeviceCards();
        }
      });
    });

    // Subtab switching
    const btnDiagram = document.getElementById("btnSubtabDiagram");
    const btnPins = document.getElementById("btnSubtabPins");
    const btnSafety = document.getElementById("btnSubtabSafety");

    const contentDiagram = document.getElementById("subtabContentDiagram");
    const contentPins = document.getElementById("subtabContentPins");
    const contentSafety = document.getElementById("subtabContentSafety");

    function switchSubtab(activeBtn, activeContent) {
      [btnDiagram, btnPins, btnSafety].forEach(b => b.classList.remove("subtab--active"));
      [contentDiagram, contentPins, contentSafety].forEach(c => c.hidden = true);

      activeBtn.classList.add("subtab--active");
      activeContent.hidden = false;
    }

    if (btnDiagram) btnDiagram.addEventListener("click", () => switchSubtab(btnDiagram, contentDiagram));
    if (btnPins) btnPins.addEventListener("click", () => switchSubtab(btnPins, contentPins));
    if (btnSafety) btnSafety.addEventListener("click", () => switchSubtab(btnSafety, contentSafety));
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      devicesState.forEach(d => {
        if (d.status === "connected") {
          d.seq += 1;
          d.voltage += (Math.random() - 0.5) * 0.01;
          d.temp += (Math.random() - 0.5) * 0.2;
          d.current += (Math.random() - 0.5) * 2.0;
        }
      });
      renderDeviceCards();
    }, 1200);
  }

  function getDeviceThumbSvg(id) {
    if (id === 'mcu') {
      return `<svg width="40" height="40" viewBox="0 0 42 42" fill="none" style="flex-shrink:0; border-radius:5px; box-shadow:0 1px 4px rgba(0,0,0,0.35);">
        <!-- Nucleo Blue PCB -->
        <rect x="1" y="1" width="40" height="40" rx="4" fill="#0284c7" stroke="#38bdf8" stroke-width="0.8"/>
        <!-- ST Morpho Headers (Left & Right) -->
        <rect x="2.5" y="6" width="3" height="30" rx="0.5" fill="#0f172a"/>
        <circle cx="4" cy="9" r="0.7" fill="#fbbf24"/><circle cx="4" cy="13" r="0.7" fill="#fbbf24"/><circle cx="4" cy="17" r="0.7" fill="#fbbf24"/><circle cx="4" cy="21" r="0.7" fill="#fbbf24"/><circle cx="4" cy="25" r="0.7" fill="#fbbf24"/><circle cx="4" cy="29" r="0.7" fill="#fbbf24"/><circle cx="4" cy="33" r="0.7" fill="#fbbf24"/>
        <rect x="36.5" y="6" width="3" height="30" rx="0.5" fill="#0f172a"/>
        <circle cx="38" cy="9" r="0.7" fill="#fbbf24"/><circle cx="38" cy="13" r="0.7" fill="#fbbf24"/><circle cx="38" cy="17" r="0.7" fill="#fbbf24"/><circle cx="38" cy="21" r="0.7" fill="#fbbf24"/><circle cx="38" cy="25" r="0.7" fill="#fbbf24"/><circle cx="38" cy="29" r="0.7" fill="#fbbf24"/><circle cx="38" cy="33" r="0.7" fill="#fbbf24"/>
        <!-- ST-LINK USB Jack -->
        <rect x="16" y="1" width="10" height="4" rx="1" fill="#94a3b8" stroke="#475569" stroke-width="0.5"/>
        <!-- Push Buttons -->
        <rect x="8" y="4" width="4" height="4" rx="0.8" fill="#1e293b"/><circle cx="10" cy="6" r="1.2" fill="#2563eb"/>
        <rect x="30" y="4" width="4" height="4" rx="0.8" fill="#1e293b"/><circle cx="32" cy="6" r="1.2" fill="#000000"/>
        <!-- Main STM32 LQFP-144 IC -->
        <rect x="13" y="13" width="16" height="16" rx="1" fill="#0f172a" stroke="#64748b" stroke-width="0.6"/>
        <!-- IC Pins -->
        <line x1="15" y1="11.5" x2="15" y2="13" stroke="#cbd5e1" stroke-width="0.8"/><line x1="18" y1="11.5" x2="18" y2="13" stroke="#cbd5e1" stroke-width="0.8"/><line x1="21" y1="11.5" x2="21" y2="13" stroke="#cbd5e1" stroke-width="0.8"/><line x1="24" y1="11.5" x2="24" y2="13" stroke="#cbd5e1" stroke-width="0.8"/><line x1="27" y1="11.5" x2="27" y2="13" stroke="#cbd5e1" stroke-width="0.8"/>
        <line x1="15" y1="29" x2="15" y2="30.5" stroke="#cbd5e1" stroke-width="0.8"/><line x1="18" y1="29" x2="18" y2="30.5" stroke="#cbd5e1" stroke-width="0.8"/><line x1="21" y1="29" x2="21" y2="30.5" stroke="#cbd5e1" stroke-width="0.8"/><line x1="24" y1="29" x2="24" y2="30.5" stroke="#cbd5e1" stroke-width="0.8"/><line x1="27" y1="29" x2="27" y2="30.5" stroke="#cbd5e1" stroke-width="0.8"/>
        <line x1="11.5" y1="15" x2="13" y2="15" stroke="#cbd5e1" stroke-width="0.8"/><line x1="11.5" y1="18" x2="13" y2="18" stroke="#cbd5e1" stroke-width="0.8"/><line x1="11.5" y1="21" x2="13" y2="21" stroke="#cbd5e1" stroke-width="0.8"/><line x1="11.5" y1="24" x2="13" y2="24" stroke="#cbd5e1" stroke-width="0.8"/><line x1="11.5" y1="27" x2="13" y2="27" stroke="#cbd5e1" stroke-width="0.8"/>
        <line x1="29" y1="15" x2="30.5" y2="15" stroke="#cbd5e1" stroke-width="0.8"/><line x1="29" y1="18" x2="30.5" y2="18" stroke="#cbd5e1" stroke-width="0.8"/><line x1="29" y1="21" x2="30.5" y2="21" stroke="#cbd5e1" stroke-width="0.8"/><line x1="29" y1="24" x2="30.5" y2="24" stroke="#cbd5e1" stroke-width="0.8"/><line x1="29" y1="27" x2="30.5" y2="27" stroke="#cbd5e1" stroke-width="0.8"/>
        <circle cx="15" cy="15" r="0.8" fill="#38bdf8"/>
        <text x="21" y="22" font-size="3.8" fill="#e0f2fe" font-family="monospace" text-anchor="middle" font-weight="bold">M7</text>
        <text x="21" y="36.5" font-size="3.2" fill="#bae6fd" font-family="sans-serif" text-anchor="middle" font-weight="600">NUCLEO</text>
      </svg>`;
    } else if (id === 'fpga') {
      return `<svg width="40" height="40" viewBox="0 0 42 42" fill="none" style="flex-shrink:0; border-radius:5px; box-shadow:0 1px 4px rgba(0,0,0,0.35);">
        <!-- Arty A7 Black PCB -->
        <rect x="1" y="1" width="40" height="40" rx="4" fill="#18181b" stroke="#f97316" stroke-width="0.8"/>
        <!-- PMOD Headers -->
        <rect x="2.5" y="8" width="3" height="24" rx="0.5" fill="#09090b"/>
        <circle cx="4" cy="11" r="0.7" fill="#fbbf24"/><circle cx="4" cy="15" r="0.7" fill="#fbbf24"/><circle cx="4" cy="19" r="0.7" fill="#fbbf24"/><circle cx="4" cy="23" r="0.7" fill="#fbbf24"/><circle cx="4" cy="27" r="0.7" fill="#fbbf24"/>
        <rect x="36.5" y="8" width="3" height="24" rx="0.5" fill="#09090b"/>
        <circle cx="38" cy="11" r="0.7" fill="#fbbf24"/><circle cx="38" cy="15" r="0.7" fill="#fbbf24"/><circle cx="38" cy="19" r="0.7" fill="#fbbf24"/><circle cx="38" cy="23" r="0.7" fill="#fbbf24"/><circle cx="38" cy="27" r="0.7" fill="#fbbf24"/>
        <!-- USB Port -->
        <rect x="16" y="1" width="10" height="4" rx="1" fill="#94a3b8" stroke="#475569" stroke-width="0.5"/>
        <!-- DDR3 IC -->
        <rect x="8" y="9" width="6" height="8" rx="0.5" fill="#334155"/>
        <!-- Slide Switches -->
        <rect x="8" y="32" width="10" height="4" rx="0.5" fill="#09090b"/>
        <rect x="9.5" y="33" width="1.5" height="2" fill="#ef4444"/><rect x="12" y="33" width="1.5" height="2" fill="#22c55e"/><rect x="14.5" y="33" width="1.5" height="2" fill="#ef4444"/>
        <!-- FPGA BGA Chip -->
        <rect x="14" y="13" width="15" height="15" rx="1.5" fill="#27272a" stroke="#cbd5e1" stroke-width="0.8"/>
        <circle cx="21.5" cy="18.5" r="2.2" stroke="#f97316" stroke-width="0.8" fill="none"/>
        <text x="21.5" y="25" font-size="3" fill="#fed7aa" font-family="monospace" text-anchor="middle" font-weight="bold">ARTIX-7</text>
        <text x="29" y="36.5" font-size="3.2" fill="#fdba74" font-family="sans-serif" text-anchor="middle" font-weight="600">ARTY A7</text>
      </svg>`;
    } else if (id === 'jtag') {
      return `<svg width="40" height="40" viewBox="0 0 42 42" fill="none" style="flex-shrink:0; border-radius:5px; box-shadow:0 1px 4px rgba(0,0,0,0.35);">
        <!-- FTDI Emerald Green PCB -->
        <rect x="1" y="1" width="40" height="40" rx="4" fill="#064e3b" stroke="#10b981" stroke-width="0.8"/>
        <!-- USB Type-C Port -->
        <rect x="1" y="15" width="4.5" height="12" rx="1" fill="#94a3b8" stroke="#475569" stroke-width="0.5"/>
        <!-- Crystal Oscillator -->
        <rect x="8" y="8" width="6" height="4" rx="0.8" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.4"/>
        <text x="11" y="11" font-size="2.2" fill="#334155" text-anchor="middle">12M</text>
        <!-- LEDs -->
        <circle cx="10" cy="30" r="1.3" fill="#22c55e"/><circle cx="10" cy="34" r="1.3" fill="#3b82f6"/>
        <!-- FTDI IC -->
        <rect x="16" y="14" width="12" height="12" rx="1" fill="#0f172a" stroke="#64748b" stroke-width="0.5"/>
        <text x="22" y="21" font-size="3.2" fill="#a7f3d0" font-family="monospace" text-anchor="middle" font-weight="bold">FTDI</text>
        <!-- Shrouded 10-pin JTAG Header -->
        <rect x="31" y="9" width="8" height="24" rx="1" fill="#022c22" stroke="#10b981" stroke-width="0.6"/>
        <circle cx="33.5" cy="13" r="0.8" fill="#fbbf24"/><circle cx="36.5" cy="13" r="0.8" fill="#fbbf24"/>
        <circle cx="33.5" cy="17" r="0.8" fill="#fbbf24"/><circle cx="36.5" cy="17" r="0.8" fill="#fbbf24"/>
        <circle cx="33.5" cy="21" r="0.8" fill="#fbbf24"/><circle cx="36.5" cy="21" r="0.8" fill="#fbbf24"/>
        <circle cx="33.5" cy="25" r="0.8" fill="#fbbf24"/><circle cx="36.5" cy="25" r="0.8" fill="#fbbf24"/>
        <circle cx="33.5" cy="29" r="0.8" fill="#fbbf24"/><circle cx="36.5" cy="29" r="0.8" fill="#fbbf24"/>
      </svg>`;
    }
    return '';
  }

  function renderDeviceCards() {
    const grid = document.getElementById("deviceCardsGrid");
    if (!grid) return;

    const selDev = document.getElementById("selHwDevice");
    const activeId = selDev ? selDev.value : "mcu";

    grid.innerHTML = "";
    devicesState.forEach(d => {
      const isSelected = d.id === activeId;
      const card = document.createElement("div");
      card.className = `dev-card ${d.status === "timeout" ? "dev-card--timeout" : ""} ${isSelected ? "dev-card--selected" : ""}`;

      let badgeClass = "dev-badge--ok";
      let badgeText = "ONLINE";

      if (d.status === "timeout") {
        badgeClass = "dev-badge--warn";
        badgeText = "TIMEOUT (RECOVERING)";
      } else if (d.status === "disconnected") {
        badgeClass = "dev-badge--error";
        badgeText = "OFFLINE";
      }

      card.innerHTML = `
        <div class="dev-card-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="assets/devices/${d.image}" alt="${d.name}" class="dev-card-photo" onerror="this.style.display='none'" />
            <div>
              <div class="dev-name">${d.name}</div>
              <div style="font-size:10.5px; color:var(--color-text-secondary); margin-top:2px;">
                ${d.role} &bull; <span style="font-family:var(--font-mono); font-size:10px;">${d.hwId}</span>
              </div>
            </div>
          </div>
          <span class="dev-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div style="font-size:11px; color:${d.status === "timeout" ? "var(--color-danger)" : "var(--color-text-muted)"}; font-weight:${d.status === "timeout" ? "600" : "400"}; margin-top:4px;">
          ${d.statusMsg}
        </div>
        <div class="dev-metrics">
          <div class="dev-metric-item">Core Voltage: <strong>${d.status === "disconnected" ? "0.00" : d.voltage.toFixed(2)} V</strong></div>
          <div class="dev-metric-item">Die Temp: <strong>${d.status === "disconnected" ? "--" : d.temp.toFixed(1)} °C</strong></div>
          <div class="dev-metric-item">Current: <strong>${d.status === "disconnected" ? "0.0" : d.current.toFixed(1)} mA</strong></div>
          <div class="dev-metric-item">Packets: <strong>#${d.seq}</strong></div>
        </div>
      `;

      card.addEventListener("click", () => {
        if (selDev) {
          selDev.value = d.id;
          renderDeviceCards();
        }
      });

      grid.appendChild(card);
    });

    updateBlockDiagram(activeId);
  }

  function updateBlockDiagram(activeId) {
    const isDark = (document.documentElement.getAttribute("data-mode") || "light") === "dark";

    const configs = [
      {
        id: "jtag",
        box: document.getElementById("diagBoxJtag"),
        sub: document.getElementById("diagSubJtag"),
        lines: [document.getElementById("diagUsbJtag"), document.getElementById("diagLineJtagIn"), document.getElementById("diagLineJtagOut")],
        normalFill: "url(#jtagPcbGrad)",
        normalStroke: "#38bdf8",
        normalSub: "ONLINE • USB 2.0 HS"
      },
      {
        id: "mcu",
        box: document.getElementById("diagBoxMcu"),
        sub: document.getElementById("diagSubMcu"),
        lines: [document.getElementById("diagUsbMcu"), document.getElementById("diagLineMcuIn"), document.getElementById("diagLineMcuOut")],
        normalFill: "url(#mcuPcbGrad)",
        normalStroke: "#22c55e",
        normalSub: "ONLINE • 3.3V Domain"
      },
      {
        id: "fpga",
        box: document.getElementById("diagBoxFpga"),
        sub: document.getElementById("diagSubFpga"),
        lines: [document.getElementById("diagUsbFpga"), document.getElementById("diagLineFpgaIn"), document.getElementById("diagLineFpgaOut")],
        normalFill: "url(#fpgaPcbGrad)",
        normalStroke: "#f97316",
        normalSub: "ONLINE • 1.8V VCCO"
      }
    ];

    configs.forEach(cfg => {
      const dev = devicesState.find(d => d.id === cfg.id);
      if (!dev || !cfg.box) return;

      const isSelected = cfg.id === activeId;
      const gNode = cfg.box.parentElement;

      if (dev.status === "timeout") {
        cfg.box.setAttribute("fill", cfg.normalFill);
        cfg.box.setAttribute("stroke", "#ef4444");
        cfg.box.setAttribute("stroke-width", "2.8");
        if (cfg.sub) {
          cfg.sub.textContent = "TIMEOUT • Retrying...";
          cfg.sub.setAttribute("fill", isDark ? "#fca5a5" : "#b91c1c");
        }
        if (gNode) {
          gNode.classList.add("diag-node-timeout");
          gNode.style.opacity = "1";
        }
        cfg.lines.forEach(l => {
          if (l) {
            l.setAttribute("stroke", "#ef4444");
            l.classList.remove("diag-flow-active");
          }
        });
      } else if (dev.status === "disconnected") {
        cfg.box.setAttribute("fill", isDark ? "#181820" : "#cbd5e1");
        cfg.box.setAttribute("stroke", isDark ? "#374151" : "#94a3b8");
        cfg.box.setAttribute("stroke-width", "1.5");
        if (cfg.sub) {
          cfg.sub.textContent = "OFFLINE • Standby";
          cfg.sub.setAttribute("fill", isDark ? "#9ca3af" : "#475569");
        }
        if (gNode) {
          gNode.classList.remove("diag-node-timeout");
          gNode.classList.add("diag-node-offline");
          gNode.style.opacity = "0.45";
        }
        cfg.lines.forEach(l => {
          if (l) {
            l.setAttribute("stroke", isDark ? "#374151" : "#cbd5e1");
            l.classList.remove("diag-flow-active");
          }
        });
      } else {
        // Connected (Online)
        cfg.box.setAttribute("fill", cfg.normalFill);
        cfg.box.setAttribute("stroke", isSelected ? "var(--color-accent)" : cfg.normalStroke);
        cfg.box.setAttribute("stroke-width", isSelected ? "2.6" : "1.8");
        if (cfg.sub) {
          cfg.sub.textContent = cfg.normalSub;
          cfg.sub.setAttribute("fill", cfg.normalStroke);
        }
        if (gNode) {
          gNode.classList.remove("diag-node-timeout");
          gNode.classList.remove("diag-node-offline");
          gNode.style.opacity = "1";
        }
        cfg.lines.forEach(l => {
          if (l) {
            l.setAttribute("stroke", cfg.normalStroke);
            l.classList.add("diag-flow-active");
          }
        });
      }
    });
  }

  return { init, updateBlockDiagram };
})();

