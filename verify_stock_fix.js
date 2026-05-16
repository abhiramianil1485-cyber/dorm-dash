const oracledb = require('oracledb');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER || "system",
    password: process.env.DB_PASSWORD || "ABHI_1485",
    connectString: process.env.DB_CONNECTION_STRING || "localhost:1521/XE"
};

async function testStockValidation() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        console.log("Connected to database.");

        const userId = 999; // Guest user
        // Find ORS Sachet ID
        const result = await connection.execute(
            `SELECT product_id, product_name, quantity_in_stock FROM products WHERE product_name LIKE '%ORS%'`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            console.error("ORS Sachet not found in products table.");
            return;
        }

        const product = result.rows[0];
        console.log(`Testing with product: ${product.PRODUCT_NAME} (ID: ${product.PRODUCT_ID}, Stock: ${product.QUANTITY_IN_STOCK})`);

        // Clear existing cart for this user first
        await connection.execute(
            `DELETE FROM cart_items WHERE cart_id = (SELECT cart_id FROM shopping_cart WHERE user_id = :1)`,
            [userId]
        );
        await connection.commit();

        async function addToCart(qty) {
            const binds = {
                p_user_id: userId,
                p_product_id: product.PRODUCT_ID,
                p_quantity: qty,
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
            const res = await connection.execute(sql, binds);
            return { success: res.outBinds.p_success === 1, message: res.outBinds.p_message };
        }

        console.log("\nAttempt 1: Adding 100 items...");
        let res1 = await addToCart(100);
        console.log(`Result: ${res1.success ? "SUCCESS" : "FAILED"} - ${res1.message}`);

        console.log("\nAttempt 2: Adding another 50 items (Total 150, exceeds stock of 137)...");
        let res2 = await addToCart(50);
        console.log(`Result: ${res2.success ? "SUCCESS" : "FAILED"} - ${res2.message}`);

        if (!res2.success && res2.message.includes("Insufficient stock")) {
            console.log("\n✅ VERIFICATION SUCCESS: Database correctly rejected cumulative quantity exceeding stock.");
        } else if (res2.success) {
            console.log("\n❌ VERIFICATION FAILED: Database allowed cumulative quantity to exceed stock!");
        }

    } catch (err) {
        console.error("Test Error:", err);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

testStockValidation();
