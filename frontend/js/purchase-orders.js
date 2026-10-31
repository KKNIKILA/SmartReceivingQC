const API_URL = "http://localhost:5000/api";

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user) {
    window.location.href = "../login.html";
}

const supplierSelect = document.getElementById("supplier_id");
const itemsContainer = document.getElementById("itemsContainer");
const poForm = document.getElementById("poForm");
const message = document.getElementById("message");

let materials = [];

function headers() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "red" : "green";
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "../login.html";
}

// Load suppliers into dropdown
async function loadSuppliers() {
    const response = await fetch(`${API_URL}/suppliers`, {
        headers: headers()
    });

    if (response.status === 401) {
        logout();
        return;
    }

    if (!response.ok) {
        throw new Error("Unable to load suppliers");
    }

    const suppliers = await response.json();

    supplierSelect.innerHTML = '<option value="">Select Supplier</option>';

    suppliers.forEach(supplier => {
        const option = document.createElement("option");
        option.value = supplier.supplier_id;
        option.textContent = supplier.supplier_name;
        supplierSelect.appendChild(option);
    });
}

// Load materials into dropdown
async function loadMaterials() {
    const response = await fetch(`${API_URL}/materials`, {
        headers: headers()
    });

    if (!response.ok) {
        throw new Error("Unable to load materials");
    }

    materials = await response.json();
}

// Create one item row
function addItemRow() {
    const row = document.createElement("div");
    row.className = "item-row";

    const materialSelect = document.createElement("select");
    materialSelect.required = true;
    materialSelect.innerHTML = '<option value="">Select Material</option>';

    materials.forEach(material => {
        const option = document.createElement("option");
        option.value = material.material_id;
        option.textContent =
            `${material.material_name} (${material.material_code}) - ${material.unit}`;
        materialSelect.appendChild(option);
    });

    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.placeholder = "Quantity";
    quantityInput.min = "0.001";
    quantityInput.step = "0.001";
    quantityInput.required = true;

    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.placeholder = "Unit Price";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.required = true;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.className = "remove-item";

    removeButton.addEventListener("click", () => {
        row.remove();
    });

    row.append(materialSelect, quantityInput, priceInput, removeButton);
    itemsContainer.appendChild(row);
}

// Load purchase orders
async function loadPurchaseOrders() {
    try {
        const response = await fetch(`${API_URL}/purchase-orders`, {
            headers: headers()
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const orders = await response.json();

        if (!response.ok) {
            throw new Error(orders.message || "Unable to load purchase orders");
        }

        const tableBody = document.getElementById("poTableBody");
        tableBody.innerHTML = "";

        if (orders.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="7">No purchase orders found.</td></tr>';
            return;
        }

        orders.forEach(order => {
            const row = document.createElement("tr");

            const values = [
                order.po_number,
                order.supplier_name,
                formatDate(order.order_date),
                formatDate(order.expected_delivery_date),
                order.item_count,
                order.status
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "-";
                row.appendChild(cell);
            });

            const actionCell = document.createElement("td");
            const viewButton = document.createElement("button");

            viewButton.textContent = "View";
            viewButton.addEventListener("click", () => {
                viewPurchaseOrder(order.po_id);
            });

            actionCell.appendChild(viewButton);
            row.appendChild(actionCell);

            tableBody.appendChild(row);
        });

    } catch (error) {
        showMessage(error.message, true);
    }
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

    return date.toLocaleDateString();
}

// View purchase order details
async function viewPurchaseOrder(id) {
    try {
        const response = await fetch(
            `${API_URL}/purchase-orders/${id}`,
            { headers: headers() }
        );

        const order = await response.json();

        if (!response.ok) {
            throw new Error(order.message || "Unable to load order details");
        }

        const itemDetails = order.items.map(item =>
            `${item.material_name}: ${item.ordered_quantity} ${item.unit} × ${item.unit_price}`
        ).join("\n");

        alert(
            `PO: ${order.po_number}\n` +
            `Supplier: ${order.supplier_name}\n` +
            `Status: ${order.status}\n\n` +
            `Items:\n${itemDetails}`
        );

    } catch (error) {
        showMessage(error.message, true);
    }
}

// Create purchase order
poForm.addEventListener("submit", async event => {
    event.preventDefault();

    const rows = [...itemsContainer.querySelectorAll(".item-row")];

    const items = rows.map(row => {
        const fields = row.querySelectorAll("select, input");

        return {
            material_id: fields[0].value,
            ordered_quantity: fields[1].value,
            unit_price: fields[2].value
        };
    });

    if (items.length === 0) {
        showMessage("Add at least one material.", true);
        return;
    }

    const orderData = {
        supplier_id: supplierSelect.value,
        order_date: document.getElementById("order_date").value,
        expected_delivery_date:
            document.getElementById("expected_delivery_date").value,
        items
    };

    try {
        const response = await fetch(`${API_URL}/purchase-orders`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(orderData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to create purchase order");
        }

        showMessage(
            `${data.message}. PO Number: ${data.po_number}`
        );

        poForm.reset();
        itemsContainer.innerHTML = "";
        addItemRow();

        loadPurchaseOrders();

    } catch (error) {
        showMessage(error.message, true);
    }
});

document.getElementById("addItemButton").addEventListener(
    "click",
    addItemRow
);

// Set today's date as the default order date
document.getElementById("order_date").value =
    new Date().toISOString().split("T")[0];

// Initialize page
async function initializePage() {
    try {
        await Promise.all([loadSuppliers(), loadMaterials()]);
        addItemRow();
        await loadPurchaseOrders();
    } catch (error) {
        showMessage(error.message, true);
    }
}

initializePage();