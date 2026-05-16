const oracledb = require('oracledb');

const dbConfig = {
    user: "system", 
    password: "ABHI_1485", 
    connectString: "localhost:1521/XEPDB1"
};

async function testConnection() {
    let connection;
    try {
        console.log("Attempting database connection...");
        connection = await oracledb.getConnection(dbConfig);
        console.log("SUCCESS! Connected to Oracle Database.");
        
        // Test querying users table
        const result = await connection.execute(`SELECT * FROM users WHERE ROWNUM <= 1`);
        console.log("Users table exists. Rows:", result.rows.length);

    } catch (err) {
        console.error("CONNECTION ERROR:", err.message);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

testConnection();
