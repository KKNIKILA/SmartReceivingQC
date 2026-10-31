const API_URL = "http://localhost:5000/api/suppliers";

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user) {
    window.location.href = "../login.html";
}

const supplierForm = document.getElementById("supplierForm");
const supplierTableBody = document.getElementById("supplierTableBody");
const message = document.getElementById("message");

let editingSupplierId = null;

function getHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "red" : "green";
}

async function loadSuppliers() {
    try {
        const response = await fetch(API_URL, {
            headers: getHeaders()
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load suppliers");
        }

        const suppliers = await response.json();

        supplierTableBody.innerHTML = "";

        if (suppliers.length === 0) {
            supplierTableBody.innerHTML = `
                <tr>
                    <td colspan="7">No suppliers found.</td>
                </tr>
            `;
            return;
        }

        suppliers.forEach((supplier) => {
            const row = document.createElement("tr");

            const values = [
                supplier.supplier_id,
                supplier.supplier_name,
                supplier.contact_person || "-",
                supplier.email || "-",
                supplier.phone || "-",
                supplier.address || "-"
            ];

            values.forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const actionCell = document.createElement("td");

            if (["ADMIN", "PURCHASE"].includes(user.role)) {
                const editButton = document.createElement("button");
                editButton.textContent = "Edit";
                editButton.className = "action-button edit-button";
                editButton.addEventListener("click", () => {
                    editSupplier(supplier);
                });

                actionCell.appendChild(editButton);
            }

            if (user.role === "ADMIN") {
                const deleteButton = document.createElement("button");
                deleteButton.textContent = "Delete";
                deleteButton.className = "action-button delete-button";
                deleteButton.addEventListener("click", () => {
                    deleteSupplier(supplier.supplier_id);
                });

                actionCell.appendChild(deleteButton);
            }

            row.appendChild(actionCell);
            supplierTableBody.appendChild(row);
        });

    } catch (error) {
        showMessage(error.message, true);
    }
}

supplierForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const supplierData = {
        supplier_name: document.getElementById("supplier_name").value,
        contact_person: document.getElementById("contact_person").value,
        email: document.getElementById("email").value,
        phone: document.getElementById("phone").value,
        address: document.getElementById("address").value
    };

    const isEditing = editingSupplierId !== null;

    const url = isEditing
        ? `${API_URL}/${editingSupplierId}`
        : API_URL;

    const method = isEditing ? "PUT" : "POST";

    try {
        const response = await fetch(url, {
            method,
            headers: getHeaders(),
            body: JSON.stringify(supplierData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Operation failed");
        }

        showMessage(data.message);
        resetForm();
        loadSuppliers();

    } catch (error) {
        showMessage(error.message, true);
    }
});

function editSupplier(supplier) {
    editingSupplierId = supplier.supplier_id;

    document.getElementById("supplier_name").value =
        supplier.supplier_name || "";

    document.getElementById("contact_person").value =
        supplier.contact_person || "";

    document.getElementById("email").value =
        supplier.email || "";

    document.getElementById("phone").value =
        supplier.phone || "";

    document.getElementById("address").value =
        supplier.address || "";

    document.getElementById("formTitle").textContent = "Edit Supplier";
    document.getElementById("submitButton").textContent = "Update Supplier";
    document.getElementById("cancelButton").style.display = "inline-block";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteSupplier(id) {
    if (!confirm("Are you sure you want to delete this supplier?")) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "DELETE",
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to delete supplier");
        }

        showMessage(data.message);
        loadSuppliers();

    } catch (error) {
        showMessage(error.message, true);
    }
}

function resetForm() {
    supplierForm.reset();
    editingSupplierId = null;

    document.getElementById("formTitle").textContent = "Add New Supplier";
    document.getElementById("submitButton").textContent = "Add Supplier";
    document.getElementById("cancelButton").style.display = "none";
}

document.getElementById("cancelButton").addEventListener("click", resetForm);

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "../login.html";
}

loadSuppliers();