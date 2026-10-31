const express = require("express");
const router = express.Router();

const receivingController = require("../controllers/receivingController");
const upload = require("../middleware/uploadMiddleware");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

router.use(authenticateToken);

// View purchase orders available for receiving
router.get(
    "/purchase-orders",
    authorizeRoles("ADMIN", "RECEIVING"),
    receivingController.getReceivableOrders
);

// View items of a selected PO
router.get(
    "/purchase-orders/:poId/items",
    authorizeRoles("ADMIN", "RECEIVING"),
    receivingController.getOrderItems
);

// View previous goods receipts
router.get(
    "/",
    authorizeRoles("ADMIN", "RECEIVING", "QUALITY"),
    receivingController.getAllGoodsReceipts
);

// Record a goods receipt and upload COA files
router.post(
    "/",
    authorizeRoles("ADMIN", "RECEIVING"),
    upload.any(),
    receivingController.createGoodsReceipt
);

module.exports = router;