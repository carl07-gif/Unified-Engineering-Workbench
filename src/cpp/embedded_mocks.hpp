#pragma once

#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <cstdint>

namespace workbench {

enum class DeviceType {
    Microcontroller,
    FPGA,
    JTAG_Adapter
};

enum class ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Degraded_Timeout,
    Error
};

struct DeviceCapabilities {
    std::string device_name;
    std::string hardware_id; // VID:PID
    std::string serial_number;
    std::string firmware_version;
    DeviceType type;
    double io_voltage_V = 3.3;
    double max_clock_MHz = 100.0;
    std::vector<std::string> supported_protocols;
    std::string role_description;
};

struct DeviceTelemetry {
    uint64_t packet_sequence = 0;
    double timestamp_sec = 0.0;
    double core_voltage_V = 0.0;
    double die_temperature_C = 0.0;
    double current_draw_mA = 0.0;
    std::string status_flags;
    bool is_simulated = true;
};

class IEmbeddedDeviceAdapter {
public:
    virtual ~IEmbeddedDeviceAdapter() = default;
    virtual DeviceCapabilities get_capabilities() const = 0;
    virtual ConnectionStatus get_status() const = 0;
    virtual bool connect() = 0;
    virtual void disconnect() = 0;
    virtual DeviceTelemetry poll_telemetry() = 0;
    virtual void trigger_simulated_fault(const std::string& fault_type) = 0;
    virtual void clear_fault() = 0;
    virtual std::string get_status_message() const = 0;
};

// 1. STM32H743ZI Microcontroller Mock Adapter
class McuDeviceAdapter : public IEmbeddedDeviceAdapter {
public:
    McuDeviceAdapter();
    DeviceCapabilities get_capabilities() const override;
    ConnectionStatus get_status() const override { return status; }
    bool connect() override;
    void disconnect() override;
    DeviceTelemetry poll_telemetry() override;
    void trigger_simulated_fault(const std::string& fault_type) override;
    void clear_fault() override;
    std::string get_status_message() const override { return status_msg; }

private:
    ConnectionStatus status = ConnectionStatus::Disconnected;
    std::string status_msg = "Disconnected";
    uint64_t packet_seq = 0;
    bool fault_active = false;
    std::string current_fault;
};

// 2. Xilinx Artix-7 FPGA Mock Adapter
class FpgaDeviceAdapter : public IEmbeddedDeviceAdapter {
public:
    FpgaDeviceAdapter();
    DeviceCapabilities get_capabilities() const override;
    ConnectionStatus get_status() const override { return status; }
    bool connect() override;
    void disconnect() override;
    DeviceTelemetry poll_telemetry() override;
    void trigger_simulated_fault(const std::string& fault_type) override;
    void clear_fault() override;
    std::string get_status_message() const override { return status_msg; }

private:
    ConnectionStatus status = ConnectionStatus::Disconnected;
    std::string status_msg = "Disconnected";
    uint64_t packet_seq = 0;
    bool fault_active = false;
    std::string current_fault;
};

// 3. FTDI FT2232H JTAG Debug Adapter Mock
class JtagAdapterDevice : public IEmbeddedDeviceAdapter {
public:
    JtagAdapterDevice();
    DeviceCapabilities get_capabilities() const override;
    ConnectionStatus get_status() const override { return status; }
    bool connect() override;
    void disconnect() override;
    DeviceTelemetry poll_telemetry() override;
    void trigger_simulated_fault(const std::string& fault_type) override;
    void clear_fault() override;
    std::string get_status_message() const override { return status_msg; }

private:
    ConnectionStatus status = ConnectionStatus::Disconnected;
    std::string status_msg = "Disconnected";
    uint64_t packet_seq = 0;
    bool fault_active = false;
    std::string current_fault;
};

// Manager for unified discovery and control
class EmbeddedWorkbenchManager {
public:
    EmbeddedWorkbenchManager();
    std::vector<std::shared_ptr<IEmbeddedDeviceAdapter>> get_all_devices() const;
    std::shared_ptr<IEmbeddedDeviceAdapter> get_device_by_id(const std::string& id) const;
    std::string to_json_all_devices();

private:
    std::vector<std::shared_ptr<IEmbeddedDeviceAdapter>> devices;
};

} // namespace workbench

