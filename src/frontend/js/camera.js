/* ═══════════════════════════════════════════════════════════════
   CadCamera: 3D Perspective Projection, Orbit, Pan & Zoom
   Part of Unified Engineering Workbench CAD Engine (Task B)
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const CadCamera = (() => {
  let rotX = 0.42;    // Pitch
  let rotY = -0.62;   // Yaw
  let zoom = 380;     // Scale
  let panX = 0;
  let panY = 15;

  let isDragging = false;
  let dragButton = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function init(canvas, onMoveCallback) {
    if (!canvas) return;

    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      dragButton = e.button;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (isDragging) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        if (dragButton === 0) {
          // Orbit
          rotY += dx * 0.007;
          rotX += dy * 0.007;
          rotX = Math.max(-1.5, Math.min(1.5, rotX));
        } else if (dragButton === 2) {
          // Pan
          panX += dx;
          panY += dy;
        }
      } else if (onMoveCallback) {
        onMoveCallback(mx, my);
      }
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      zoom = Math.max(90, Math.min(3000, zoom * zoomFactor));
    }, { passive: false });

    canvas.addEventListener("contextmenu", e => e.preventDefault());
  }

  function project(x, y, z, cx, cy) {
    const ox = x - 0.5;
    const oy = y;
    const oz = z;

    // Yaw (Y-axis)
    const x1 = ox * Math.cos(rotY) + oz * Math.sin(rotY);
    const z1 = -ox * Math.sin(rotY) + oz * Math.cos(rotY);

    // Pitch (X-axis)
    const y2 = oy * Math.cos(rotX) - z1 * Math.sin(rotX);
    const z2 = oy * Math.sin(rotX) + z1 * Math.cos(rotX);

    const cameraDist = 3.2;
    const fov = cameraDist / (cameraDist + z2);

    const sx = cx + (x1 * zoom * fov) + panX;
    const sy = cy - (y2 * zoom * fov) + panY;

    return { x: sx, y: sy, depth: z2, fov };
  }

  function isNormalFacingCamera(nx, ny, nz) {
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const vx = sinY * cosX;
    const vy = sinX;
    const vz = -cosY * cosX;
    return (nx * vx + ny * vy + nz * vz) > 0.001;
  }

  function fitToView() {
    rotX = 0.42;
    rotY = -0.62;
    zoom = 380;
    panX = 0;
    panY = 15;
  }

  function getTransform() {
    return { rotX, rotY, zoom, panX, panY };
  }

  return {
    init,
    project,
    isNormalFacingCamera,
    fitToView,
    getTransform
  };
})();

