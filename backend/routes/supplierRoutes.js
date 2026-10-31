const express = require("express");
const router = express.Router();

const supplierController = require("../controllers/supplierController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

// View suppliers
router.get(
    "/",
    authenticateToken,
    supplierController.getAllSuppliers
);

// Add supplier
router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "PURCHASE"),
    supplierController.addSupplier
);

// Update supplier
router.put(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN", "PURCHASE"),
    supplierController.updateSupplier
);

// Delete supplier
router.delete(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN"),
    supplierController.deleteSupplier
);

module.exports = router;