
const API_URL = "http://localhost:5000/api";

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const errorMessage = document.getElementById("errorMessage");
        const loginButton = document.getElementById("loginButton");

        errorMessage.textContent = "";
        loginButton.disabled = true;
        loginButton.textContent = "Signing in...";

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Login failed");
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            window.location.href = "dashboard.html";

        } catch (error) {
            errorMessage.textContent = error.message;
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = "Sign In";
        }
    });
}
