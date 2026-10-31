
const API_URL = "http://localhost:5000/api";

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user) {
    window.location.href = "../login.html";
}

const poSelect = document.getElementById("po_id");
const itemsContainer = document.getElementById("itemsContainer");
const receivingForm = document.getElementById("receivingForm");
const message = document.getElementById("message");

let poItems = [];

function authHeaders() {
    return {
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

// Load purchase orders
async function loadPurchaseOrders() {
    const response = await fetch(`${API_URL}/receiving/purchase-orders`, {
        headers: authHeaders()
    });

    if (response.status === 401) {
        logout();
        return;
    }

    const orders = await response.json();

    if (!response.ok) {
        throw new Error(orders.message || "Unable to load purchase orders");
    }

    poSelect.innerHTML = '<option value="">Select Purchase Order</option>';

    orders.forEach(order => {
        const option = document.createElement("option");
        option.value = order.po_id;
        option.textContent = `${order.po_number} - ${order.supplier_name}`;
        poSelect.appendChild(option);
    });
}

// Load the materials in the selected purchase order
async function loadOrderItems(poId) {
    itemsContainer.innerHTML = "Loading materials...";

    const response = await fetch(
        `${API_URL}/receiving/purchase-orders/${poId}/items`,
        { headers: authHeaders() }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Unable to load PO items");
    }

    poItems = data;
    itemsContainer.innerHTML = "";

    if (poItems.length === 0) {
        itemsContainer.textContent = "No materials found in this purchase order.";
        return;
    }

    poItems.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "receipt-item";

        const heading = document.createElement("h4");
        heading.textContent =
            `${item.material_name} (${item.material_code})`;

        const ordered = document.createElement("p");
        ordered.textContent =
            `Ordered: ${item.ordered_quantity} ${item.unit}`;

        const previouslyReceived = document.createElement("p");
        previouslyReceived.textContent =
            `Previously received: ${item.previously_received} ${item.unit}`;

        const remaining = document.createElement("p");
        remaining.textContent =
            `Remaining against order: ${Math.max(
                0,
                Number(item.ordered_quantity) -
                Number(item.previously_received)
            )} ${item.unit}`;

        const lotInput = document.createElement("input");
        lotInput.type = "text";
        lotInput.className = "lot-number";
        lotInput.placeholder = "Supplier Lot Number";
        lotInput.required = true;

        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.className = "received-quantity";
        quantityInput.placeholder = `Received quantity (${item.unit})`;
        quantityInput.min = "0.001";
        quantityInput.step = "0.001";
        quantityInput.required = true;

        const fileLabel = document.createElement("label");
        fileLabel.textContent = "Supplier COA (PDF)";

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.className = "coa-file";
        fileInput.accept = ".pdf,application/pdf";
        fileInput.required = true;

        card.append(
            heading,
            ordered,
            previouslyReceived,
            remaining,
            lotInput,
            quantityInput,
            fileLabel,
            fileInput
        );

        itemsContainer.appendChild(card);
    });
}

// Purchase order selection
poSelect.addEventListener("change", async () => {
    if (!poSelect.value) {
        itemsContainer.textContent = "Select a purchase order first.";
        return;
    }

    try {
        await loadOrderItems(poSelect.value);
    } catch (error) {
        showMessage(error.message, true);
    }
});

// Submit goods receipt
receivingForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (poItems.length === 0) {
        showMessage("Select a purchase order containing materials.", true);
        return;
    }

    const cards = [...itemsContainer.querySelectorAll(".receipt-item")];

    const items = [];
    const formData = new FormData();

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];

        const lotNumber = card.querySelector(".lot-number").value.trim();
        const quantity = card.querySelector(".received-quantity").value;
        const file = card.querySelector(".coa-file").files[0];

        if (!lotNumber || !quantity || !file) {
            showMessage(
                `Complete the lot number, quantity and COA for item ${i + 1}.`,
                true
            );
            return;
        }

        if (file.type !== "application/pdf" ||
            !file.name.toLowerCase().endsWith(".pdf") ||
            file.size > 2 * 1024 * 1024) {
            showMessage(
                `Item ${i + 1}: select a PDF file no larger than 2 MB.`,
                true
            );
            return;
        }

        items.push({
            po_item_id: poItems[i].po_item_id,
            lot_number: lotNumber,
            received_quantity: quantity
        });

        formData.append(`coa_${i}`, file);
    }

    formData.append("po_id", poSelect.value);
    formData.append(
        "received_date",
        document.getElementById("received_date").value
    );
    formData.append(
        "vehicle_number",
        document.getElementById("vehicle_number").value
    );
    formData.append(
        "remarks",
        document.getElementById("remarks").value
    );
    formData.append("items", JSON.stringify(items));

    const submitButton = receivingForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Recording...";

    try {
        const response = await fetch(`${API_URL}/receiving`, {
            method: "POST",
            headers: authHeaders(),
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to record goods receipt");
        }

        showMessage(data.message);

        if (data.discrepancy_found) {
            alert(
                "Warning: Delivery exceeds 105% of the ordered quantity. " +
                "The received lot remains quarantined and requires discrepancy review."
            );
        }

        receivingForm.reset();
        itemsContainer.textContent = "Select a purchase order first.";
        poItems = [];

        await loadPurchaseOrders();
        await loadReceiptHistory();

    } catch (error) {
        showMessage(error.message, true);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Record Goods Receipt";
    }
});

// Load goods receipt history
async function loadReceiptHistory() {
    try {
        const response = await fetch(`${API_URL}/receiving`, {
            headers: authHeaders()
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const receipts = await response.json();

        if (!response.ok) {
            throw new Error(receipts.message || "Unable to load receipt history");
        }

        const tableBody = document.getElementById("receiptTableBody");
        tableBody.innerHTML = "";

        if (receipts.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="7">No goods receipts found.</td></tr>';
            return;
        }

        receipts.forEach(receipt => {
            const row = document.createElement("tr");

            const values = [
                receipt.gr_number,
                receipt.po_number,
                receipt.supplier_name,
                receipt.vehicle_number,
                formatDate(receipt.received_date),
                receipt.lot_count,
                receipt.received_by_name
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "-";
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });

    } catch (error) {
        showMessage(error.message, true);
    }
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? String(value).slice(0, 10)
        : date.toLocaleDateString();
}

// Initialize page
async function initializePage() {
    try {
        document.getElementById("received_date").value =
            new Date().toISOString().split("T")[0];

        await loadPurchaseOrders();
        await loadReceiptHistory();

    } catch (error) {
        showMessage(error.message, true);
    }
}

initializePage();
