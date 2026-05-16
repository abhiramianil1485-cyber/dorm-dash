const oracledb = require('oracledb');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER || "system",
    password: process.env.DB_PASSWORD || "ABHI_1485",
    connectString: process.env.DB_CONNECTION_STRING || "localhost:1521/XE"
};

const procedureSql = `
CREATE OR REPLACE PROCEDURE add_to_cart(
    p_user_id IN NUMBER,
    p_product_id IN NUMBER,
    p_quantity IN NUMBER,
    p_success OUT BOOLEAN,
    p_message OUT VARCHAR2
) AS
    v_cart_id NUMBER;
    v_stock NUMBER;
    v_price NUMBER;
    v_current_qty NUMBER := 0;
    v_new_qty NUMBER;
BEGIN
    create_or_get_cart(p_user_id, v_cart_id);
    
    SELECT price, quantity_in_stock INTO v_price, v_stock FROM products WHERE product_id = p_product_id;
    
    BEGIN
        SELECT quantity INTO v_current_qty FROM cart_items 
        WHERE cart_id = v_cart_id AND product_id = p_product_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN v_current_qty := 0;
    END;

    v_new_qty := v_current_qty + p_quantity;

    IF v_new_qty > v_stock THEN
        p_success := FALSE;
        p_message := 'Insufficient stock. You have ' || v_current_qty || ' in cart, adding ' || p_quantity || ' exceeds store stock of ' || v_stock || '.';
        RETURN;
    END IF;

    IF v_current_qty > 0 THEN
        UPDATE cart_items 
        SET quantity = v_new_qty, added_date = SYSDATE 
        WHERE cart_id = v_cart_id AND product_id = p_product_id;
        p_message := 'Quantity updated in cart';
    ELSE
        INSERT INTO cart_items (cart_item_id, cart_id, product_id, quantity, unit_price)
        VALUES (cart_item_seq.NEXTVAL, v_cart_id, p_product_id, v_new_qty, v_price);
        p_message := 'Item added to cart';
    END IF;
    
    p_success := TRUE;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        p_success := FALSE;
        p_message := 'Error: ' || SQLERRM;
        ROLLBACK;
END;
`;

async function updateProcedure() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        console.log("Connected. Updating procedure...");
        await connection.execute(procedureSql);
        console.log("Procedure 'add_to_cart' updated successfully.");
    } catch (err) {
        console.error("Update Error:", err);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

updateProcedure();
