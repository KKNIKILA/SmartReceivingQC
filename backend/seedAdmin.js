
require("dotenv").config();

const db = require("./config/db");
const bcrypt = require("bcryptjs");

async function createAdmin() {
    try {
        const name = "System Admin";
        const email = "admin@smartqc.com";
        const password = "Admin@123";

        const [existing] = await db.execute(
            "SELECT user_id FROM users WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {
            console.log("Admin account already exists.");
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.execute(
            `INSERT INTO users (name, email, password, role)
             VALUES (?, ?, ?, 'ADMIN')`,
            [name, email, hashedPassword]
        );

        console.log("Admin account created successfully.");

    } catch (error) {
        console.error("Admin creation failed:", error);
    } finally {
        await db.end();
    }
}

createAdmin();
