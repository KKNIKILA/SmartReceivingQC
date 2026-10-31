const db = require("../config/db");

// GET: View all suppliers
exports.getAllSuppliers = async (req, res) => {
    try {
        const [suppliers] = await db.query(
            "SELECT * FROM suppliers ORDER BY supplier_id DESC"
        );

        res.status(200).json(suppliers);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch suppliers" });
    }
};

// POST: Add a supplier
exports.addSupplier = async (req, res) => {
    try {
        const {
            supplier_name,
            contact_person,
            email,
            phone,
            address
        } = req.body;

        if (!supplier_name || !supplier_name.trim()) {
            return res.status(400).json({
                message: "Supplier name is required"
            });
        }

        const [result] = await db.query(
            `INSERT INTO suppliers
            (supplier_name, contact_person, email, phone, address)
            VALUES (?, ?, ?, ?, ?)`,
            [
                supplier_name.trim(),
                contact_person || null,
                email || null,
                phone || null,
                address || null
            ]
        );

        res.status(201).json({
            message: "Supplier added successfully",
            supplier_id: result.insertId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add supplier" });
    }
};

// PUT: Update a supplier
exports.updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            supplier_name,
            contact_person,
            email,
            phone,
            address
        } = req.body;

        if (!supplier_name || !supplier_name.trim()) {
            return res.status(400).json({
                message: "Supplier name is required"
            });
        }

        const [result] = await db.query(
            `UPDATE suppliers
             SET supplier_name = ?,
                 contact_person = ?,
                 email = ?,
                 phone = ?,
                 address = ?
             WHERE supplier_id = ?`,
            [
                supplier_name.trim(),
                contact_person || null,
                email || null,
                phone || null,
                address || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Supplier not found"
            });
        }

        res.status(200).json({
            message: "Supplier updated successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update supplier" });
    }
};

// DELETE: Delete a supplier
exports.deleteSupplier = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            "DELETE FROM suppliers WHERE supplier_id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Supplier not found"
            });
        }

        res.status(200).json({
            message: "Supplier deleted successfully"
        });

    } catch (error) {
        console.error(error);

        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                message: "This supplier is linked to purchase orders and cannot be deleted."
            });
        }

        res.status(500).json({ message: "Failed to delete supplier" });
    }
};