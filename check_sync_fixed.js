const oracledb = require('oracledb');

const dbConfig = {
    user: "system", 
    password: "ABHI_1485", 
    connectString: "localhost:1521/XE" 
};

async function checkSync() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        console.log("Connected to database.");
        
        const monitor = async (table, idCol, seq) => {
            const maxRes = await connection.execute(`SELECT MAX(${idCol}) FROM ${table}`);
            const maxId = maxRes.rows[0][0] || 0;
            
            // Get current seq value (without incrementing if possible, but NEXTVAL is easier to check)
            // Actually, let's just see what NEXTVAL gives
            const seqRes = await connection.execute(`SELECT ${seq}.NEXTVAL FROM DUAL`);
            const nextVal = seqRes.rows[0][0];
            
            console.log(`${table}: Max ${idCol}=${maxId}, Sequence ${seq}.NEXTVAL=${nextVal}`);
            if (nextVal <= maxId) {
                console.log(`!!! DISCREPANCY DETECTED in ${table} !!!`);
            }
        };

        await monitor('USERS', 'USER_ID', 'USER_SEQ');
        await monitor('PRODUCTS', 'PRODUCT_ID', 'PRODUCT_SEQ');
        await monitor('SHOPPING_CART', 'CART_ID', 'CART_SEQ');
        await monitor('CART_ITEMS', 'CART_ITEM_ID', 'CART_ITEM_SEQ');
        await monitor('ORDERS', 'ORDER_ID', 'ORDER_SEQ');
        await monitor('ORDER_ITEMS', 'ORDER_ITEM_ID', 'ORDER_ITEM_SEQ');

    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

checkSync();
