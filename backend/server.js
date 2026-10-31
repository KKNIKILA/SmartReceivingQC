
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const receivingRoutes = require("./routes/receivingRoutes");
const app = express();

// 1. Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/receiving", receivingRoutes);
// 2. Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// 3. Serve uploaded COA documents
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 4. Database connection
require("./config/db");

// 5. Import routes
const authRoutes = require("./routes/authRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const materialRoutes = require("./routes/materialRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");

// 6. Register API routes
app.use("/api/auth", authRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);

// 7. Home API
app.get("/", (req, res) => {
    res.send("Smart Receiving and Quality Control System API is Running!");
});

// 8. Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
