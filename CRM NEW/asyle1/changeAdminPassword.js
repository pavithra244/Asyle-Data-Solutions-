const bcrypt = require("bcrypt");
const mysql = require("mysql2");

// Connect to DB
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "chandru@sql",
    database: "asyle_db"
});

const newPassword = "Admin@2026"; 
const email = "admin@asyle.com";

bcrypt.hash(newPassword, 10, (err, hash) => {
    if (err) {
        console.error("Hash error:", err);
        return;
    }

    db.query(
        "UPDATE users SET password = ? WHERE email = ?",
        [hash, email],
        (err, result) => {
            if (err) {
                console.error("Update error:", err);
            } else {
                console.log("✅ Admin password updated successfully!");
            }
            db.end();
        }
    );
});
