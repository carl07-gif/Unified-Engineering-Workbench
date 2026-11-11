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
          <span class="dev-name">${d.name}</span>
          <span class="dev-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div style="font-size:11px; color:var(--color-text-secondary); margin-bottom:4px;">
          ${d.role} &bull; <span style="font-family:var(--font-mono);">${d.hwId}</span>
        </div>
        <div style="font-size:11px; color:${d.status === "timeout" ? "var(--color-danger)" : "var(--color-text-muted)"}; font-weight:${d.status === "timeout" ? "600" : "400"};">
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
        normalFill: isDark ? "#13253b" : "#f0f7fe",
        normalStroke: "#3987e5",
        normalSub: "ONLINE • USB 2.0 HS"
      },
      {
        id: "mcu",
        box: document.getElementById("diagBoxMcu"),
        sub: document.getElementById("diagSubMcu"),
        lines: [document.getElementById("diagUsbMcu"), document.getElementById("diagLineMcuIn"), document.getElementById("diagLineMcuOut")],
        normalFill: isDark ? "#112b18" : "#f3fbf4",
        normalStroke: "#0ca30c",
        normalSub: "ONLINE • 3.3V Domain"
      },
      {
        id: "fpga",
        box: document.getElementById("diagBoxFpga"),
        sub: document.getElementById("diagSubFpga"),
        lines: [document.getElementById("diagUsbFpga"), document.getElementById("diagLineFpgaIn"), document.getElementById("diagLineFpgaOut")],
        normalFill: isDark ? "#331f16" : "#fdf4f0",
        normalStroke: "#d95926",
        normalSub: "ONLINE • 1.8V VCCO"
      }
    ];

    configs.forEach(cfg => {
      const dev = devicesState.find(d => d.id === cfg.id);
      if (!dev || !cfg.box) return;

      const isSelected = cfg.id === activeId;
      const gNode = cfg.box.parentElement;

      if (dev.status === "timeout") {
        cfg.box.setAttribute("fill", isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2");
        cfg.box.setAttribute("stroke", "#ef4444");
        cfg.box.setAttribute("stroke-width", "2.4");
        if (cfg.sub) {
          cfg.sub.textContent = "TIMEOUT • Retrying...";
          cfg.sub.setAttribute("fill", "#ef4444");
        }
        if (gNode) gNode.classList.add("diag-node-timeout");
        cfg.lines.forEach(l => {
          if (l) {
            l.setAttribute("stroke", "#ef4444");
            l.classList.remove("diag-flow-active");
          }
        });
      } else if (dev.status === "disconnected") {
        cfg.box.setAttribute("fill", isDark ? "#181820" : "#f1f5f9");
        cfg.box.setAttribute("stroke", isDark ? "#374151" : "#cbd5e1");
        cfg.box.setAttribute("stroke-width", "1.5");
        if (cfg.sub) {
          cfg.sub.textContent = "OFFLINE • Standby";
          cfg.sub.setAttribute("fill", isDark ? "#9ca3af" : "#64748b");
        }
        if (gNode) {
          gNode.classList.remove("diag-node-timeout");
          gNode.classList.add("diag-node-offline");
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
        cfg.box.setAttribute("stroke-width", isSelected ? "2.5" : "1.8");
        if (cfg.sub) {
          cfg.sub.textContent = cfg.normalSub;
          cfg.sub.setAttribute("fill", cfg.normalStroke);
        }
        if (gNode) {
          gNode.classList.remove("diag-node-timeout");
          gNode.classList.remove("diag-node-offline");
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

