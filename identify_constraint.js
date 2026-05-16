const oracledb = require('oracledb');

const dbConfig = {
    user: "system", 
    password: "ABHI_1485", 
    connectString: "localhost:1521/XE" 
};

async function checkConstraint() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        console.log("Connected to database.");
        
        // Find what SYS_C008480 is across ALL tables
        const result = await connection.execute(
            `SELECT table_name, constraint_name, constraint_type 
             FROM all_constraints 
             WHERE owner = 'SYSTEM' AND constraint_name = 'SYS_C008480'`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        
        if (result.rows.length > 0) {
            console.log("Found constraint details:");
            console.log(JSON.stringify(result.rows[0], null, 2));
            
            // Get columns for this constraint
            const cols = await connection.execute(
                `SELECT column_name FROM all_cons_columns WHERE owner = 'SYSTEM' AND constraint_name = 'SYS_C008480'`,
                [],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            console.log("Columns:", JSON.stringify(cols.rows, null, 2));
        } else {
            console.log("Constraint SYS_C008480 not found in SYSTEM. Checking ALL user constraints...");
            const allRes = await connection.execute(
                `SELECT table_name, constraint_name, constraint_type 
                 FROM user_constraints 
                 WHERE constraint_name LIKE 'SYS_C%'`,
                [],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            console.log("Some candidate system constraints:");
            allRes.rows.slice(0, 20).forEach(row => console.log(`${row.TABLE_NAME}: ${row.CONSTRAINT_NAME}`));
        }

    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

checkConstraint();
