const express = require("express");
const cors = require("cors");
require("dotenv").config();

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

// Sample traffic incidents
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
app.get("/api/incidents", (req, res) => {
  res.json({
    success: true,
    count: incidents.length,
    incidents: incidents
  });
});

// Get one incident by ID
app.get("/api/incidents/:id", (req, res) => {
  const incident = incidents.find(
    (item) => item.id === req.params.id
  );

  if (!incident) {
    return res.status(404).json({
      success: false,
      message: "Incident not found"
    });
  }

  res.json({
    success: true,
    incident: incident
  });
});


// Update incident status
app.put("/api/incidents/:id/status", (req, res) => {
  const { status } = req.body;

  const incident = incidents.find(
    (item) => item.id === req.params.id
  );

  if (!incident) {
    return res.status(404).json({
      success: false,
      message: "Incident not found"
    });
  }

  incident.status = status;

  res.json({
    success: true,
    message: "Incident status updated",
    incident
  });
});// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`TrafficGuard AI backend running on port ${PORT}`);
});