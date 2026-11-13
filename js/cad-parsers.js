/* ═════════════════════════════════════════════════════════════════════
   CAD & ANSYS Dataset Parsers (Task B & Task C)
   Unified Engineering Workbench - Strict Validation & Error Diagnostics
   ═════════════════════════════════════════════════════════════════════ */

"use strict";

const CadParsers = (() => {
  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB tested limit

  /**
   * Parse ASCII STL string with strict syntax validation
   * @param {string} text - Raw STL file contents
   * @returns {{success: boolean, triangles?: Array, name?: string, count?: number, error?: string}}
   */
  function parseASCIIStl(text) {
    try {
      if (!text || typeof text !== "string" || !text.trim()) {
        throw new Error("STL file is empty (0 bytes).");
      }

      if (text.length > MAX_FILE_SIZE_BYTES) {
        throw new Error(`STL file exceeds maximum limit of 50 MB (size: ${text.length} bytes).`);
      }

      const lines = text.split("\n");
      const tris = [];
      let inSolid = false;
      let inFacet = false;
      let inLoop = false;
      let solidName = "solid";
      let verts = [];
      let currentNormal = { x: 0, y: 0, z: 1 };

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
            throw new Error(`Line ${i + 1}: Malformed ASCII STL. Must begin with 'solid <name>' keyword.`);
          }
        }

        if (lower.startsWith("endsolid")) {
          if (inFacet || inLoop) {
            throw new Error(`Line ${i + 1}: Unexpected 'endsolid' before closing open facet/loop.`);
          }
          break;
        }

        if (!inFacet && lower.startsWith("facet normal")) {
          inFacet = true;
          inLoop = false;
          verts = [];
          const parts = line.split(/\s+/).slice(2).map(Number);
          if (parts.length < 3 || parts.some(n => !Number.isFinite(n))) {
            throw new Error(`Line ${i + 1}: Malformed or non-finite facet normal coordinates.`);
          }
          currentNormal = { x: parts[0], y: parts[1], z: parts[2] };
          continue;
        }

        if (inFacet && !inLoop && lower.startsWith("outer loop")) {
          inLoop = true;
          continue;
        }

        if (inLoop && lower.startsWith("vertex")) {
          const parts = line.split(/\s+/).slice(1).map(Number);
          if (parts.length < 3 || parts.some(n => !Number.isFinite(n))) {
            throw new Error(`Line ${i + 1}: Malformed or non-finite vertex coordinates (NaN or Inf).`);
          }
          verts.push({ x: parts[0], y: parts[1], z: parts[2] });
          continue;
        }

        if (inLoop && lower.startsWith("endloop")) {
          inLoop = false;
          if (verts.length !== 3) {
            throw new Error(`Line ${i + 1}: Facet must contain exactly 3 vertices (found ${verts.length}).`);
          }
          continue;
        }

        if (inFacet && lower.startsWith("endfacet")) {
          if (inLoop) {
            throw new Error(`Line ${i + 1}: Missing 'endloop' keyword before 'endfacet'.`);
          }
          inFacet = false;
          if (verts.length === 3) {
            tris.push({
              normal: currentNormal,
              v1: verts[0],
              v2: verts[1],
              v3: verts[2]
            });
          }
          verts = [];
          continue;
        }
      }

      if (tris.length === 0) {
        throw new Error("Zero valid triangular facets found in STL file.");
      }

      return { success: true, count: tris.length, name: solidName, triangles: tris };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Parse ANSYS Nodal CSV with schema validation & finite-value checks
   * Rejects malformed rows, non-finite values, and duplicate node IDs
   * @param {string} text - Raw CSV file contents
   * @returns {{success: boolean, nodes?: Array, minTemp?: number, maxTemp?: number, error?: string}}
   */
  function parseAnsysCSV(text) {
    try {
      if (!text || typeof text !== "string" || !text.trim()) {
        throw new Error("CSV file is empty (0 bytes).");
      }

      if (text.length > MAX_FILE_SIZE_BYTES) {
        throw new Error(`CSV file exceeds maximum limit of 50 MB (size: ${text.length} bytes).`);
      }

      const lines = text.split("\n");
      const nodes = [];
      const seenIds = new Set();
      let headerFound = false;
      let minT = Infinity, maxT = -Infinity;
      let maxN = null, minN = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;

        if (!headerFound) {
          const lower = line.toLowerCase();
          if (!lower.includes("node_id") || !lower.includes("temperature")) {
            throw new Error(`Line ${i + 1}: Invalid header. Expected columns 'node_id,x_m,y_m,z_m,temperature_C'.`);
          }
          headerFound = true;
          continue;
        }

        const parts = line.split(",").map(s => s.trim());
        if (parts.length !== 5) {
          throw new Error(`Line ${i + 1}: Malformed row. Expected exactly 5 columns, found ${parts.length}.`);
        }

        const id = parseInt(parts[0], 10);
        if (isNaN(id) || id < 0) {
          throw new Error(`Line ${i + 1}: Invalid node_id '${parts[0]}'. Must be a positive integer.`);
        }

        if (seenIds.has(id)) {
          throw new Error(`Line ${i + 1}: Duplicate node_id ${id} detected.`);
        }
        seenIds.add(id);

        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        const T = parseFloat(parts[4]);

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(T)) {
          throw new Error(`Line ${i + 1}: Non-finite numerical data (NaN or Inf) detected.`);
        }

        const nodeObj = { id, x, y, z, T };
        if (T < minT) { minT = T; minN = nodeObj; }
        if (T > maxT) { maxT = T; maxN = nodeObj; }
        nodes.push(nodeObj);
      }

      if (!headerFound) {
        throw new Error("Missing header row with columns 'node_id,x_m,y_m,z_m,temperature_C'.");
      }

      if (nodes.length === 0) {
        throw new Error("CSV contains a valid header but zero data rows.");
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
    MAX_FILE_SIZE_BYTES
  };
})();
