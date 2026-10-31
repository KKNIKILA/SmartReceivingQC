const API_URL = "http://localhost:5000/api/materials";

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user) {
    window.location.href = "../login.html";
}

const materialForm = document.getElementById("materialForm");
const materialTableBody = document.getElementById("materialTableBody");

let editingMaterialId = null;
let selectedMaterialId = null;

function getHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
}

function showMessage(elementId, text, isError = false) {
    const element = document.getElementById(elementId);
    element.textContent = text;
    element.style.color = isError ? "red" : "green";
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "../login.html";
}

// Load all materials
async function loadMaterials() {
    try {
        const response = await fetch(API_URL, {
            headers: getHeaders()
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load materials");
        }

        const materials = await response.json();

        materialTableBody.innerHTML = "";

        if (materials.length === 0) {
            materialTableBody.innerHTML = `
                <tr><td colspan="7">No materials found.</td></tr>
            `;
            return;
        }

        materials.forEach((material) => {
            const row = document.createElement("tr");

            const values = [
                material.material_id,
                material.material_name,
                material.material_code,
                material.unit,
                material.description || "-",
                material.specification_count
            ];

            values.forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const actionCell = document.createElement("td");

            const specButton = document.createElement("button");
            specButton.textContent = "Specifications";
            specButton.className = "action-button spec-button";
            specButton.addEventListener("click", () => {
                openSpecifications(material);
            });

            actionCell.appendChild(specButton);

            if (["ADMIN", "PURCHASE"].includes(user.role)) {
                const editButton = document.createElement("button");
                editButton.textContent = "Edit";
                editButton.className = "action-button edit-button";
                editButton.addEventListener("click", () => {
                    editMaterial(material);
                });

                actionCell.appendChild(editButton);
            }

            if (user.role === "ADMIN") {
                const deleteButton = document.createElement("button");
                deleteButton.textContent = "Delete";
                deleteButton.className = "action-button delete-button";
                deleteButton.addEventListener("click", () => {
                    deleteMaterial(material.material_id);
                });

                actionCell.appendChild(deleteButton);
            }

            row.appendChild(actionCell);
            materialTableBody.appendChild(row);
        });

    } catch (error) {
        showMessage("message", error.message, true);
    }
}

// Add or update a material
materialForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const materialData = {
        material_name: document.getElementById("material_name").value,
        material_code: document.getElementById("material_code").value,
        unit: document.getElementById("unit").value,
        description: document.getElementById("description").value
    };

    const isEditing = editingMaterialId !== null;

    try {
        const response = await fetch(
            isEditing ? `${API_URL}/${editingMaterialId}` : API_URL,
            {
                method: isEditing ? "PUT" : "POST",
                headers: getHeaders(),
                body: JSON.stringify(materialData)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Operation failed");
        }

        showMessage("message", data.message);
        resetMaterialForm();
        loadMaterials();

    } catch (error) {
        showMessage("message", error.message, true);
    }
});

// Edit a material
function editMaterial(material) {
    editingMaterialId = material.material_id;

    document.getElementById("material_name").value =
        material.material_name || "";

    document.getElementById("material_code").value =
        material.material_code || "";

    document.getElementById("unit").value =
        material.unit || "";

    document.getElementById("description").value =
        material.description || "";

    document.getElementById("formTitle").textContent = "Edit Material";
    document.getElementById("submitButton").textContent = "Update Material";
    document.getElementById("cancelButton").style.display = "inline-block";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Reset material form
function resetMaterialForm() {
    materialForm.reset();
    editingMaterialId = null;

    document.getElementById("formTitle").textContent = "Add New Material";
    document.getElementById("submitButton").textContent = "Add Material";
    document.getElementById("cancelButton").style.display = "none";
}

document.getElementById("cancelButton").addEventListener(
    "click",
    resetMaterialForm
);

// Delete a material
async function deleteMaterial(id) {
    if (!confirm("Are you sure you want to delete this material?")) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "DELETE",
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to delete material");
        }

        showMessage("message", data.message);
        loadMaterials();

    } catch (error) {
        showMessage("message", error.message, true);
    }
}

// Open specifications for a selected material
async function openSpecifications(material) {
    selectedMaterialId = material.material_id;

    document.getElementById("specificationSection").style.display = "block";
    document.getElementById("specificationTitle").textContent =
        `Quality Specifications - ${material.material_name}`;

    document.getElementById("specificationSection").scrollIntoView({
        behavior: "smooth"
    });

    loadSpecifications();
}

// Load specifications
async function loadSpecifications() {
    try {
        const response = await fetch(
            `${API_URL}/${selectedMaterialId}/specifications`,
            { headers: getHeaders() }
        );

        const specifications = await response.json();

        if (!response.ok) {
            throw new Error(specifications.message || "Unable to load specifications");
        }

        const tableBody = document.getElementById("specificationTableBody");
        tableBody.innerHTML = "";

        if (specifications.length === 0) {
            tableBody.innerHTML = `
                <tr><td colspan="5">No specifications added yet.</td></tr>
            `;
            return;
        }

        specifications.forEach((spec) => {
            const row = document.createElement("tr");

            const values = [
                spec.parameter_name,
                spec.min_value,
                spec.max_value,
                spec.unit
            ];

            values.forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const actionCell = document.createElement("td");

            if (["ADMIN", "QUALITY"].includes(user.role)) {
                const deleteButton = document.createElement("button");
                deleteButton.textContent = "Delete";
                deleteButton.className = "action-button delete-button";
                deleteButton.addEventListener("click", () => {
                    deleteSpecification(spec.specification_id);
                });

                actionCell.appendChild(deleteButton);
            }

            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });

    } catch (error) {
        showMessage("specMessage", error.message, true);
    }
}

// Add specification
document.getElementById("specificationForm").addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        if (!selectedMaterialId) {
            showMessage("specMessage", "Select a material first.", true);
            return;
        }

        const specificationData = {
            parameter_name: document.getElementById("parameter_name").value,
            min_value: document.getElementById("min_value").value,
            max_value: document.getElementById("max_value").value,
            unit: document.getElementById("spec_unit").value
        };

        try {
            const response = await fetch(
                `${API_URL}/${selectedMaterialId}/specifications`,
                {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify(specificationData)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to add specification");
            }

            document.getElementById("specificationForm").reset();

            showMessage("specMessage", data.message);

            loadSpecifications();
            loadMaterials();

        } catch (error) {
            showMessage("specMessage", error.message, true);
        }
    }
);

// Delete specification
async function deleteSpecification(specificationId) {
    if (!confirm("Delete this quality specification?")) {
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/${selectedMaterialId}/specifications/${specificationId}`,
            {
                method: "DELETE",
                headers: getHeaders()
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to delete specification");
        }

        showMessage("specMessage", data.message);

        loadSpecifications();
        loadMaterials();

    } catch (error) {
        showMessage("specMessage", error.message, true);
    }
}

loadMaterials();