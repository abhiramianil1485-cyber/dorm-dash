const oracledb = require('oracledb');

const dbConfig = {
    user: "system", 
    password: "ABHI_1485", 
    connectString: "localhost:1521/XE" 
};

async function checkAllConstraints() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        console.log("Connected to database.");
        
        const sql = `
            SELECT uc.table_name, uc.constraint_name, uc.constraint_type
            FROM user_constraints uc
            WHERE uc.table_name IN ('ORDERS', 'ORDER_ITEMS', 'CART_ITEMS', 'SHOPPING_CART', 'USERS', 'PRODUCTS')
            ORDER BY uc.constraint_name
        `;
        
        const result = await connection.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_ARRAY });
        
        console.log("Found constraints:");
        result.rows.forEach(row => {
            console.log(`${row[0]}: ${row[1]} (${row[2]})`);
        });

    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

checkAllConstraints();
