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
        const id = selDev.value;
        const dev = devicesState.find(d => d.id === id);
        if (dev) {
          dev.status = "connected";
          dev.statusMsg = "Connected and streaming telemetry.";
          renderDeviceCards();
        }
      });
    }

    if (btnDisconnect) {
      btnDisconnect.addEventListener("click", () => {
        const id = selDev.value;
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
        const id = selDev.value;
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

    grid.innerHTML = "";
    devicesState.forEach(d => {
      const card = document.createElement("div");
      card.className = `dev-card ${d.status === "timeout" ? "dev-card--timeout" : ""}`;

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
        <div style="font-size:11px; color:${d.status === "timeout" ? "var(--color-danger)" : "var(--color-text-muted)};">
          ${d.statusMsg}
        </div>
        <div class="dev-metrics">
          <div class="dev-metric-item">Core Voltage: <strong>${d.status === "disconnected" ? "0.00" : d.voltage.toFixed(2)} V</strong></div>
          <div class="dev-metric-item">Die Temp: <strong>${d.status === "disconnected" ? "--" : d.temp.toFixed(1)} °C</strong></div>
          <div class="dev-metric-item">Current: <strong>${d.status === "disconnected" ? "0.0" : d.current.toFixed(1)} mA</strong></div>
          <div class="dev-metric-item">Packets: <strong>#${d.seq}</strong></div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  return { init };
})();

