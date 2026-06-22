require('dotenv').config();

// ========================================
// ENV VALIDATION
// ========================================
const REQUIRED_ENV = ['SESSION_SECRET', 'ADMIN_EMAIL', 'BASE_URL'];
REQUIRED_ENV.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ Missing required env variable: ${key}`);
        process.exit(1);
    }
});

const express = require('express');
const app = express();
// SECURITY FIX: Disable X-Powered-By header to hide Express identity
app.disable('x-powered-by');
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const transporter = require('./utils/mailer');
const db = require('./database-mysql');
const { getChatbotReply, clearHistory } = require('./utils/chatbot');

// ========================================
// UPLOAD DIRECTORY
// ========================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ========================================
// FILE UPLOAD CONFIG (MULTER)
// ========================================
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Chat Uploads Config
const chatUploadDir = path.join(__dirname, 'uploads/chat');
if (!fs.existsSync(chatUploadDir)) {
    fs.mkdirSync(chatUploadDir, { recursive: true });
}

const chatStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, chatUploadDir),
    filename: (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const fileFilter = (_req, file, cb) => {
    const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only images, PDF, DOCX, TXT allowed.'), false);
};

const uploadChat = multer({
    storage: chatStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter
});

// ========================================
// CRON JOB (Auto Delete Old Messages)
// ========================================
cron.schedule('0 0 * * *', () => {
    if (process.env.NODE_ENV !== 'production') console.log('Running auto-delete task...');
    db.query('DELETE FROM messages WHERE created_at < NOW() - INTERVAL 30 DAY', (err, result) => {
        if (err) console.error("Auto-delete failed:", err);
        else if (process.env.NODE_ENV !== 'production') console.log(`Deleted ${result.affectedRows} old messages.`);
    });
});

// BUG FIX: Clean up rateLimitMap periodically to prevent memory leak
cron.schedule('*/30 * * * *', () => {
    const cutoff = Date.now() - 60 * 1000; // remove entries older than 1 minute
    for (const [key, val] of rateLimitMap.entries()) {
        if (val < cutoff) rateLimitMap.delete(key);
    }
});

// ========================================
// MIDDLEWARE
// ========================================
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========================================
// SESSION
// ========================================
const sessionMiddleware = session({
    name: 'asyle.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
});

app.use(sessionMiddleware);

// Share session with Socket.io
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// INITIALIZE GUEST SESSION
app.use((req, res, next) => {
    if (!req.session.user && !req.session.guestId) {
        // Create a negative ID for guests to avoid collision with real users (positive IDs)
        // Using a timestamp + random component ensuring it is negative and fits in INT
        req.session.guestId = -Math.floor(Date.now() / 1000 + Math.random() * 10000);
    }
    next();
});

// ========================================
// RATE LIMITING
// ========================================
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(generalLimiter);

// ========================================
// GLOBAL USER FOR EJS
// ========================================
app.use((req, res, next) => {
    if (req.session.user) {
        res.locals.user = {
            id: req.session.user.id,
            username: req.session.user.username,
            role: req.session.user.role,
            status: req.session.user.status
        };
    } else {
        res.locals.user = null;
        // Expose guest ID to EJS (optional, but helpful for debugging/logic)
        res.locals.guestId = req.session.guestId;
    }
    next();
});

// ========================================
// AUTH MIDDLEWARE
// ========================================
function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.status(403).render('error', { message: 'Access Denied: Admin only' });
}

function isApproved(req, res, next) {
    if (req.session.user && req.session.user.status === 'approved') return next();
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.render('pending_approval', { user: req.session.user });
}

// ========================================
// MAIN ROUTES
// ========================================
app.get('/', (_req, res) => res.render('index', { page: 'home' }));
app.get('/about', (_req, res) => res.render('about', { page: 'about' }));
app.get('/services', (_req, res) => res.render('services', { page: 'services' }));
app.get('/contact', (req, res) => {
    res.render('contact', { success: req.query.success, page: 'contact' });
});

// Service Pages
app.get('/phd-content-writing', (_req, res) => res.render('phd-content-writing'));
app.get('/article-publication', (_req, res) => res.render('article-publication'));
app.get('/book-publication', (_req, res) => res.render('book-publication'));
app.get('/data-analytics', (_req, res) => res.render('data-analytics'));
app.get('/data-collection', (_req, res) => res.render('data-collection'));
app.get('/case-studies', (_req, res) => res.render('case-studies'));
app.get('/tools', (_req, res) => res.render('tools'));
app.get('/project', (_req, res) => res.render('project'));
app.get('/research-consultancy', (_req, res) => res.render('research-consultancy'));
app.get('/journal-submission', (_req, res) => res.render('journal-submission'));

// Legacy redirects
app.get('/content-writing', (_req, res) => res.redirect('/phd-content-writing'));
app.get('/data-analytics-solutions', (_req, res) => res.redirect('/data-analytics'));
app.get('/data-collection-services', (_req, res) => res.redirect('/data-collection'));

// ========================================
// PROTECTED FILE SERVING
// ========================================
app.get('/secure/file/:filename', isAuthenticated, (req, res) => {
    // BUG FIX: Use path.basename() to strip any directory components
    const filename = path.basename(req.params.filename);
    const filePath = path.join(__dirname, 'uploads', filename);

    // Prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'uploads'))) {
        return res.status(403).send('Access denied');
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
});

app.get('/secure/chat/:filename', isAuthenticated, (req, res) => {
    // BUG FIX: Use path.basename() to strip any directory components
    const filename = path.basename(req.params.filename);
    const filePath = path.join(__dirname, 'uploads/chat', filename);

    // Prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'uploads', 'chat'))) {
        return res.status(403).send('Access denied');
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
});

// ========================================
// AUTH ROUTES
// ========================================
app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('login', { error: null });
});

app.post('/login', strictLimiter, (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.render('login', { error: 'Please provide email and password' });

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            if (req.xhr || req.headers.accept.includes('application/json')) return res.status(500).json({ error: 'Database error' });
            return res.render('login', { error: 'Database error' });
        }
        if (results.length === 0) {
            if (req.xhr || req.headers.accept.includes('application/json')) return res.status(401).json({ error: 'Invalid email or password' });
            return res.render('login', { error: 'Invalid email or password' });
        }

        const user = results[0];
        if (!bcrypt.compareSync(password, user.password)) {
            if (req.xhr || req.headers.accept.includes('application/json')) return res.status(401).json({ error: 'Invalid email or password' });
            return res.render('login', { error: 'Invalid email or password' });
        }

        if (user.status === 'denied') {
            if (req.xhr || req.headers.accept.includes('application/json')) return res.status(403).json({ error: 'Your account has been denied. Contact admin.' });
            return res.render('login', { error: 'Your account has been denied. Contact admin.' });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.status
        };

        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/dashboard');
        }
    });
});

app.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('register', { error: null });
});

app.post('/register', strictLimiter, (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
        return res.render('register', { error: 'All fields are required' });
    if (password.length < 6)
        return res.render('register', { error: 'Password must be at least 6 characters' });

    const hash = bcrypt.hashSync(password, 10);

    db.query(
        'INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
        [username, email, hash, 'customer', 'pending'],
        (err) => {
            if (err) {
                if (req.xhr || req.headers.accept.includes('application/json')) return res.status(400).json({ error: 'Email already exists' });
                return res.render('register', { error: 'Email already exists' });
            }

            const mailOptions = {
                from: process.env.ADMIN_EMAIL,
                to: email,
                subject: 'Welcome to Asyle Data Solutions',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Welcome to Asyle!</h2>
                        <p>Hi ${username},</p>
                        <p>Thank you for registering. Your account is currently <strong>Pending Approval</strong>.</p>
                        <p>You will receive another email once an admin reviews and approves your account.</p>
                        <br>
                        <p>Best Regards,<br>Asyle Team</p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (err) => {
                if (err && process.env.NODE_ENV !== 'production') console.error("Welcome Email Error:", err);
            });

            res.redirect('/login');
        }
    );
});

app.get('/logout', (req, res) => {
    const userId = req.session?.user?.id;
    if (userId) clearHistory(String(userId));

    req.session.destroy(() => {
        res.clearCookie('asyle.sid');
        res.redirect('/');
    });
});

// ========================================
// CUSTOMER DASHBOARD
// ========================================
app.get('/dashboard', isAuthenticated, isApproved, (req, res) => {
    const userId = req.session.user.id;
    const query = `
        SELECT p.*,
            COALESCE(perm.can_download, 0) as user_permission,
            (CASE
                WHEN p.is_downloadable = 1 THEN 1
                WHEN perm.can_download = 1 AND perm.user_id = ? THEN 1
                ELSE 0
            END) as can_download
        FROM publications p
        LEFT JOIN permissions perm ON p.id = perm.publication_id
        ORDER BY p.created_at DESC
    `;

    db.query(query, [userId], (err, rows) => {
        if (err) {
            if (process.env.NODE_ENV !== 'production') console.error(err);
            return res.render('dashboard', {
                page: 'dashboard',
                user: req.session.user,
                publications: []
            });
        }
        const sanitizedPubs = rows.map(pub => ({
            id: pub.id,
            title: pub.title,
            description: pub.description,
            file_path: pub.file_path,
            file_type: pub.file_type,
            is_downloadable: pub.is_downloadable,
            can_download: pub.can_download,
            created_at: pub.created_at
        }));
        res.render('dashboard', {
            page: 'dashboard',
            user: req.session.user,
            publications: sanitizedPubs
        });
    });
});

// ========================================
// ADMIN ROUTES
// ========================================
app.get('/admin/dashboard', isAuthenticated, isAdmin, (req, res) => {

    const admin = req.session.user;

    if (!admin) {
        return res.redirect('/login');
    }

    db.query(
        "SELECT COUNT(*) as count FROM users WHERE role='customer'",
        (err, rows) => {

            if (err) return res.status(500).send("Database Error");
            const userCount = rows[0].count || 0;

            db.query(
                "SELECT COUNT(*) as count FROM publications",
                (err2, rows2) => {

                    if (err2) return res.status(500).send("Database Error");
                    const pubCount = rows2[0].count || 0;

                    db.query(
                        "SELECT COUNT(*) as count FROM users WHERE status='pending'",
                        (err3, rows3) => {

                            if (err3) return res.status(500).send("Database Error");
                            const pendingCount = rows3[0].count || 0;

                            db.query(
                                "SELECT * FROM users ORDER BY created_at DESC LIMIT 5",
                                (err4, users) => {

                                    if (err4) return res.status(500).send("Database Error");

                                    const sanitizedUsers = users.map(u => ({
                                        id: u.id,
                                        username: u.username,
                                        email: u.email,
                                        role: u.role,
                                        status: u.status,
                                        created_at: u.created_at
                                    }));

                                    res.render('admin/dashboard', {
                                        admin,
                                        userCount,
                                        pubCount,
                                        pendingCount,
                                        users: sanitizedUsers
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

app.get('/admin/users', isAuthenticated, isAdmin, (req, res) => {
    db.query("SELECT * FROM users ORDER BY created_at DESC", (err, rows) => {
        if (err) return res.status(500).send("Database Error");
        const sanitizedUsers = rows.map(u => ({
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            status: u.status,
            created_at: u.created_at
        }));
        res.render('admin/users', { users: sanitizedUsers, page: 'admin', user: req.session.user });
    });
});

app.post('/admin/users/approve/:id', isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    db.query("SELECT * FROM users WHERE id = ?", [userId], (err, results) => {
        if (err || results.length === 0) return res.redirect('/admin/users');
        const user = results[0];

        db.query("UPDATE users SET status = 'approved' WHERE id = ?", [userId], (err) => {
            if (err && process.env.NODE_ENV !== 'production') console.error(err);

            transporter.sendMail({
                from: process.env.ADMIN_EMAIL,
                to: user.email,
                subject: 'Account Approved - Asyle',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Account Approved!</h2>
                        <p>Hi ${user.username},</p>
                        <p>Good news! Your account has been approved by the administrator.</p>
                        <p>You can now log in and access all features.</p>
                        <a href="${process.env.BASE_URL}/login"
                           style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                            Login Now
                        </a>
                    </div>
                `
            }, (err) => {
                if (err && process.env.NODE_ENV !== 'production') console.error("Approval Mail Failed", err);
            });

            res.redirect('/admin/users');
        });
    });
});

app.post('/admin/users/deny/:id', isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;
    db.query("SELECT * FROM users WHERE id = ?", [userId], (err, results) => {
        if (err || results.length === 0) return res.redirect('/admin/users');
        const user = results[0];

        db.query("UPDATE users SET status = 'denied' WHERE id = ?", [userId], (err) => {
            if (err && process.env.NODE_ENV !== 'production') console.error(err);

            transporter.sendMail({
                from: process.env.ADMIN_EMAIL,
                to: user.email,
                subject: 'Account Status Update - Asyle',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Account Access Denied</h2>
                        <p>Hi ${user.username},</p>
                        <p>Your account request has been reviewed and unfortunately denied at this time.</p>
                        <p>Please contact support if you believe this is an error.</p>
                    </div>
                `
            }, (err) => {
                if (err && process.env.NODE_ENV !== 'production') console.error("Denial Mail Failed", err);
            });

            res.redirect('/admin/users');
        });
    });
});

app.post('/admin/users/delete/:id', isAuthenticated, isAdmin, (req, res) => {
    const userId = req.params.id;

    db.query("DELETE FROM permissions WHERE user_id = ?", [userId], (err) => {
        if (err && process.env.NODE_ENV !== 'production') console.error("Error deleting permissions:", err);

        db.query("DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?", [userId, userId], (err2) => {
            if (err2 && process.env.NODE_ENV !== 'production') console.error("Error deleting messages:", err2);

            db.query("DELETE FROM users WHERE id = ?", [userId], (err3) => {
                if (err3) {
                    if (process.env.NODE_ENV !== 'production') console.error("Error deleting user:", err3);
                    return res.redirect('/admin/users?error=delete_failed');
                }

                res.redirect('/admin/users?success=user_deleted');
            });
        });
    });
});

app.get('/admin/publications', isAuthenticated, isAdmin, (req, res) => {
    db.query("SELECT * FROM publications ORDER BY created_at DESC", (err, rows) => {
        if (err) return res.status(500).send("DB Error");
        res.render('admin/publications', {
            page: 'admin',
            user: req.session.user,
            publications: rows
        });
    });
});

app.post('/admin/publications/upload', isAuthenticated, isAdmin, upload.single('file'), (req, res) => {
    const { title, description, is_downloadable } = req.body;
    const file = req.file;
    if (!file) return res.redirect('/admin/publications?error=nofile');

    const downloadValue = is_downloadable ? 1 : 0;
    // BUG FIX: Store only the filename, not the full path with leading slash
    const filePath = '/uploads/' + file.filename;
    const fileType = path.extname(file.originalname).substring(1).toUpperCase();

    db.query(
        'INSERT INTO publications (title, description, file_path, file_type, is_downloadable) VALUES (?, ?, ?, ?, ?)',
        [title, description, filePath, fileType, downloadValue],
        (err) => {
            if (err && process.env.NODE_ENV !== 'production') console.error(err);
            res.redirect('/admin/publications');
        }
    );
});

app.get('/admin/publications/delete/:id', isAuthenticated, isAdmin, (req, res) => {
    const pubId = req.params.id;

    db.query("SELECT file_path FROM publications WHERE id = ?", [pubId], (err, rows) => {
        if (err || rows.length === 0) {
            return res.redirect('/admin/publications?error=notfound');
        }

        // BUG FIX: file_path is stored as '/uploads/filename', so extract just the filename
        // and build the correct absolute path to avoid double-joining __dirname + '/uploads/...'
        const storedPath = rows[0].file_path; // e.g. '/uploads/1234-file.pdf'
        const filename = path.basename(storedPath);
        const filePath = path.join(__dirname, 'uploads', filename);

        db.query("DELETE FROM publications WHERE id = ?", [pubId], (err2) => {
            if (err2) {
                if (process.env.NODE_ENV !== 'production') console.error("Delete publication DB error:", err2);
                return res.redirect('/admin/publications?error=db');
            }

            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr && process.env.NODE_ENV !== 'production') console.warn("File not found on disk:", filePath);
            });

            res.redirect('/admin/publications');
        });
    });
});

// ========================================
// PERMISSIONS ROUTES
// ========================================
app.get('/admin/permissions', isAuthenticated, isAdmin, (_req, res) => {
    res.redirect('/admin/publications');
});

app.get('/admin/permissions/:id', isAuthenticated, isAdmin, (req, res) => {
    const pubId = req.params.id;

    db.query("SELECT * FROM publications WHERE id = ?", [pubId], (err, pubRows) => {
        if (err || pubRows.length === 0) {
            return res.status(404).render('error', { message: 'Publication not found' });
        }

        const publication = pubRows[0];

        db.query(`
            SELECT u.id, u.username, u.email,
                   COALESCE(p.can_download, 0) as can_download
            FROM users u
            LEFT JOIN permissions p ON u.id = p.user_id AND p.publication_id = ?
            WHERE u.role = 'customer'
            ORDER BY u.username ASC
        `, [pubId], (err, userRows) => {
            if (err) {
                if (process.env.NODE_ENV !== 'production') console.error(err);
                return res.status(500).send("Database Error");
            }

            res.render('admin/permissions', {
                page: 'admin',
                user: req.session.user,
                publication: publication,
                users: userRows
            });
        });
    });
});

app.get('/admin/permissions/grant/:pubId/:userId', isAuthenticated, isAdmin, (req, res) => {
    const { pubId, userId } = req.params;

    db.query(
        "INSERT INTO permissions (publication_id, user_id, can_download) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE can_download = 1",
        [pubId, userId],
        (err) => {
            if (err && process.env.NODE_ENV !== 'production') console.error(err);
            res.redirect(`/admin/permissions/${pubId}`);
        }
    );
});

app.get('/admin/permissions/revoke/:pubId/:userId', isAuthenticated, isAdmin, (req, res) => {
    const { pubId, userId } = req.params;

    db.query(
        "UPDATE permissions SET can_download = 0 WHERE publication_id = ? AND user_id = ?",
        [pubId, userId],
        (err) => {
            if (err && process.env.NODE_ENV !== 'production') console.error(err);
            res.redirect(`/admin/permissions/${pubId}`);
        }
    );
});

app.get('/admin/chat', isAuthenticated, isAdmin, (req, res) => {
    db.query("SELECT * FROM users WHERE role='customer'", (err, rows) => {
        if (err) rows = [];
        res.render('admin/chat', { page: 'admin', user: req.session.user, users: rows });
    });
});

// ========================================
// STATS API
// ========================================
app.get('/admin/stats-data', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const userGrowthQuery = `
            SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
            FROM users
            WHERE role='customer' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY month
            ORDER BY month ASC
        `;

        const pubStatsQuery = `
            SELECT file_type, COUNT(*) as count
            FROM publications
            GROUP BY file_type
        `;

        const [userGrowth] = await db.promise().query(userGrowthQuery);
        const [pubStats] = await db.promise().query(pubStatsQuery);

        const pubGrowthQuery = `
            SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
            FROM publications
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY month
            ORDER BY month ASC
        `;
        const [pubGrowth] = await db.promise().query(pubGrowthQuery);

        const msgActivityQuery = `
            SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, COUNT(*) as count
            FROM messages
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY date
            ORDER BY date ASC
        `;
        const [msgActivity] = await db.promise().query(msgActivityQuery);

        res.json({ userGrowth, pubStats, pubGrowth, msgActivity });
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error("Stats Error:", err);
        res.status(500).json({ error: 'DB Error' });
    }
});

app.get('/api/user-stats', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const totalQuery = "SELECT COUNT(*) as count FROM publications";
        const accessibleQuery = `
            SELECT COUNT(*) AS count
            FROM publications p
            LEFT JOIN permissions perm ON p.id = perm.publication_id
            WHERE p.is_downloadable = 1 OR (perm.can_download = 1 AND perm.user_id = ?)
        `;

        const [totalRows] = await db.promise().query(totalQuery);
        const [accessRows] = await db.promise().query(accessibleQuery, [userId]);

        const platformGrowthQuery = `
            SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
            FROM publications
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY month
            ORDER BY month ASC
        `;
        const [platformGrowth] = await db.promise().query(platformGrowthQuery);

        const [sentRows] = await db.promise().query(
            "SELECT COUNT(*) as count FROM messages WHERE sender_role = 'customer' AND sender_id = ?",
            [userId]
        );

        const [receivedRows] = await db.promise().query(
            "SELECT COUNT(*) as count FROM messages WHERE sender_role = 'admin' AND receiver_id = ?",
            [userId]
        );

        res.json({
            total: totalRows[0].count,
            accessible: accessRows[0].count,
            platformGrowth,
            chatStats: {
                sent: sentRows[0].count,
                received: receivedRows[0].count
            }
        });
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.error(err);
        res.status(500).json({ error: 'DB Error' });
    }
});

// ========================================
// CLEAR CHAT
// ========================================
app.put('/chat/clear/:userId', (req, res) => {
    // Allow if user is logged in OR if it's a guest clearing their own chat
    const me = req.session.user;
    const guestId = req.session.guestId;

    if (!me && !guestId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // BUG FIX: Validate and parse userId as integer
    const otherId = parseInt(req.params.userId, 10);
    if (isNaN(otherId)) return res.status(400).json({ success: false, error: 'Invalid userId' });

    let query, params;

    // Admin clearing someone else's chat
    if (me && me.role === 'admin') {
        query = 'UPDATE messages SET deleted_for_admin = 1 WHERE sender_id = ? OR receiver_id = ?';
        params = [otherId, otherId];
    }
    // Customer or Guest clearing their own chat
    else {
        // Verify they are clearing their OWN chat
        const currentId = me ? me.id : guestId;
        if (currentId !== otherId && otherId !== 0) { // 0 is admin, technically they shouldn't be clearing admin's ID here but as a param it represents the CONVERSATION with admin
            // Ideally we just check if they are clearing the conversation identified by the other ID.
            // Admin ID is 0. If I am user 5, I clear chat with 0. 
            // BUT the endpoint is /chat/clear/:userId. 
            // Re-reading logic: The :userId param seems to be "the other person in the chat". Or "the user whose history is being cleared".
        }

        const myId = me ? me.id : guestId;
        query = 'UPDATE messages SET deleted_for_customer = 1 WHERE sender_id = ? OR receiver_id = ?';
        params = [myId, myId];
    }

    db.query(query, params, err => {
        if (err) {
            if (process.env.NODE_ENV !== 'production') console.error('Clear chat error:', err);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true });
    });
});


// ========================================
// CHAT HISTORY
// ========================================
app.get('/chat/history/:userId', (req, res) => {
    // Allow if user is logged in OR if it's a guest fetching their own history
    const me = req.session.user;
    const guestId = req.session.guestId;

    if (!me && !guestId) return res.json([]);

    const otherId = parseInt(req.params.userId, 10);
    if (isNaN(otherId) || otherId <= 0) return res.json([]);

    let query, params;

    if (me.role === 'admin') {
        query = `
            SELECT * FROM messages
            WHERE
                deleted_for_admin = 0
                AND is_deleted = 0
                AND (
                    (sender_id = 0 AND receiver_id = ?)
                    OR
                    (sender_id = ? AND receiver_id = 0)
                )
            ORDER BY created_at ASC
        `;
        params = [otherId, otherId];
    } else {
        const myId = me ? me.id : guestId;
        query = `
            SELECT * FROM messages
            WHERE
                deleted_for_customer = 0
                AND is_deleted = 0
                AND (
                    (sender_id = ?  AND receiver_id = 0)
                    OR
                    (sender_id = 0  AND receiver_id = ?)
                )
            ORDER BY created_at ASC
        `;
        params = [myId, myId];
    }

    db.query(query, params, (err, rows) => {
        if (err) {
            if (process.env.NODE_ENV !== 'production') console.error('Chat history error:', err);
            return res.json([]);
        }
        // BUG FIX: Corrected fromName logic — sender_id === 0 means Admin sent it
        const currentId = me ? me.id : guestId;
        const currentName = me ? me.username : 'Guest';

        const sanitizedMessages = rows.map(msg => ({
            id: msg.id,
            sender_id: msg.sender_id,
            message: msg.message,
            type: msg.type,
            file_name: msg.file_name,
            file_path: msg.file_path,
            created_at: msg.created_at,
            fromName: msg.sender_id === 0
                ? 'Admin'
                : (msg.sender_id === currentId ? currentName : `User_${msg.sender_id}`)
        }));
        res.json(sanitizedMessages);
    });
});

// ========================================
// ADMIN CHAT SEARCH
// ========================================
app.get('/admin/chat/search', isAuthenticated, isAdmin, (req, res) => {
    const { userId, q } = req.query;
    if (!userId || !q) return res.json([]);

    // BUG FIX: Validate userId is an integer
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId) || parsedUserId <= 0) return res.json([]);

    const query = `
        SELECT * FROM messages
        WHERE
            deleted_for_admin = 0
            AND is_deleted = 0
            AND (
                (sender_id = 0 AND receiver_id = ?)
                OR
                (sender_id = ? AND receiver_id = 0)
            )
            AND message LIKE ?
        ORDER BY created_at ASC
    `;

    db.query(query, [parsedUserId, parsedUserId, `%${q}%`], (err, rows) => {
        if (err) {
            if (process.env.NODE_ENV !== 'production') console.error('Search error:', err);
            return res.json([]);
        }
        res.json(rows);
    });
});

// ========================================
// EXPORT CSV (ADMIN)
// ========================================
app.get('/admin/chat/export/:userId/csv', isAuthenticated, isAdmin, (req, res) => {
    // BUG FIX: Validate and parse userId as integer
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId) || userId <= 0) return res.status(400).send('Invalid userId');

    const query = `
        SELECT * FROM messages
        WHERE (
            (sender_id = 0 AND receiver_id = ?) OR
            (sender_id = ? AND receiver_id = 0)
        )
        ORDER BY created_at ASC
    `;

    db.query(query, [userId, userId], (err, rows) => {
        if (err) return res.status(500).send("DB Error");

        const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;

        let csv = "Time,Sender,Role,Message,Type,File\n";

        rows.forEach(m => {
            csv += [
                esc(m.created_at),
                esc(m.sender_id === 0 ? 'Admin' : `User_${m.sender_id}`),
                esc(m.sender_role),
                esc(m.message),
                esc(m.type),
                esc(m.file_name)
            ].join(',') + '\n';
        });

        res.header('Content-Type', 'text/csv');
        res.attachment(`chat_${userId}.csv`);
        res.send(csv);
    });
});

// ========================================
// DELETE SINGLE MESSAGE
// ========================================
// ========================================
// DELETE SINGLE MESSAGE
// ========================================
app.post('/chat/delete', (req, res) => {
    const { messageId, type } = req.body;
    const user = req.session.user;
    const guestId = req.session.guestId;

    if (!user && !guestId) return res.status(401).json({ error: 'Unauthorized' });

    // BUG FIX: Validate messageId is an integer
    const parsedMessageId = parseInt(messageId, 10);
    if (isNaN(parsedMessageId) || parsedMessageId <= 0) return res.status(400).json({ error: 'Invalid messageId' });

    db.query('SELECT * FROM messages WHERE id = ?', [parsedMessageId], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const msg = rows[0];

        if (type === 'everyone') {
            if (user && user.role !== 'admin')
                return res.status(403).json({ error: 'Forbidden' });
            // Guests cannot delete for everyone
            if (!user) return res.status(403).json({ error: 'Forbidden' });

            db.query(
                'UPDATE messages SET is_deleted = 1 WHERE id = ?',
                [parsedMessageId],
                () => {
                    io.to('admin_room').emit('message_deleted', { messageId: parsedMessageId });
                    io.to(`user_${msg.sender_id}`).emit('message_deleted', { messageId: parsedMessageId });
                    res.json({ success: true });
                }
            );
        } else {
            const field = (user && user.role === 'admin')
                ? 'deleted_for_admin'
                : 'deleted_for_customer'; // Guests use this too

            db.query(
                `UPDATE messages SET ${field} = 1 WHERE id = ?`,
                [parsedMessageId],
                () => res.json({ success: true })
            );
        }
    });
});

// ========================================
// CHAT FILE UPLOAD
// ========================================
// ========================================
// CHAT FILE UPLOAD
// ========================================
app.post('/chat/upload', strictLimiter, (req, res) => {
    // Allow guests
    if (!req.session.user && !req.session.guestId) return res.status(401).json({ error: 'Unauthorized' });
    uploadChat.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const allowed = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];
        if (!allowed.includes(file.mimetype)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Invalid file type' });
        }

        const filePath = '/uploads/chat/' + file.filename;
        const isImage = file.mimetype.startsWith('image/');

        res.json({
            success: true,
            filePath: filePath,
            fileName: file.originalname,
            type: isImage ? 'image' : 'file'
        });
    });
});

// ========================================
// SOCKET.IO (CHAT)
// ========================================

// Per-user rate limit map (max 1 message per 500ms)
const rateLimitMap = new Map();

// Tracks how many admin sockets are currently connected
const adminOnlineSockets = new Set();

io.on('connection', (socket) => {
    // Validate session at connection (User OR Guest)
    const session = socket.request.session;
    if (!session || (!session.user && !session.guestId)) {
        return socket.disconnect();
    }

    const user = session.user || {
        id: session.guestId,
        username: 'Guest',
        role: 'customer', // Guests act as customers
        status: 'guest'
    };

    socket.join(`user_${user.id}`);

    if (user.role === 'admin') {
        socket.join('admin_room');
        adminOnlineSockets.add(socket.id);
        io.emit('admin_status', { online: true });
    } else {
        socket.emit('admin_status', { online: adminOnlineSockets.size > 0 });
    }

    socket.on('chat_message', (msg) => {
        // Validate session on every message
        const sess = socket.request.session;
        if (!sess || (!sess.user && !sess.guestId)) {
            return socket.disconnect();
        }

        if (!msg.text && !msg.fileData) return;

        // Throttle — reject if last message was less than 500ms ago
        const now = Date.now();
        const lastSent = rateLimitMap.get(user.id) || 0;
        if (now - lastSent < 500) return;
        rateLimitMap.set(user.id, now);

        // Sanitize message text (limit to 2000 chars)
        const messageText = String(msg.text || '').substring(0, 2000).trim();
        const messageType = msg.type || 'text';

        const filePath = msg.fileData?.filePath || null;
        const fileName = msg.fileData?.fileName || null;
        // BUG FIX: Validate fileSize is a number; don't trust client-supplied value blindly
        const fileSize = (typeof msg.fileData?.fileSize === 'number' && msg.fileData.fileSize > 0)
            ? msg.fileData.fileSize
            : null;

        // ================================
        // CUSTOMER → ADMIN (with AI fallback)
        // ================================
        if (user.role === 'customer') {
            db.query(
                `INSERT INTO messages (
                    sender_id, receiver_id, sender_role, message, type,
                    file_path, file_name, file_size,
                    deleted_for_admin, deleted_for_customer
                )
                VALUES (?, 0, 'customer', ?, ?, ?, ?, ?, 0, 0)`,
                [user.id, messageText, messageType, filePath, fileName, fileSize],
                async (err, result) => {
                    if (err) {
                        if (process.env.NODE_ENV !== 'production') console.error(err);
                        return;
                    }

                    const msgId = result.insertId;

                    io.to('admin_room').emit('receive_message', {
                        id: msgId,
                        from: user.id,
                        fromName: user.username,
                        text: messageText,
                        type: messageType,
                        fileData: msg.fileData ? {
                            filePath: msg.fileData.filePath,
                            fileName: msg.fileData.fileName,
                            type: msg.fileData.type
                        } : null,
                        timestamp: new Date()
                    });

                    // AI FALLBACK: if no admin is online
                    const adminIsOnline = adminOnlineSockets.size > 0;

                    if (!adminIsOnline && messageType === 'text' && messageText) {
                        try {
                            db.query("SELECT title, description FROM publications ORDER BY created_at DESC LIMIT 10", async (pubErr, pubRows) => {
                                let pubContext = "";
                                if (!pubErr && pubRows.length > 0) {
                                    pubContext = "Here are the latest publications available on Asyle Data Solutions:\n" +
                                        pubRows.map(p => `- ${p.title}: ${p.description}`).join('\n');
                                }

                                let aiReply = await getChatbotReply(messageText, String(user.id), pubContext);

                                // DETECT ESCALATION
                                const isEscalation = aiReply.includes('[HUMAN_REQUEST]');
                                if (isEscalation) {
                                    aiReply = aiReply.replace('[HUMAN_REQUEST]', '').trim();

                                    transporter.sendMail({
                                        to: process.env.ADMIN_EMAIL,
                                        subject: '🚨 URGENT: Human Support Requested',
                                        html: `
                                            <h3>Human Support Requested</h3>
                                            <p><b>Customer:</b> ${user.username} (${user.id})</p>
                                            <p><b>Inquiry:</b> ${messageText}</p>
                                            <p><b>AI Status:</b> The AI has confirmed the request and is asking for a live agent to step in.</p>
                                            <hr>
                                            <p><a href="${process.env.BASE_URL}/admin/chat">Click here to respond in the Admin Panel</a></p>
                                        `
                                    }).catch(e => console.error('Escalation email failed:', e));
                                }

                                db.query(
                                    `INSERT INTO messages (
                                        sender_id, receiver_id, sender_role, message, type,
                                        file_path, file_name, file_size,
                                        deleted_for_admin, deleted_for_customer
                                    ) VALUES (0, ?, 'admin', ?, 'text', NULL, NULL, NULL, 0, 0)`,
                                    [user.id, aiReply],
                                    (aiErr, aiResult) => {
                                        if (aiErr) {
                                            if (process.env.NODE_ENV !== 'production') console.error('[AI Save Error]', aiErr);
                                            return;
                                        }

                                        io.to(`user_${user.id}`).emit('receive_message', {
                                            id: aiResult.insertId,
                                            from: 'admin',
                                            fromName: '🤖 Asyle Assistant',
                                            text: aiReply,
                                            type: 'text',
                                            fileData: null,
                                            timestamp: new Date(),
                                            isAI: true
                                        });

                                        io.to('admin_room').emit('receive_message', {
                                            id: aiResult.insertId,
                                            from: 'admin',
                                            fromName: '🤖 Asyle Assistant (AI)',
                                            text: aiReply,
                                            type: 'text',
                                            fileData: null,
                                            timestamp: new Date(),
                                            isAI: true
                                        });
                                    }
                                );
                            });
                        } catch (aiErr) {
                            if (process.env.NODE_ENV !== 'production') console.error('[Chatbot Error]', aiErr);
                        }
                    }

                    // Email notification with cooldown
                    try {
                        const shouldSend = await checkEmailCooldown(user.id);
                        if (shouldSend) {
                            await transporter.sendMail({
                                to: process.env.ADMIN_EMAIL,
                                subject: '📩 New Customer Message',
                                html: `<b>${user.username}</b>: ${messageText}`
                            });
                        }
                    } catch (e) {
                        if (process.env.NODE_ENV !== 'production') console.error('Email error:', e);
                    }
                }
            );
        }

        // ================================
        // ADMIN → CUSTOMER
        // ================================
        if (user.role === 'admin' && msg.toUserId) {
            // Validate toUserId is an integer
            const toUserId = parseInt(msg.toUserId, 10);
            if (isNaN(toUserId) || toUserId <= 0) return;

            db.query(
                `INSERT INTO messages (
                    sender_id, receiver_id, sender_role, message, type,
                    file_path, file_name, file_size,
                    deleted_for_admin, deleted_for_customer
                )
                VALUES (0, ?, 'admin', ?, ?, ?, ?, ?, 0, 0)`,
                [toUserId, messageText, messageType, filePath, fileName, fileSize],
                (err, result) => {
                    if (err) {
                        if (process.env.NODE_ENV !== 'production') console.error(err);
                        return;
                    }

                    const msgId = result.insertId;

                    io.to(`user_${toUserId}`).emit('receive_message', {
                        id: msgId,
                        from: 'admin',
                        fromName: 'Admin',
                        text: messageText,
                        type: messageType,
                        fileData: msg.fileData ? {
                            filePath: msg.fileData.filePath,
                            fileName: msg.fileData.fileName,
                            type: msg.fileData.type
                        } : null,
                        timestamp: new Date()
                    });
                }
            );
        }
    });

    // Typing indicators
    socket.on('typing', (data) => {
        if (user.role === 'customer') {
            socket.to('admin_room').emit('display_typing', {
                from: user.id,
                name: user.username
            });
        } else {
            socket.to(`user_${data.to}`).emit('display_typing', {
                from: 'admin'
            });
        }
    });

    socket.on('stop_typing', (data) => {
        if (user.role === 'customer') {
            socket.to('admin_room').emit('hide_typing', { from: user.id });
        } else {
            socket.to(`user_${data.to}`).emit('hide_typing', { from: 'admin' });
        }
    });

    socket.on('disconnect', () => {
        if (user.role === 'admin') {
            adminOnlineSockets.delete(socket.id);
            if (adminOnlineSockets.size === 0) {
                io.emit('admin_status', { online: false });
            }
        }
    });
});

// ========================================
// HELPER: Email Cooldown
// ========================================
function checkEmailCooldown(userId) {
    return new Promise((resolve) => {
        db.query(
            "SELECT created_at FROM messages WHERE sender_id = ? AND sender_role = 'customer' ORDER BY created_at DESC LIMIT 1 OFFSET 1",
            [userId],
            (err, rows) => {
                if (err) {
                    if (process.env.NODE_ENV !== 'production') console.error("Cooldown Check Error:", err);
                    return resolve(true);
                }
                if (rows.length === 0) return resolve(true);

                const lastTime = new Date(rows[0].created_at).getTime();
                const now = Date.now();
                const diffMins = (now - lastTime) / (1000 * 60);

                resolve(diffMins >= 15);
            }
        );
    });
}

// ========================================
// ERROR HANDLING
// ========================================
app.use((_req, res) => res.status(404).send('Page not found'));

app.use((err, _req, res, _next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal server error');
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 30002;
server.listen(PORT, () => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('='.repeat(50));
        console.log('🚀 Asyle Data Solutions Server');
        console.log(`📍 http://localhost:${PORT}`);
        console.log('='.repeat(50));
    }
    db.query("SELECT * FROM users WHERE role = 'admin'", (err, results) => {
        if (err) {
            console.error("Error checking admin:", err);
            return;
        }

        if (!results || results.length === 0) {
            const hash = bcrypt.hashSync('admin2026', 10);

            db.query(
                "INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)",
                ['Admin', 'admin@asyle.com', hash, 'admin', 'approved'],
                (err) => {
                    if (err) {
                        console.error("Error creating admin:", err);
                    } else {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log("⚠️ Default Admin Created: admin@asyle.com / admin2026");
                        }
                    }
                }
            );
        }
    });
});