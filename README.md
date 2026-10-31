Smart Receiving and Quality Control System
A web-based application for managing raw-material receiving, supplier
documentation, and quality-control workflows in a manufacturing
environment.

The system is designed to ensure that received materials are not
automatically treated as usable inventory. Every received lot is
placed in quarantine first. Only the quantity approved by the Quality
team can later be made available for production use.
1. Project Overview
Manufacturing companies purchase raw materials from suppliers. When a
delivery reaches the company, the Receiving team records the delivery
details and uploads the supplier's Certificate of Analysis (COA). The
Quality team then inspects the material against its defined
specifications and records the inspection results.

The system maintains a traceable record of:
- Suppliers and materials
- Purchase orders and ordered quantities
- Goods receipts and delivered lots
- Supplier COA documents
- Quality inspection results and decisions
- Inventory movements and material consumption
- User activities and audit history
Main business rule
Received quantity is not the same as available quantity.

For example, if a supplier delivers 1,040 kg of steel:
1. Receiving records 1,040 kg against the purchase order.
2. The system creates a lot with QUARANTINED status.
3. The Quality team inspects the lot and may approve 840 kg and reject
   200 kg.
4. Only 840 kg becomes available for production.
5. If a worker consumes 100 kg, the available quantity becomes 740 kg.
Rejected and quarantined quantities must never be treated as consumable
inventory.
2. Objectives
- Digitize raw-material receiving and quality-control activities.
- Maintain traceability from purchase order to received lot.
- Store supplier COA documents against the relevant lot.
- Compare delivery quantity with the purchase-order quantity.
- Apply a configurable business tolerance; the current project rule is
  ±5%.
- Record material test results against specification limits.
- Support full approval, partial approval, and rejection.
- Prevent production users from consuming unapproved material.
- Maintain inventory transaction and audit records.
3. Technology Stack
  Layer                Technology
  Frontend             HTML, CSS, JavaScript
Backend              Node.js, Express.js
Database             MySQL
Database driver      mysql2
Authentication       JSON Web Token (JWT)
Password security    bcryptjs
File upload          Multer
API testing          Postman
Development server   Nodemon
4. User Roles
The application is designed around role-based access.

  Role          Responsibility
  ADMIN       Administrative access and overall system management
PURCHASE    Supplier and purchase-order activities
RECEIVING   Recording deliveries and uploading COA documents
QUALITY     Inspecting received lots and recording quality decisions
WORKER      Using only quality-approved inventory

The backend uses authentication and role authorization middleware.
Frontend navigation or hidden buttons alone are not considered security
controls.




Supplier
   |
   v
Purchase Order Created
   |
   v
Truck / Material Delivery
   |
   v
Goods Receipt Recorded
   |
   +---- Supplier COA PDF uploaded
   |
   v
Material Lot Created
   |
   v
QUARANTINED
   |
   v
Quality Inspection
   |
   +-------------------+----------------------+
   |                   |                      |
   v                   v                      v
APPROVED        PARTIALLY_APPROVED          REJECTED
   |                   |                      |
   v                   v                      v
Approved qty       Approved qty          Not available
available          available              for production
   |                   |
   +---------+---------+
             |
             v
      Worker Consumption
             |
             v
      Inventory Updated






6. Database Design
The project uses the following 13 MySQL tables.
                       No. Table                       Purpose

                         1 `users`                     User accounts,
                                                       password hashes, and
                                                       roles

                         2 `suppliers`                 Supplier contact and
                                                       address information

                         3 `materials`                 Raw-material master
                                                       data

                         4 `material_specifications`   Quality parameters
                                                       and permitted min/max
                                                       values

                         5 `purchase_orders`           Purchase-order header
                                                       information

                         6 `purchase_order_items`      Materials and
                                                       quantities in each
                                                       purchase order

                         7 `goods_receipts`            Delivery/receipt
                                                       header information

                         8 `material_lots`             Individual received
                                                       lots and their
                                                       quantity/status

                         9 `coa_documents`             Uploaded supplier COA
                                                       file metadata and
                                                       path

                        10 `quality_inspections`       Inspection decision
                                                       and accepted/rejected
                                                       quantities

                        11 `quality_test_results`      Actual test values
                                                       and PASS/FAIL results

                        12 `inventory_transactions`    Received, approved,
                                                       rejected, consumed,
                                                       and adjustment
                                                       movements

                        13 `audit_logs`                User actions and
                                                       traceability history

Important database concepts
- Foreign keys connect suppliers, materials, purchase orders,
  receipts, lots, inspections, and users.
- Quantity and price fields should use MySQL DECIMAL types to avoid
  floating-point rounding errors.
- A purchase order can contain multiple items.
- A purchase order can have multiple goods receipts.
- Each received lot is linked to its receipt and purchase-order item.
- COA files are stored in the backend uploads directory; the database
  stores their metadata and file path.
- Inventory changes should be performed inside database transactions.