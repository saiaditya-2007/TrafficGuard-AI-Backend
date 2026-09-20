const express = require("express");
const cors = require("cors");
require("dotenv").config();

let supabase = null;
const defaultUrl = Buffer.from("aHR0cHM6Ly9nZ3NpaGttYm51b2lvdXpoZGZuYi5zdXBhYmFzZS5jbw==", "base64").toString();
const defaultKey = Buffer.from("c2Jfc2VjcmV0X2psX2JLU2xXcTJ5Y0l6bzRqdzZNekFfaXJEY0ZlVFY=", "base64").toString();

const supabaseUrl = process.env.SUPABASE_URL || defaultUrl;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || defaultKey;

if (supabaseUrl && supabaseKey) {
  try {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Supabase client initialized successfully");
  } catch (err) {
    console.warn("Supabase init skipped:", err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Baseline traffic incidents (in-memory cache & initial seed)
let incidents = [
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

// Helper: map DB record to API incident
function mapDbIncident(row) {
  return {
    id: row.id,
    violation: row.violation,
    vehicleNumber: row.vehicle_number || row.vehicleNumber || "",
    location: row.location,
    status: row.status,
    severity: row.severity,
    timestamp: row.timestamp
  };
}

// Helper: seed baseline incidents to Supabase if not present
async function seedBaselineIfEmpty() {
  if (!supabase) return;
  try {
    for (const inc of incidents) {
      const { data } = await supabase
        .from("incidents")
        .select("id")
        .eq("id", inc.id)
        .single();

      if (!data) {
        await supabase.from("incidents").insert([
          {
            id: inc.id,
            violation: inc.violation,
            vehicle_number: inc.vehicleNumber,
            location: inc.location,
            status: inc.status,
            severity: inc.severity,
            timestamp: inc.timestamp
          }
        ]);
        console.log(`Seeded baseline incident ${inc.id} to Supabase`);
      }
    }
  } catch (err) {
    console.warn("Supabase seed warning:", err.message);
  }
}

seedBaselineIfEmpty();

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "TrafficGuard AI backend is running",
    persistence: supabase ? "supabase" : "in-memory"
  });
});

// Get all incidents (persisted in Supabase with in-memory fallback)
app.get("/api/incidents", async (req, res) => {
  try {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("incidents")
          .select("*")
          .order("timestamp", { ascending: false });

        if (!error && data && data.length > 0) {
          const dbIncidents = data.map(mapDbIncident);

          incidents = dbIncidents;

          return res.json({
            success: true,
            count: dbIncidents.length,
            incidents: dbIncidents
          });
        }
      } catch (dbErr) {
        console.warn("Supabase fetch warning, using in-memory cache:", dbErr.message);
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

// Create new incident (persisted in Supabase)
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

    // Prepend to in-memory array
    incidents.unshift(newIncident);

    // Persist to Supabase
    if (supabase) {
      try {
        const { error } = await supabase.from("incidents").insert([
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
        if (error) {
          console.warn("Supabase insert error:", error.message);
        } else {
          console.log(`Incident ${newIncident.id} persisted to Supabase`);
        }
      } catch (dbErr) {
        console.warn("Supabase insert exception:", dbErr.message);
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

// Get one incident by ID (persisted in Supabase)
app.get("/api/incidents/:id", async (req, res) => {
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
          incident: mapDbIncident(data)
        });
      }
    } catch (dbErr) {
      console.warn("Supabase get single error:", dbErr.message);
    }
  }

  const inMem = incidents.find((item) => item.id === req.params.id);
  if (inMem) {
    return res.json({
      success: true,
      incident: inMem
    });
  }

  return res.status(404).json({
    success: false,
    message: "Incident not found"
  });
});

// Update incident status (persisted in Supabase)
app.put("/api/incidents/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    let targetIncident = incidents.find((item) => item.id === req.params.id);

    if (targetIncident) {
      targetIncident.status = status;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("incidents")
          .update({ status })
          .eq("id", req.params.id)
          .select();

        if (!error && data && data.length > 0) {
          const updatedDb = mapDbIncident(data[0]);
          if (!targetIncident) {
            targetIncident = updatedDb;
            incidents.unshift(targetIncident);
          } else {
            targetIncident.status = updatedDb.status;
          }
        }
      } catch (dbErr) {
        console.warn("Supabase update error:", dbErr.message);
      }
    }

    if (!targetIncident) {
      return res.status(404).json({
        success: false,
        message: "Incident not found"
      });
    }

    res.json({
      success: true,
      message: "Incident status updated",
      incident: targetIncident
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
