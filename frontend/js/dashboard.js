
const API_URL = "http://localhost:5000/api";

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

if (!token || !user) {
    window.location.href = "login.html";
}

document.getElementById("userName").textContent = user?.name || "";
document.getElementById("userRole").textContent = user?.role || "";

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to verify your session");
        }

        const profile = await response.json();

        document.getElementById("userName").textContent = profile.name;
        document.getElementById("userRole").textContent = profile.role;

    } catch (error) {
        console.error(error);
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

loadDashboard();
