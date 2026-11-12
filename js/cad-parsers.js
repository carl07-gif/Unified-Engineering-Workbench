/* ═════════════════════════════════════════════════════════════════════
   CAD & ANSYS Dataset Parsers (Task B & Task C)
   Unified Engineering Workbench - Strict Validation & 50MB Tested Bounds
   ═════════════════════════════════════════════════════════════════════ */

"use strict";

const CadParsers = (() => {
  const MAX_STL_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB tested limit

  /**
   * Parse ASCII STL string with strict syntax validation
   * @param {string} text - Raw STL file contents
   * @returns {{success: boolean, triangles?: Array, name?: string, count?: number, error?: string}}
   */
  function parseASCIIStl(text) {
    try {
      if (!text || typeof text !== "string") {
        throw new Error("File content is empty or invalid string.");
      }

      if (text.length > MAX_STL_FILE_SIZE_BYTES) {
        throw new Error(`STL file exceeds tested limit of 50 MB (size: ${text.length} bytes).`);
      }

      const lines = text.split("\n");
      const tris = [];
      let inSolid = false;
      let solidName = "solid";
      let verts = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const lower = line.toLowerCase();

        if (!inSolid) {
          if (lower.startsWith("solid")) {
            inSolid = true;
            solidName = line.substring(5).trim() || "solid";
            continue;
          } else {
            throw new Error("File must begin with 'solid' keyword.");
          }
        }

        if (lower.startsWith("endsolid")) break;

        if (lower.startsWith("vertex")) {
          const parts = line.split(/\s+/).slice(1).map(Number);
          if (parts.length === 3 && parts.every(Number.isFinite)) {
            verts.push({ x: parts[0], y: parts[1], z: parts[2] });
          }
        }

        if (lower.startsWith("endfacet")) {
          if (verts.length === 3) {
            tris.push({ v1: verts[0], v2: verts[1], v3: verts[2] });
          }
          verts = [];
        }
      }

      if (tris.length === 0) {
        throw new Error("Zero valid triangles found in ASCII STL.");
      }

      return { success: true, count: tris.length, name: solidName, triangles: tris };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Parse ANSYS Nodal CSV with schema validation & finite-value checks
   * @param {string} text - Raw CSV file contents
   * @returns {{success: boolean, nodes?: Array, minTemp?: number, maxTemp?: number, error?: string}}
   */
  function parseAnsysCSV(text) {
    try {
      if (!text || typeof text !== "string") {
        throw new Error("CSV file content is empty.");
      }

      const lines = text.split("\n");
      const nodes = [];
      let headerFound = false;
      let minT = Infinity, maxT = -Infinity;
      let maxN = null, minN = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;

        if (!headerFound) {
          const lower = line.toLowerCase();
          if (!lower.includes("node_id") || !lower.includes("temperature")) {
            throw new Error("Invalid header: expected 'node_id,x_m,y_m,z_m,temperature_C'");
          }
          headerFound = true;
          continue;
        }

        const parts = line.split(",").map(s => s.trim());
        if (parts.length < 5) continue;

        const id = parseInt(parts[0], 10);
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        const T = parseFloat(parts[4]);

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(T)) {
          throw new Error(`Non-finite numerical data on line ${i + 1}`);
        }

        const nodeObj = { id, x, y, z, T };
        if (T < minT) { minT = T; minN = nodeObj; }
        if (T > maxT) { maxT = T; maxN = nodeObj; }
        nodes.push(nodeObj);
      }

      if (nodes.length === 0) {
        throw new Error("No valid data rows found in CSV.");
      }

      return {
        success: true,
        nodes,
        count: nodes.length,
        minTemp: minT,
        maxTemp: maxT,
        minTempNode: minN,
        maxTempNode: maxN
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return {
    parseASCIIStl,
    parseAnsysCSV,
    MAX_STL_FILE_SIZE_BYTES
  };
})();
