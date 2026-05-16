const oracledb = require('oracledb');

const dbConfig = {
    user: "system", 
    password: "ABHI_1485", 
    connectString: "localhost:1521/XE" 
};

async function syncSequences() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        console.log("Connected to database. Synchronizing sequences...");

        const sync = async (table, idCol, seq) => {
            const maxRes = await connection.execute(`SELECT MAX(${idCol}) FROM ${table}`);
            const maxId = maxRes.rows[0][0] || 0;
            
            const seqRes = await connection.execute(`SELECT ${seq}.NEXTVAL FROM DUAL`);
            const currentVal = seqRes.rows[0][0];

            if (currentVal <= maxId) {
                const diff = (maxId - currentVal) + 1;
                console.log(`Table ${table} (${idCol}): Max=${maxId}, Seq=${currentVal}. Jumping by ${diff}...`);
                
                // Jump the sequence
                await connection.execute(`ALTER SEQUENCE ${seq} INCREMENT BY ${diff}`);
                await connection.execute(`SELECT ${seq}.NEXTVAL FROM DUAL`);
                await connection.execute(`ALTER SEQUENCE ${seq} INCREMENT BY 1`);
                
                console.log(`Sequence ${seq} successfully synchronized.`);
            } else {
                console.log(`Table ${table} (${idCol}) is already synchronized (Max=${maxId}, Seq=${currentVal}).`);
            }
        };

        // Align all sequences
        await sync('USERS', 'USER_ID', 'USER_SEQ');
        await sync('PRODUCTS', 'PRODUCT_ID', 'PRODUCT_SEQ');
        await sync('SHOPPING_CART', 'CART_ID', 'CART_SEQ');
        await sync('CART_ITEMS', 'CART_ITEM_ID', 'CART_ITEM_SEQ');
        await sync('ORDERS', 'ORDER_ID', 'ORDER_SEQ');
        await sync('ORDER_ITEMS', 'ORDER_ITEM_ID', 'ORDER_ITEM_SEQ');

        await connection.commit();
        console.log("SUCCESS: All sequences synchronized and committed.");

    } catch (err) {
        console.error("ERROR during synchronization:", err.message);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

syncSequences();
