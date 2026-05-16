require('dotenv').config();
const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files (HTML, CSS, JS) from the current folder
app.use(express.static(__dirname));

// Redirect the root path to the login page
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

const P_PORT = process.env.PORT || 3000;

// Oracle DB Configuration — loaded from .env (see .env.example)
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECTION_STRING || "localhost:1521/XE"
};

// --- ENDPOINTS ---

// 1. Basic Test / Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    let connection;

    try {
        connection = await oracledb.getConnection(dbConfig);
        
        // Query to check if the user exists
        const result = await connection.execute(
            `SELECT "USER_ID", "USERNAME", "FULL_NAME", "ADDRESS" FROM USERS WHERE "USERNAME" = :1 AND "PASSWORD" = :2`,
            [username, password],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length > 0) {
            res.status(200).json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database Error' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

// 1b. Sign Up (Register New User)
app.post('/api/signup', async (req, res) => {
    const { username, password, full_name, address } = req.body;
    let connection;

    if (!username || !password || !full_name) {
        return res.status(400).json({ success: false, message: 'Username, password, and full name are required.' });
    }

    try {
        connection = await oracledb.getConnection(dbConfig);

        // Check if username already exists
        const existsCheck = await connection.execute(
            `SELECT COUNT(*) AS cnt FROM users WHERE LOWER(username) = LOWER(:1)`,
            [username],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (existsCheck.rows[0].CNT > 0) {
            return res.status(409).json({ success: false, message: 'Username already taken. Try another one.' });
        }

        // Insert new user using user_seq.NEXTVAL from your script
        const addrValue = address || 'Campus';
        const phoneValue = req.body.phone || '';
        const emailValue = req.body.email || '';

        await connection.execute(
            `INSERT INTO USERS (user_id, username, password, email, full_name, address, phone_num) 
             VALUES (USER_SEQ.NEXTVAL, :1, :2, :3, :4, :5, :6)`,
            [username, password, emailValue, full_name, addrValue, phoneValue],
            { autoCommit: true }
        );

        // Fetch the user we just created to get the ID
        const result = await connection.execute(
            `SELECT "USER_ID", "USERNAME", "FULL_NAME", "ADDRESS" FROM USERS WHERE "USERNAME" = :1`,
            [username],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.status(201).json({ success: true, user: result.rows[0], message: 'Account created successfully!' });

    } catch (err) {
        console.error('Signup DB Error:', err);
        res.status(500).json({ success: false, message: 'Signup failed: ' + err.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

// 2. Get Products
app.get('/api/products', async (req, res) => {
    let connection;

    try {
        connection = await oracledb.getConnection(dbConfig);
        
        const result = await connection.execute(
            `SELECT product_id, product_name, description, price, quantity_in_stock, category, image_url FROM products`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.status(200).json({ success: true, products: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database Error fetching products' });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

// 3. Add to Cart (Using PL/SQL Procedure!)
app.post('/api/cart/add', async (req, res) => {
    const { user_id, product_id, quantity } = req.body;
    let connection;

    try {
        connection = await oracledb.getConnection(dbConfig);
        
        // Bind variables map to PL/SQL OUT parameters
        const binds = {
            p_user_id: user_id,
            p_product_id: product_id,
            p_quantity: quantity,
            p_success: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }, 
            p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 }
        };
        const sql = `
            DECLARE
                v_success BOOLEAN;
            BEGIN
                add_to_cart(:p_user_id, :p_product_id, :p_quantity, v_success, :p_message);
                IF v_success THEN :p_success := 1; ELSE :p_success := 0; END IF;
            END;`;
            
        console.log(`Cart: User ${user_id} Adding Product ${product_id} Qty ${quantity}`);
        const result = await connection.execute(sql, binds);
        await connection.commit();
        
        console.log(`Cart Result: Success=${result.outBinds.p_success}, Message=${result.outBinds.p_message}`);

        res.status(200).json({ 
            success: result.outBinds.p_success === 1, 
            message: result.outBinds.p_message 
        });

    } catch (err) {
        console.error('Cart DB Error:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

// 4. Checkout / Process Order (PL/SQL Procedure)
app.post('/api/checkout', async (req, res) => {
    const { user_id } = req.body;
    let connection;

    try {
        connection = await oracledb.getConnection(dbConfig);
        
        const binds = {
            p_user_id: user_id,
            p_success: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }, 
            p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 },
            p_order_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        };

        const sql = `
            DECLARE
                v_success BOOLEAN;
            BEGIN
                process_order(:p_user_id, v_success, :p_message, :p_order_id);
                IF v_success THEN :p_success := 1; ELSE :p_success := 0; END IF;
            END;`;

        console.log(`Checkout: User ${user_id} processing order...`);
        const result = await connection.execute(sql, binds);
        await connection.commit();

        console.log(`Checkout Result: Success=${result.outBinds.p_success}, OrderID=${result.outBinds.p_order_id}, Msg=${result.outBinds.p_message}`);
        
        let finalStatus = 'PENDING';
        let paymentMessage = '';

        // If order was created successfully, simulate payment immediately
        if (result.outBinds.p_success === 1) {
            const paymentBinds = {
                p_order_id: result.outBinds.p_order_id,
                p_success: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 }
            };
            const paymentSql = `
                DECLARE
                    v_success BOOLEAN;
                BEGIN
                    simulate_payment(:p_order_id, v_success, :p_message);
                    IF v_success THEN :p_success := 1; ELSE :p_success := 0; END IF;
                END;`;
            
            console.log(`Payment: Simulating for Order ${result.outBinds.p_order_id}...`);
            const paymentResult = await connection.execute(paymentSql, paymentBinds);
            await connection.commit();
            
            finalStatus = paymentResult.outBinds.p_success === 1 ? 'CONFIRMED' : 'CANCELLED';
            paymentMessage = paymentResult.outBinds.p_message;
        }

        res.status(200).json({ 
            success: result.outBinds.p_success === 1, 
            message: result.outBinds.p_success === 1 ? paymentMessage : result.outBinds.p_message,
            order_id: result.outBinds.p_order_id,
            status: finalStatus
        });

    } catch (err) {
        console.error('Checkout DB Error:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});



// --- Background Task: Advance Order Statuses ---
// Every 1 minute, check for orders and advance their status
// CONFIRMED -> SHIPPED -> DELIVERED
setInterval(async () => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        
        // Find all orders that are CONFIRMED or SHIPPED
        const result = await connection.execute(
            `SELECT order_id, order_status FROM orders WHERE order_status IN ('CONFIRMED', 'SHIPPED')`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        for (const order of result.rows) {
            const nextStatus = order.ORDER_STATUS === 'CONFIRMED' ? 'SHIPPED' : 'DELIVERED';
            console.log(`Auto-Updating Order ${order.ORDER_ID}: ${order.ORDER_STATUS} -> ${nextStatus}`);
            
            await connection.execute(
                `UPDATE orders SET order_status = :1 WHERE order_id = :2`,
                [nextStatus, order.ORDER_ID]
            );
        }
        
        if (result.rows.length > 0) {
            await connection.commit();
        }
    } catch (err) {
        console.error('Background Order Task Error:', err.message);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}, 60000); // Run every 60 seconds

app.listen(P_PORT, () => {
    console.log(`Dorm Dash Oracle Node Server running on http://localhost:${P_PORT}`);
});
