const mysql = require('mysql2');
require('dotenv').config();

// Create a connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'asyle_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

// Initialize Database Schema
const initDb = async () => {
    try {
        // 1. Users Table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'customer') DEFAULT 'customer',
                status ENUM('pending', 'approved', 'denied') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Publications Table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS publications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255),
                description TEXT,
                file_path VARCHAR(255),
                file_type VARCHAR(50),
                is_downloadable BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. User Permissions Table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                publication_id INT,
                can_download BOOLEAN DEFAULT 0,
                UNIQUE(user_id, publication_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(publication_id) REFERENCES publications(id) ON DELETE CASCADE
            )
        `);

        // 4. Downloads Logging Table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS downloads (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                publication_id INT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(publication_id) REFERENCES publications(id) ON DELETE CASCADE
            )
        `);

        // 5. Chat Messages Table (Updated for File Sharing & Deletion)
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id INT NOT NULL,
                receiver_id INT NOT NULL,
                sender_role ENUM('admin', 'customer') NOT NULL, 
                message TEXT,
                type ENUM('text', 'image', 'file') DEFAULT 'text',
                file_path VARCHAR(255),
                file_name VARCHAR(255),
                file_size VARCHAR(50),
                is_deleted BOOLEAN DEFAULT 0,
                deleted_for_sender BOOLEAN DEFAULT 0,
                deleted_for_receiver BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("✅ MySQL Database Initialized Successfully");

    } catch (err) {
        console.error("❌ Database Initialization Error:", err);
    }
};

// Run initialization
initDb();

module.exports = pool;
