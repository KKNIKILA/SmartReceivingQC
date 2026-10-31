
const db = require("../config/db");
const crypto = require("crypto");

// GET: View all purchase orders
exports.getAllPurchaseOrders = async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT
                po.po_id,
                po.po_number,
                po.order_date,
                po.expected_delivery_date,
                po.status,
                s.supplier_name,
                COUNT(poi.po_item_id) AS item_count
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.supplier_id
            LEFT JOIN purchase_order_items poi ON po.po_id = poi.po_id
            GROUP BY
                po.po_id, po.po_number, po.order_date,
                po.expected_delivery_date, po.status, s.supplier_name
            ORDER BY po.po_id DESC
        `);

        res.status(200).json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
};

// GET: View one purchase order and its items
exports.getPurchaseOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        const [orders] = await db.query(`
            SELECT po.*, s.supplier_name
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.supplier_id
            WHERE po.po_id = ?
        `, [id]);

        if (orders.length === 0) {
            return res.status(404).json({ message: "Purchase order not found" });
        }

        const [items] = await db.query(`
            SELECT
                poi.po_item_id,
                poi.material_id,
                m.material_name,
                m.material_code,
                m.unit,
                poi.ordered_quantity,
                poi.unit_price
            FROM purchase_order_items poi
            JOIN materials m ON poi.material_id = m.material_id
            WHERE poi.po_id = ?
        `, [id]);

        res.status(200).json({
            ...orders[0],
            items
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch purchase order" });
    }
};

// POST: Create a purchase order with multiple items
exports.createPurchaseOrder = async (req, res) => {
    let connection;

    try {
        const {
            supplier_id,
            order_date,
            expected_delivery_date,
            items
        } = req.body || {};

        if (!supplier_id || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Select a supplier and add at least one material"
            });
        }

        if (!order_date || !expected_delivery_date) {
            return res.status(400).json({
                message: "Order date and expected delivery date are required"
            });
        }

        if (expected_delivery_date < order_date) {
            return res.status(400).json({
                message: "Expected delivery date cannot be before order date"
            });
        }

        // Validate each item before saving
        for (const item of items) {
            const quantity = Number(item.ordered_quantity);
            const price = Number(item.unit_price);

            if (
                !item.material_id ||
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                !Number.isFinite(price) ||
                price < 0
            ) {
                return res.status(400).json({
                    message: "Each material needs a valid quantity and unit price"
                });
            }
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Confirm supplier exists
        const [suppliers] = await connection.query(
            "SELECT supplier_id FROM suppliers WHERE supplier_id = ?",
            [supplier_id]
        );

        if (suppliers.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Supplier not found" });
        }

        // Confirm all materials exist
        const materialIds = items.map(item => Number(item.material_id));
        const uniqueMaterialIds = [...new Set(materialIds)];

        const [materials] = await connection.query(
            `SELECT material_id FROM materials
             WHERE material_id IN (${uniqueMaterialIds.map(() => "?").join(",")})`,
            uniqueMaterialIds
        );

        if (materials.length !== uniqueMaterialIds.length) {
            await connection.rollback();
            return res.status(400).json({
                message: "One or more selected materials do not exist"
            });
        }

        // Generate a unique PO number
        const poNumber =
            `PO-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

        const [poResult] = await connection.query(
            `INSERT INTO purchase_orders
            (po_number, supplier_id, order_date, expected_delivery_date, status, created_by)
            VALUES (?, ?, ?, ?, 'CREATED', ?)`,
            [
                poNumber,
                supplier_id,
                order_date,
                expected_delivery_date,
                req.user.user_id
            ]
        );

        const poId = poResult.insertId;

        // Save all materials under this purchase order
        for (const item of items) {
            await connection.query(
                `INSERT INTO purchase_order_items
                (po_id, material_id, ordered_quantity, unit_price)
                VALUES (?, ?, ?, ?)`,
                [
                    poId,
                    item.material_id,
                    item.ordered_quantity,
                    item.unit_price
                ]
            );
        }

        await connection.commit();

        res.status(201).json({
            message: "Purchase order created successfully",
            po_id: poId,
            po_number: poNumber
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(error);
        res.status(500).json({ message: "Failed to create purchase order" });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};
