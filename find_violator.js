const oracledb = require('oracledb');

const dbConfig = {
    user: "system", 
    password: "ABHI_1485", 
    connectString: "localhost:1521/XE" 
};

async function findTheConstraint() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        console.log("Connected to database.");
        
        // Find what table and column this constraint belongs to
        // We look in USER_CONSTRAINTS and join with USER_CONS_COLUMNS
        const sql = `
            SELECT uc.table_name, uc.constraint_name, uc.constraint_type, ucc.column_name
            FROM user_constraints uc
            JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
            WHERE uc.constraint_name = 'SYS_C008480'
            OR uc.table_name IN ('ORDERS', 'ORDER_ITEMS', 'CART_ITEMS', 'SHOPPING_CART', 'USERS', 'PRODUCTS')
        `;
        
        const result = await connection.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        console.log("Found constraints in related tables:");
        result.rows.forEach(row => {
            console.log(`${row.TABLE_NAME}.${row.COLUMN_NAME}: ${row.CONSTRAINT_NAME} (${row.CONSTRAINT_TYPE})`);
            if (row.CONSTRAINT_NAME === 'SYS_C008480') {
                console.log(">>> THIS IS THE VIOLATED CONSTRAINT! <<<");
            }
        });

    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

findTheConstraint();
