const pool = require('./database-mysql');

(async () => {
    try {
        const [result] = await pool.promise().query("DELETE FROM users");
        console.log(`✅ Deleted ${result.affectedRows} users`);
        process.exit();
    } catch (err) {
        console.error("❌ Delete failed:", err);
        process.exit(1);
    }
})();

