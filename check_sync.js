const oracledb = require('oracledb');

const dbConfig = {
    user: "system", 
    password: "ABHI_1485", 
    connectString: "localhost:1521/XE" 
};

async function checkData() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        console.log("Connected to database.");
        
        const tables = ['ORDERS', 'ORDER_ITEMS', 'CART_ITEMS', 'SHOPPING_CART', 'USERS', 'PRODUCTS'];
        
        for (const table of tables) {
            const countRes = await connection.execute(`SELECT COUNT(*) AS cnt FROM ${table}`);
            const maxIdRes = await connection.execute(`SELECT MAX(${table.slice(0, -1)}_ID) AS max_id FROM ${table}`); // This is a bit hacky for table names
            
            // Fix for tables with different ID names
            let idCol = table.slice(0, -1) + '_ID';
            if (table === 'USERS') idCol = 'USER_ID';
            if (table === 'PRODUCTS') idCol = 'PRODUCT_ID';
            if (table === 'SHOPPING_CART') idCol = 'CART_ID';
            
            const realMaxIdRes = await connection.execute(`SELECT MAX(${idCol}) AS max_id FROM ${table}`);
            
            console.log(`Table ${table}: Count=${countRes.rows[0][0]}, Max ID=${realMaxIdRes.rows[0][0]}`);
        }
        
        const sequences = ['ORDER_SEQ', 'ORDER_ITEM_SEQ', 'CART_ITEM_SEQ', 'CART_SEQ', 'USER_SEQ', 'PRODUCT_SEQ'];
        for (const seq of sequences) {
            try {
                const seqRes = await connection.execute(`SELECT ${seq}.NEXTVAL FROM DUAL`);
                console.log(`Sequence ${seq}: Next value was ${seqRes.rows[0][0]} (and now incremented)`);
            } catch (e) {
                console.log(`Sequence ${seq} error: ${e.message}`);
            }
        }

    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

checkData();
