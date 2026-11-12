#include "embedded_mocks.hpp"
#include <sstream>
#include <iomanip>
#include <chrono>
#include <cmath>

namespace workbench {

static double get_steady_seconds() {
    static auto start_time = std::chrono::steady_clock::now();
    auto now = std::chrono::steady_clock::now();
    return std::chrono::duration<double>(now - start_time).count();
}

// ─────────────────────────────────────────────────────────────────────────────
// MCU Adapter
// ─────────────────────────────────────────────────────────────────────────────
McuDeviceAdapter::McuDeviceAdapter() {}

DeviceCapabilities McuDeviceAdapter::get_capabilities() const {
    DeviceCapabilities caps;
    caps.device_name = "STM32H743ZI Nucleo-144 (ARM Cortex-M7)";
    caps.hardware_id = "0483:374B";
    caps.serial_number = "MCU-H7-882910A";
    caps.firmware_version = "v2.1.4-rtos";
    caps.type = DeviceType::Microcontroller;
    caps.io_voltage_V = 3.3;
    caps.max_clock_MHz = 480.0;
    caps.supported_protocols = {"USB-CDC Virtual COM", "UART", "SPI", "I2C", "CAN-FD"};
    caps.role_description = "Embedded telemetry supervisor, ADC acquisition, and safety trip loop.";
    return caps;
}

bool McuDeviceAdapter::connect() {
    status = ConnectionStatus::Connected;
    status_msg = "Connected via USB-CDC (COM7, 115200 8N1). Telemetry active.";
    return true;
}

void McuDeviceAdapter::disconnect() {
    status = ConnectionStatus::Disconnected;
    status_msg = "Disconnected safely. Port closed.";
}

DeviceTelemetry McuDeviceAdapter::poll_telemetry() {
    DeviceTelemetry tel;
    tel.packet_sequence = ++packet_seq;
    tel.timestamp_sec = get_steady_seconds();
    tel.is_simulated = true;

    if (fault_active && current_fault == "timeout") {
        status = ConnectionStatus::Degraded_Timeout;
        status_msg = "WARNING: Comm timeout (1200ms without ACK). Initiating auto-recovery retry...";
        tel.status_flags = "ERR_TIMEOUT_RETRYING";
        tel.core_voltage_V = 0.0;
        tel.die_temperature_C = 0.0;
        tel.current_draw_mA = 0.0;
        return tel;
    }

    status = ConnectionStatus::Connected;
    status_msg = "Operating normally (480 MHz, RTOS tick 1 kHz).";
    tel.core_voltage_V = 3.30 + 0.02 * std::sin(packet_seq * 0.1);
    tel.die_temperature_C = 42.5 + 1.2 * std::sin(packet_seq * 0.05);
    tel.current_draw_mA = 185.0 + 5.0 * std::cos(packet_seq * 0.15);
    tel.status_flags = "SYS_OK | RTOS_ACTIVE | WDT_PETTED";
    return tel;
}

void McuDeviceAdapter::trigger_simulated_fault(const std::string& fault_type) {
    fault_active = true;
    current_fault = fault_type;
}

void McuDeviceAdapter::clear_fault() {
    fault_active = false;
    current_fault.clear();
    status = ConnectionStatus::Connected;
    status_msg = "Fault cleared. Automatic resynchronization succeeded.";
}

// ─────────────────────────────────────────────────────────────────────────────
// FPGA Adapter
// ─────────────────────────────────────────────────────────────────────────────
FpgaDeviceAdapter::FpgaDeviceAdapter() {}

DeviceCapabilities FpgaDeviceAdapter::get_capabilities() const {
    DeviceCapabilities caps;
    caps.device_name = "Xilinx Artix-7 XC7A100T CSG324";
    caps.hardware_id = "03FD:0008";
    caps.serial_number = "FPGA-A7-100T-0042";
    caps.firmware_version = "bitstream_accel_v1.0.bit";
    caps.type = DeviceType::FPGA;
    caps.io_voltage_V = 1.8; // Bank voltage domain
    caps.max_clock_MHz = 200.0;
    caps.supported_protocols = {"SPI Slave (High Speed)", "AXI4-Lite", "JTAG Boundary Scan"};
    caps.role_description = "Hardware accelerator for parallel matrix multiplication and thermal mesh interpolation.";
    return caps;
}

bool FpgaDeviceAdapter::connect() {
    status = ConnectionStatus::Connected;
    status_msg = "Connected via High-Speed SPI (10 MHz, CPOL=0 CPHA=0). Bitstream verified.";
    return true;
}

void FpgaDeviceAdapter::disconnect() {
    status = ConnectionStatus::Disconnected;
    status_msg = "Disconnected. SPI bus tri-stated.";
}

DeviceTelemetry FpgaDeviceAdapter::poll_telemetry() {
    DeviceTelemetry tel;
    tel.packet_sequence = ++packet_seq;
    tel.timestamp_sec = get_steady_seconds();
    tel.is_simulated = true;

    if (fault_active && current_fault == "crc") {
        status = ConnectionStatus::Error;
        status_msg = "CRC Error on SPI telemetry frame! Flushing FIFO buffer and resending...";
        tel.status_flags = "ERR_CRC_MISMATCH";
        tel.core_voltage_V = 1.00;
        tel.die_temperature_C = 55.0;
        tel.current_draw_mA = 450.0;
        return tel;
    }

    status = ConnectionStatus::Connected;
    status_msg = "Operating normally (VCCINT=1.0V, VCCAUX=1.8V, VCCO=1.8V).";
    tel.core_voltage_V = 1.00 + 0.01 * std::sin(packet_seq * 0.08);
    tel.die_temperature_C = 51.2 + 2.5 * std::cos(packet_seq * 0.03);
    tel.current_draw_mA = 420.0 + 35.0 * std::sin(packet_seq * 0.2);
    tel.status_flags = "CONFIG_DONE | PLL_LOCKED | ACCEL_IDLE";
    return tel;
}

void FpgaDeviceAdapter::trigger_simulated_fault(const std::string& fault_type) {
    fault_active = true;
    current_fault = fault_type;
}

void FpgaDeviceAdapter::clear_fault() {
    fault_active = false;
    current_fault.clear();
    status = ConnectionStatus::Connected;
    status_msg = "FPGA error cleared. AXI pipeline flushed and re-synced.";
}

// ─────────────────────────────────────────────────────────────────────────────
// JTAG Debug Adapter
// ─────────────────────────────────────────────────────────────────────────────
JtagAdapterDevice::JtagAdapterDevice() {}

DeviceCapabilities JtagAdapterDevice::get_capabilities() const {
    DeviceCapabilities caps;
    caps.device_name = "FTDI FT2232H High-Speed USB-to-JTAG Debug Probe";
    caps.hardware_id = "0403:6010";
    caps.serial_number = "JTAG-FT-99120B";
    caps.firmware_version = "MPSSE Engine v1.5";
    caps.type = DeviceType::JTAG_Adapter;
    caps.io_voltage_V = 3.3; // Sensed VREF from target via level shifter
    caps.max_clock_MHz = 30.0;
    caps.supported_protocols = {"IEEE 1149.1 JTAG", "SWD", "MPSSE Bit-Bang"};
    caps.role_description = "Dedicated TAP controller interface for hardware in-circuit debug, flash burning, and boundary scan (NOT a generic compute board).";
    return caps;
}

bool JtagAdapterDevice::connect() {
    status = ConnectionStatus::Connected;
    status_msg = "Connected via USB 2.0 High-Speed. Target VREF sensed: 3.31V. TAP reset executed.";
    return true;
}

void JtagAdapterDevice::disconnect() {
    status = ConnectionStatus::Disconnected;
    status_msg = "Disconnected. Target pins tri-stated into high impedance (Hi-Z).";
}

DeviceTelemetry JtagAdapterDevice::poll_telemetry() {
    DeviceTelemetry tel;
    tel.packet_sequence = ++packet_seq;
    tel.timestamp_sec = get_steady_seconds();
    tel.is_simulated = true;

    if (fault_active && current_fault == "cable_disconnect") {
        status = ConnectionStatus::Error;
        status_msg = "CRITICAL: Target VREF dropped to 0.0V (Target cable detached or board powered off).";
        tel.status_flags = "ERR_TARGET_POWER_LOSS";
        tel.core_voltage_V = 0.0;
        tel.die_temperature_C = 30.0;
        tel.current_draw_mA = 25.0;
        return tel;
    }

    status = ConnectionStatus::Connected;
    status_msg = "TAP State: Run-Test/Idle. TCK Clock: 15.0 MHz. IR=0x09 IDCODE verified.";
    tel.core_voltage_V = 3.31; // Target VREF
    tel.die_temperature_C = 36.8 + 0.4 * std::sin(packet_seq * 0.05);
    tel.current_draw_mA = 68.0 + 3.0 * std::sin(packet_seq * 0.1);
    tel.status_flags = "TAP_IDLE | VREF_GOOD | MPSSE_SYNCED";
    return tel;
}

void JtagAdapterDevice::trigger_simulated_fault(const std::string& fault_type) {
    fault_active = true;
    current_fault = fault_type;
}

void JtagAdapterDevice::clear_fault() {
    fault_active = false;
    current_fault.clear();
    status = ConnectionStatus::Connected;
    status_msg = "Target voltage restored (3.3V). TAP re-synchronized successfully.";
}

// ─────────────────────────────────────────────────────────────────────────────
// Embedded Manager
// ─────────────────────────────────────────────────────────────────────────────
EmbeddedWorkbenchManager::EmbeddedWorkbenchManager() {
    devices.push_back(std::make_shared<McuDeviceAdapter>());
    devices.push_back(std::make_shared<FpgaDeviceAdapter>());
    devices.push_back(std::make_shared<JtagAdapterDevice>());

    // Connect all by default
    for (auto& dev : devices) {
        dev->connect();
    }
}

std::vector<std::shared_ptr<IEmbeddedDeviceAdapter>> EmbeddedWorkbenchManager::get_all_devices() const {
    return devices;
}

std::string EmbeddedWorkbenchManager::to_json_all_devices() {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(2);
    ss << "[";
    for (size_t i = 0; i < devices.size(); ++i) {
        auto dev = devices[i];
        auto caps = dev->get_capabilities();
        auto tel = dev->poll_telemetry();
        auto st = dev->get_status();

        ss << "{";
        ss << "\"name\":\"" << caps.device_name << "\",";
        ss << "\"id\":\"" << caps.hardware_id << "\",";
        ss << "\"serial\":\"" << caps.serial_number << "\",";
        ss << "\"firmware\":\"" << caps.firmware_version << "\",";
        ss << "\"type\":" << static_cast<int>(caps.type) << ",";
        ss << "\"io_voltage_V\":" << caps.io_voltage_V << ",";
        ss << "\"max_clock_MHz\":" << caps.max_clock_MHz << ",";
        ss << "\"role\":\"" << caps.role_description << "\",";
        ss << "\"status_code\":" << static_cast<int>(st) << ",";
        ss << "\"status_message\":\"" << dev->get_status_message() << "\",";
        ss << "\"telemetry\":{";
        ss << "\"seq\":" << tel.packet_sequence << ",";
        ss << "\"time\":" << tel.timestamp_sec << ",";
        ss << "\"voltage_V\":" << tel.core_voltage_V << ",";
        ss << "\"temp_C\":" << tel.die_temperature_C << ",";
        ss << "\"current_mA\":" << tel.current_draw_mA << ",";
        ss << "\"flags\":\"" << tel.status_flags << "\"";
        ss << "}}";
        if (i + 1 < devices.size()) ss << ",";
    }
    ss << "]";
    return ss.str();
}

} // namespace workbench

