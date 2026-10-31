const db = require("../config/db");

// GET: View all materials
exports.getAllMaterials = async (req, res) => {
    try {
        const [materials] = await db.query(`
            SELECT
                m.material_id,
                m.material_name,
                m.material_code,
                m.unit,
                m.description,
                COUNT(s.specification_id) AS specification_count
            FROM materials m
            LEFT JOIN material_specifications s
                ON m.material_id = s.material_id
            GROUP BY
                m.material_id,
                m.material_name,
                m.material_code,
                m.unit,
                m.description
            ORDER BY m.material_id DESC
        `);

        res.status(200).json(materials);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch materials" });
    }
};

// POST: Add a material
exports.addMaterial = async (req, res) => {
    try {
        const { material_name, material_code, unit, description } = req.body;

        if (!material_name?.trim() || !material_code?.trim() || !unit?.trim()) {
            return res.status(400).json({
                message: "Material name, code and unit are required"
            });
        }

        const [result] = await db.query(
            `INSERT INTO materials
            (material_name, material_code, unit, description)
            VALUES (?, ?, ?, ?)`,
            [
                material_name.trim(),
                material_code.trim(),
                unit.trim(),
                description || null
            ]
        );

        res.status(201).json({
            message: "Material added successfully",
            material_id: result.insertId
        });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "This material code already exists"
            });
        }

        res.status(500).json({ message: "Failed to add material" });
    }
};

// PUT: Update a material
exports.updateMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const { material_name, material_code, unit, description } = req.body;

        if (!material_name?.trim() || !material_code?.trim() || !unit?.trim()) {
            return res.status(400).json({
                message: "Material name, code and unit are required"
            });
        }

        const [result] = await db.query(
            `UPDATE materials
             SET material_name = ?,
                 material_code = ?,
                 unit = ?,
                 description = ?
             WHERE material_id = ?`,
            [
                material_name.trim(),
                material_code.trim(),
                unit.trim(),
                description || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Material not found" });
        }

        res.status(200).json({ message: "Material updated successfully" });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "This material code already exists"
            });
        }

        res.status(500).json({ message: "Failed to update material" });
    }
};

// DELETE: Delete a material
exports.deleteMaterial = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            "DELETE FROM materials WHERE material_id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Material not found" });
        }

        res.status(200).json({ message: "Material deleted successfully" });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                message: "This material is linked to other records and cannot be deleted."
            });
        }

        res.status(500).json({ message: "Failed to delete material" });
    }
};

// GET: View specifications for a material
exports.getSpecifications = async (req, res) => {
    try {
        const { id } = req.params;

        const [specifications] = await db.query(
            `SELECT *
             FROM material_specifications
             WHERE material_id = ?
             ORDER BY specification_id DESC`,
            [id]
        );

        res.status(200).json(specifications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch specifications" });
    }
};

// POST: Add a quality specification
exports.addSpecification = async (req, res) => {
    try {
        const { id } = req.params;
        const { parameter_name, min_value, max_value, unit } = req.body;

        if (
            !parameter_name?.trim() ||
            min_value === "" || min_value === null || min_value === undefined ||
            max_value === "" || max_value === null || max_value === undefined ||
            !unit?.trim()
        ) {
            return res.status(400).json({
                message: "All specification fields are required"
            });
        }

        const minimum = Number(min_value);
        const maximum = Number(max_value);

        if (
            !Number.isFinite(minimum) ||
            !Number.isFinite(maximum) ||
            minimum > maximum
        ) {
            return res.status(400).json({
                message: "Enter valid limits. Minimum cannot exceed maximum."
            });
        }

        const [material] = await db.query(
            "SELECT material_id FROM materials WHERE material_id = ?",
            [id]
        );

        if (material.length === 0) {
            return res.status(404).json({ message: "Material not found" });
        }

        await db.query(
            `INSERT INTO material_specifications
            (material_id, parameter_name, min_value, max_value, unit)
            VALUES (?, ?, ?, ?, ?)`,
            [id, parameter_name.trim(), minimum, maximum, unit.trim()]
        );

        res.status(201).json({
            message: "Quality specification added successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add specification" });
    }
};

// DELETE: Delete a specification
exports.deleteSpecification = async (req, res) => {
    try {
        const { id, specificationId } = req.params;

        const [result] = await db.query(
            `DELETE FROM material_specifications
             WHERE specification_id = ? AND material_id = ?`,
            [specificationId, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Specification not found"
            });
        }

        res.status(200).json({
            message: "Specification deleted successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete specification" });
    }
};