const express = require("express");
const router = express.Router();

const purchaseOrderController =
    require("../controllers/purchaseOrderController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

router.use(authenticateToken);

// View all purchase orders
router.get("/", purchaseOrderController.getAllPurchaseOrders);

// View one purchase order
router.get("/:id", purchaseOrderController.getPurchaseOrderById);

// Create purchase order
router.post(
    "/",
    authorizeRoles("ADMIN", "PURCHASE"),
    purchaseOrderController.createPurchaseOrder
);

module.exports = router;