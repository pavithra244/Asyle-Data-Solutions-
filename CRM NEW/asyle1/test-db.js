const pool = require('./database-mysql');

pool.query('SELECT 1', (err, results) => {
    if (err) {
        console.error('❌ DB connection failed:', err.message);
    } else {
        console.log('✅ DB connected successfully');
    }
    process.exit();
});
