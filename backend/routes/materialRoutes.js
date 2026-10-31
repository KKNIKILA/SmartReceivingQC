const express = require("express");
const router = express.Router();

const materialController = require("../controllers/materialController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

router.use(authenticateToken);

// View materials
router.get("/", materialController.getAllMaterials);

// Add material
router.post(
    "/",
    authorizeRoles("ADMIN", "PURCHASE"),
    materialController.addMaterial
);

// Update material
router.put(
    "/:id",
    authorizeRoles("ADMIN", "PURCHASE"),
    materialController.updateMaterial
);

// Delete material
router.delete(
    "/:id",
    authorizeRoles("ADMIN"),
    materialController.deleteMaterial
);

// View specifications
router.get("/:id/specifications", materialController.getSpecifications);

// Add specification
router.post(
    "/:id/specifications",
    authorizeRoles("ADMIN", "QUALITY"),
    materialController.addSpecification
);

// Delete specification
router.delete(
    "/:id/specifications/:specificationId",
    authorizeRoles("ADMIN", "QUALITY"),
    materialController.deleteSpecification
);

module.exports = router;