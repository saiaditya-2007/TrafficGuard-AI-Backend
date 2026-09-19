const express = require("express");
const cors = require("cors");
require("dotenv").config();

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
  try {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );
  } catch (err) {
    console.warn("Supabase init skipped:", err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "TrafficGuard AI backend is running"
  });
});

// Sample traffic incidents (in-memory)
const incidents = [
  {
    id: "TG001",
    violation: "No Helmet",
    vehicleNumber: "TS09AB1234",
    location: "Tank Bund, Hyderabad",
    status: "Pending Review",
    severity: "Medium",
    timestamp: "2026-09-16 18:42:10"
  },
  {
    id: "TG002",
    violation: "Using Mobile Phone",
    vehicleNumber: "TS10CD5678",
    location: "Hitech City Road, Hyderabad",
    status: "Verified",
    severity: "High",
    timestamp: "2026-09-16 18:35:24"
  },
  {
    id: "TG003",
    violation: "Triple Riding",
    vehicleNumber: "TS08EF9012",
    location: "Kukatpally, Hyderabad",
    status: "Pending Review",
    severity: "High",
    timestamp: "2026-09-16 18:21:45"
  }
];

// Get all incidents
app.get("/api/incidents", async (req, res) => {
  try {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("incidents")
          .select("*")
          .order("timestamp", { ascending: false });

        if (!error && data && data.length > 0) {
          const dbIncidents = data.map((item) => ({
            id: item.id,
            violation: item.violation,
            vehicleNumber: item.vehicle_number,
            location: item.location,
            status: item.status,
            severity: item.severity,
            timestamp: item.timestamp
          }));

          const existingIds = new Set(dbIncidents.map((i) => i.id));
          const merged = [...dbIncidents];
          for (const inc of incidents) {
            if (!existingIds.has(inc.id)) {
              merged.push(inc);
            }
          }

          return res.json({
            success: true,
            count: merged.length,
            incidents: merged
          });
        }
      } catch (dbErr) {
        console.warn("Supabase fetch warning, using in-memory:", dbErr.message);
      }
    }

    res.json({
      success: true,
      count: incidents.length,
      incidents: incidents
    });
  } catch (error) {
    console.error("Failed to fetch incidents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch incidents"
    });
  }
});

// Create new incident
app.post("/api/incidents", async (req, res) => {
  try {
    const { id, violation, vehicleNumber, location, status, severity, timestamp } = req.body;

    const newIncident = {
      id: id || `TG${String(Date.now()).slice(-4)}`,
      violation: violation || "Traffic Violation",
      vehicleNumber: vehicleNumber || "TS 09 UB 7842",
      location: location || "Outer Ring Road, Hyderabad",
      status: status || "Pending Review",
      severity: severity || "High",
      timestamp: timestamp || new Date().toISOString().replace("T", " ").slice(0, 19)
    };

    // Add to in-memory array at the beginning
    incidents.unshift(newIncident);

    // If Supabase is configured, sync to table
    if (supabase) {
      try {
        await supabase.from("incidents").insert([
          {
            id: newIncident.id,
            violation: newIncident.violation,
            vehicle_number: newIncident.vehicleNumber,
            location: newIncident.location,
            status: newIncident.status,
            severity: newIncident.severity,
            timestamp: newIncident.timestamp
          }
        ]);
      } catch (dbErr) {
        console.warn("Supabase insert warning:", dbErr.message);
      }
    }

    res.status(201).json({
      success: true,
      incident: newIncident
    });
  } catch (error) {
    console.error("Failed to create incident:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create incident"
    });
  }
});

// Get one incident by ID
app.get("/api/incidents/:id", async (req, res) => {
  const inMem = incidents.find((item) => item.id === req.params.id);
  if (inMem) {
    return res.json({
      success: true,
      incident: inMem
    });
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("id", req.params.id)
        .single();

      if (!error && data) {
        return res.json({
          success: true,
          incident: {
            id: data.id,
            violation: data.violation,
            vehicleNumber: data.vehicle_number,
            location: data.location,
            status: data.status,
            severity: data.severity,
            timestamp: data.timestamp
          }
        });
      }
    } catch (dbErr) {
      console.warn("Supabase get single error:", dbErr.message);
    }
  }

  return res.status(404).json({
    success: false,
    message: "Incident not found"
  });
});

// Update incident status
app.put("/api/incidents/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const incident = incidents.find((item) => item.id === req.params.id);
    if (incident) {
      incident.status = status;
    }

    if (supabase) {
      try {
        await supabase
          .from("incidents")
          .update({ status })
          .eq("id", req.params.id);
      } catch (dbErr) {
        console.warn("Supabase update error:", dbErr.message);
      }
    }

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: "Incident not found"
      });
    }

    res.json({
      success: true,
      message: "Incident status updated",
      incident
    });
  } catch (error) {
    console.error("Failed to update incident:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update incident"
    });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`TrafficGuard AI backend running on port ${PORT}`);
});
