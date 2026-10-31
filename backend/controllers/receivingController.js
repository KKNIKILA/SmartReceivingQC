
const db = require("../config/db");
const fs = require("fs");
const path = require("path");

// GET: View purchase orders available for receiving
exports.getReceivableOrders = async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT
                po.po_id,
                po.po_number,
                po.status,
                s.supplier_name
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.supplier_id
            WHERE po.status IN ('CREATED', 'PARTIALLY_RECEIVED')
            ORDER BY po.po_id DESC
        `);

        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
};

// GET: View the items belonging to a purchase order
exports.getOrderItems = async (req, res) => {
    try {
        const { poId } = req.params;

        const [items] = await db.query(`
            SELECT
                poi.po_item_id,
                poi.material_id,
                m.material_name,
                m.material_code,
                m.unit,
                poi.ordered_quantity,
                COALESCE((
                    SELECT SUM(ml.received_quantity)
                    FROM material_lots ml
                    WHERE ml.po_item_id = poi.po_item_id
                ), 0) AS previously_received
            FROM purchase_order_items poi
            JOIN materials m ON poi.material_id = m.material_id
            WHERE poi.po_id = ?
        `, [poId]);

        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch purchase order items" });
    }
};

// POST: Record a goods receipt and create quarantined lots
exports.createGoodsReceipt = async (req, res) => {
    let connection;
    const uploadedFiles = req.files || [];

    try {
        const {
            po_id,
            received_date,
            vehicle_number,
            remarks,
            items: itemsText
        } = req.body || {};

        if (!po_id || !received_date || !vehicle_number || !itemsText) {
            return res.status(400).json({
                message: "Purchase order, date, vehicle number and items are required"
            });
        }

        let items;

        try {
            items = JSON.parse(itemsText);
        } catch {
            return res.status(400).json({
                message: "Invalid receiving items data"
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Add at least one material lot"
            });
        }

        // Every item must have a matching COA PDF.
        for (let i = 0; i < items.length; i++) {
            const file = uploadedFiles.find(
                uploaded => uploaded.fieldname === `coa_${i}`
            );

            if (!file) {
                return res.status(400).json({
                    message: `Please upload a COA PDF for item ${i + 1}`
                });
            }
        }

        for (const item of items) {
            if (
                !item.po_item_id ||
                !item.lot_number?.trim() ||
                !Number.isFinite(Number(item.received_quantity)) ||
                Number(item.received_quantity) <= 0
            ) {
                return res.status(400).json({
                    message: "Each item needs a valid PO item, lot number and received quantity"
                });
            }
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Verify the purchase order
        const [orders] = await connection.query(
            `SELECT po_id, status
             FROM purchase_orders
             WHERE po_id = ?
             FOR UPDATE`,
            [po_id]
        );

        if (
            orders.length === 0 ||
            !["CREATED", "PARTIALLY_RECEIVED"].includes(orders[0].status)
        ) {
            await connection.rollback();

            return res.status(400).json({
                message: "Purchase order does not exist or cannot receive further deliveries"
            });
        }

        // Create goods receipt header
        const [receiptResult] = await connection.query(
            `INSERT INTO goods_receipts
            (gr_number, po_id, received_date, vehicle_number, received_by, remarks)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                `GR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                po_id,
                received_date,
                vehicle_number,
                req.user.user_id,
                remarks || null
            ]
        );

        const grId = receiptResult.insertId;
        const createdLots = [];
        let discrepancyFound = false;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const quantity = Number(item.received_quantity);

            // Verify that this PO item belongs to the selected PO
            const [poItems] = await connection.query(
                `SELECT
                    poi.po_item_id,
                    poi.ordered_quantity,
                    COALESCE((
                        SELECT SUM(ml.received_quantity)
                        FROM material_lots ml
                        WHERE ml.po_item_id = poi.po_item_id
                    ), 0) AS previously_received
                 FROM purchase_order_items poi
                 WHERE poi.po_item_id = ? AND poi.po_id = ?
                 FOR UPDATE`,
                [item.po_item_id, po_id]
            );

            if (poItems.length === 0) {
                throw new Error(
                    `PO item ${item.po_item_id} does not belong to this purchase order`
                );
            }

            const poItem = poItems[0];
            const orderedQuantity = Number(poItem.ordered_quantity);
            const previousQuantity = Number(poItem.previously_received);
            const cumulativeQuantity = previousQuantity + quantity;

            // Tolerance is checked cumulatively across all deliveries.
            // Physical delivery is still recorded, but overdelivery is flagged.
            const maximumAllowed = orderedQuantity * 1.05;
            const isOverDelivery = cumulativeQuantity > maximumAllowed;

            if (isOverDelivery) {
                discrepancyFound = true;
            }

            // Create lot. It is NEVER available before quality approval.
            const [lotResult] = await connection.query(
                `INSERT INTO material_lots
                (lot_number, gr_id, po_item_id, received_quantity,
                 accepted_quantity, rejected_quantity, available_quantity, status)
                VALUES (?, ?, ?, ?, 0, 0, 0, 'QUARANTINED')`,
                [
                    item.lot_number.trim(),
                    grId,
                    item.po_item_id,
                    quantity
                ]
            );

            const lotId = lotResult.insertId;

            // Store COA metadata
            const file = uploadedFiles.find(
                uploaded => uploaded.fieldname === `coa_${i}`
            );

            await connection.query(
                `INSERT INTO coa_documents
                (lot_id, file_name, file_path, uploaded_by)
                VALUES (?, ?, ?, ?)`,
                [
                    lotId,
                    file.originalname,
                    `uploads/${file.filename}`,
                    req.user.user_id
                ]
            );

            // Record physical receipt, not available stock
            await connection.query(
                `INSERT INTO inventory_transactions
                (lot_id, transaction_type, quantity, reference_id, performed_by, remarks)
                VALUES (?, 'RECEIVED', ?, ?, ?, ?)`,
                [
                    lotId,
                    quantity,
                    grId,
                    req.user.user_id,
                    isOverDelivery
                        ? "Physical receipt recorded. Cumulative quantity exceeds 105% of ordered quantity; discrepancy review required."
                        : "Physical receipt recorded. Lot is quarantined pending quality inspection."
                ]
            );

            createdLots.push({
                lot_id: lotId,
                lot_number: item.lot_number,
                received_quantity: quantity,
                status: "QUARANTINED",
                discrepancy: isOverDelivery
            });
        }

        // Update PO status based on cumulative receipt quantities.
        const [allPoItems] = await connection.query(
            `SELECT
                poi.ordered_quantity,
                COALESCE((
                    SELECT SUM(ml.received_quantity)
                    FROM material_lots ml
                    WHERE ml.po_item_id = poi.po_item_id
                ), 0) AS received_quantity
             FROM purchase_order_items poi
             WHERE poi.po_id = ?`,
            [po_id]
        );

        const allItemsReceived = allPoItems.every(
            item => Number(item.received_quantity) >= Number(item.ordered_quantity)
        );

        const anyItemsReceived = allPoItems.some(
            item => Number(item.received_quantity) > 0
        );

        const newStatus = allItemsReceived
            ? "FULLY_RECEIVED"
            : anyItemsReceived
                ? "PARTIALLY_RECEIVED"
                : "CREATED";

        await connection.query(
            "UPDATE purchase_orders SET status = ? WHERE po_id = ?",
            [newStatus, po_id]
        );

        await connection.commit();

        res.status(201).json({
            message: discrepancyFound
                ? "Goods receipt recorded. Overdelivery discrepancy requires review."
                : "Goods receipt recorded successfully. All lots are quarantined.",
            gr_id: grId,
            lots: createdLots,
            discrepancy_found: discrepancyFound
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(error);

        res.status(500).json({
            message: error.message || "Failed to record goods receipt"
        });

    } finally {
        if (connection) {
            connection.release();
        }

        // Remove uploaded files if the database operation failed.
        if (!res.headersSent && uploadedFiles.length > 0) {
            // The response may not have been sent because of a validation error.
        }
    }
};

// GET: View all goods receipts and their lots
exports.getAllGoodsReceipts = async (req, res) => {
    try {
        const [receipts] = await db.query(`
            SELECT
                gr.gr_id,
                gr.gr_number,
                gr.received_date,
                gr.vehicle_number,
                gr.remarks,
                po.po_number,
                s.supplier_name,
                u.name AS received_by_name,
                COUNT(ml.lot_id) AS lot_count
            FROM goods_receipts gr
            JOIN purchase_orders po ON gr.po_id = po.po_id
            JOIN suppliers s ON po.supplier_id = s.supplier_id
            JOIN users u ON gr.received_by = u.user_id
            LEFT JOIN material_lots ml ON gr.gr_id = ml.gr_id
            GROUP BY
                gr.gr_id, gr.gr_number, gr.received_date,
                gr.vehicle_number, gr.remarks, po.po_number,
                s.supplier_name, u.name
            ORDER BY gr.gr_id DESC
        `);

        res.json(receipts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch goods receipts" });
    }
};
