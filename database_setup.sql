-- ============================================================
-- SHOPPING CART SYSTEM - DDL AND PL/SQL (Dorm Dash)
-- Database Systems Lab Mini Project
-- Created by: Abhirami Anil (240905105)
-- Optimized for Frontend Integration & Data Integrity
-- ============================================================

-- Drop existing objects (for clean setup)
BEGIN
   FOR r IN (SELECT table_name FROM user_tables WHERE table_name IN ('ORDER_ITEMS', 'ORDERS', 'CART_ITEMS', 'SHOPPING_CART', 'PRODUCTS', 'USERS')) LOOP
      EXECUTE IMMEDIATE 'DROP TABLE ' || r.table_name || ' CASCADE CONSTRAINTS';
   END LOOP;
   FOR r IN (SELECT sequence_name FROM user_sequences WHERE sequence_name IN ('USER_SEQ', 'PRODUCT_SEQ', 'CART_SEQ', 'ORDER_SEQ', 'CART_ITEM_SEQ', 'ORDER_ITEM_SEQ')) LOOP
      EXECUTE IMMEDIATE 'DROP SEQUENCE ' || r.sequence_name;
   END LOOP;
EXCEPTION
   WHEN OTHERS THEN NULL;
END;
/

-- ============================================================
-- SEQUENCES (Corrected for uniquely identifying items)
-- ============================================================
CREATE SEQUENCE user_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE product_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE cart_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE order_seq START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE cart_item_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE order_item_seq START WITH 1 INCREMENT BY 1;

-- ============================================================
-- TABLES
-- ============================================================

-- USERS TABLE
CREATE TABLE users (
    user_id NUMBER PRIMARY KEY,
    username VARCHAR2(50) NOT NULL UNIQUE,
    password VARCHAR2(100) NOT NULL,
    email VARCHAR2(100) NOT NULL UNIQUE,
    full_name VARCHAR2(100),
    address VARCHAR2(255),
    phone_num VARCHAR2(15),
    created_date DATE DEFAULT SYSDATE,
    CONSTRAINT chk_email CHECK (email LIKE '%@%.%')
);

-- PRODUCTS TABLE
CREATE TABLE products (
    product_id NUMBER PRIMARY KEY,
    product_name VARCHAR2(100) NOT NULL,
    description VARCHAR2(500),
    price NUMBER(10, 2) NOT NULL,
    quantity_in_stock NUMBER(5) NOT NULL DEFAULT 0,
    category VARCHAR2(50),
    image_url VARCHAR2(500),
    created_date DATE DEFAULT SYSDATE,
    CONSTRAINT chk_price CHECK (price > 0),
    CONSTRAINT chk_quantity CHECK (quantity_in_stock >= 0)
);

-- SHOPPING_CART TABLE
CREATE TABLE shopping_cart (
    cart_id NUMBER PRIMARY KEY,
    user_id NUMBER NOT NULL UNIQUE, -- One cart per user
    created_date DATE DEFAULT SYSDATE,
    modified_date DATE DEFAULT SYSDATE,
    CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- CART_ITEMS TABLE
CREATE TABLE cart_items (
    cart_item_id NUMBER PRIMARY KEY,
    cart_id NUMBER NOT NULL,
    product_id NUMBER NOT NULL,
    quantity NUMBER(5) NOT NULL,
    unit_price NUMBER(10, 2) NOT NULL,
    added_date DATE DEFAULT SYSDATE,
    CONSTRAINT fk_cartitem_cart FOREIGN KEY (cart_id) REFERENCES shopping_cart(cart_id) ON DELETE CASCADE,
    CONSTRAINT fk_cartitem_product FOREIGN KEY (product_id) REFERENCES products(product_id),
    CONSTRAINT chk_cart_qty CHECK (quantity > 0)
);

-- ORDERS TABLE
CREATE TABLE orders (
    order_id NUMBER PRIMARY KEY,
    user_id NUMBER NOT NULL,
    order_date DATE DEFAULT SYSDATE,
    total_amount NUMBER(10, 2),
    order_status VARCHAR2(20) DEFAULT 'PENDING',
    CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT chk_status CHECK (order_status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'))
);

-- ORDER_ITEMS TABLE
CREATE TABLE order_items (
    order_item_id NUMBER PRIMARY KEY,
    order_id NUMBER NOT NULL,
    product_id NUMBER NOT NULL,
    quantity NUMBER(5) NOT NULL,
    unit_price NUMBER(10, 2) NOT NULL,
    subtotal NUMBER(10, 2),
    CONSTRAINT fk_orderitem_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_orderitem_product FOREIGN KEY (product_id) REFERENCES products(product_id),
    CONSTRAINT chk_order_qty CHECK (quantity > 0)
);

-- INDEXES
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_cart_user ON shopping_cart(user_id);
CREATE INDEX idx_cartitem_cart ON cart_items(cart_id);
CREATE INDEX idx_order_user ON orders(user_id);

-- ============================================================
-- PROCEDURES
-- ============================================================

-- 1. CREATE OR GET CART
CREATE OR REPLACE PROCEDURE create_or_get_cart(
    p_user_id IN NUMBER,
    p_cart_id OUT NUMBER
) AS
BEGIN
    SELECT cart_id INTO p_cart_id FROM shopping_cart WHERE user_id = p_user_id;
    UPDATE shopping_cart SET modified_date = SYSDATE WHERE user_id = p_user_id;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        p_cart_id := cart_seq.NEXTVAL;
        INSERT INTO shopping_cart (cart_id, user_id, created_date, modified_date)
        VALUES (p_cart_id, p_user_id, SYSDATE, SYSDATE);
        COMMIT;
END;
/

-- 2. ADD TO CART (Corrected for cumulative quantity vs stock)
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
    
    -- 1. Check current stock and price
    SELECT price, quantity_in_stock INTO v_price, v_stock FROM products WHERE product_id = p_product_id;
    
    -- 2. Check if user already has this item in cart
    BEGIN
        SELECT quantity INTO v_current_qty FROM cart_items 
        WHERE cart_id = v_cart_id AND product_id = p_product_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN v_current_qty := 0;
    END;

    -- 3. Calculate new total quantity
    v_new_qty := v_current_qty + p_quantity;

    -- 4. VALIDATION: Check if new total exceeds stock
    IF v_new_qty > v_stock THEN
        p_success := FALSE;
        p_message := 'Insufficient stock. You have ' || v_current_qty || ' in cart, adding ' || p_quantity || ' exceeds store stock of ' || v_stock || '.';
        RETURN;
    END IF;

    -- 5. Update or Insert
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
/

-- 3. PROCESS ORDER (CHECKOUT)
CREATE OR REPLACE PROCEDURE process_order(
    p_user_id IN NUMBER,
    p_success OUT BOOLEAN,
    p_message OUT VARCHAR2,
    p_order_id OUT NUMBER
) AS
    v_cart_id NUMBER;
    v_total NUMBER;
    v_stock NUMBER;
    CURSOR c_items IS SELECT product_id, quantity, unit_price FROM cart_items WHERE cart_id = v_cart_id;
BEGIN
    create_or_get_cart(p_user_id, v_cart_id);
    
    SELECT NVL(SUM(quantity * unit_price), 0) INTO v_total FROM cart_items WHERE cart_id = v_cart_id;
    
    IF v_total = 0 THEN
        p_success := FALSE;
        p_message := 'Cart is empty';
        RETURN;
    END IF;

    -- Create order record
    p_order_id := order_seq.NEXTVAL;
    INSERT INTO orders (order_id, user_id, order_date, total_amount, order_status)
    VALUES (p_order_id, p_user_id, SYSDATE, v_total, 'PENDING');

    -- Process items with inventory check
    FOR r IN c_items LOOP
        SELECT quantity_in_stock INTO v_stock FROM products WHERE product_id = r.product_id FOR UPDATE;
        
        IF v_stock < r.quantity THEN
            RAISE_APPLICATION_ERROR(-20002, 'Stock depleted for product ' || r.product_id);
        END IF;

        INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, subtotal)
        VALUES (order_item_seq.NEXTVAL, p_order_id, r.product_id, r.quantity, r.unit_price, r.quantity * r.unit_price);
        
        UPDATE products SET quantity_in_stock = quantity_in_stock - r.quantity WHERE product_id = r.product_id;
    END LOOP;

    -- Clear cart
    DELETE FROM cart_items WHERE cart_id = v_cart_id;
    
    p_success := TRUE;
    p_message := 'Order placed successfully! ID: ' || p_order_id;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        p_success := FALSE;
        p_message := 'Checkout Error: ' || SQLERRM;
        ROLLBACK;
END;
/

-- 4. SIMULATE PAYMENT
CREATE OR REPLACE PROCEDURE simulate_payment(
    p_order_id IN NUMBER,
    p_success OUT BOOLEAN,
    p_message OUT VARCHAR2
) AS
BEGIN
    IF DBMS_RANDOM.VALUE(0, 1) < 0.8 THEN
        UPDATE orders SET order_status = 'CONFIRMED' WHERE order_id = p_order_id;
        p_success := TRUE;
        p_message := 'Payment Successful';
    ELSE
        UPDATE orders SET order_status = 'CANCELLED' WHERE order_id = p_order_id;
        p_success := FALSE;
        p_message := 'Payment Declined';
    END IF;
    COMMIT;
END;
/

-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- Users
INSERT INTO users (user_id, username, password, email, full_name, address, phone_num) 
VALUES (user_seq.NEXTVAL, 'abhirami', 'abhi123', 'abhirami@college.edu', 'Abhirami Anil', 'Dorm Block A, 101', '9876543210');
INSERT INTO users (user_id, username, password, email, full_name, address, phone_num) 
VALUES (999, 'guest', 'guestpass', 'guest@dormdash.com', 'Campus Guest', 'Guest Dorm', '0000000000');

-- Products
INSERT INTO products (product_id, product_name, description, price, quantity_in_stock, category, image_url) 
VALUES (product_seq.NEXTVAL, 'Shin Ramyun', 'Spicy midnight fuel for coding sessions.', 150.00, 50, 'Groceries', 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=1080/da/cms-assets/cms/product/rc-upload-1771305481383-4167.png?bg_token=color.background.quaternary');
INSERT INTO products (product_id, product_name, description, price, quantity_in_stock, category, image_url) 
VALUES (product_seq.NEXTVAL, 'Monster Energy', 'For those 3AM cram sessions.', 110.00, 40, 'Groceries', 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=1080/da/cms-assets/cms/product/af106a7b-79bb-461e-b834-99453d3111d0.png?bg_token=color.background.quaternary');
INSERT INTO products (product_id, product_name, description, price, quantity_in_stock, category, image_url) 
VALUES (product_seq.NEXTVAL, 'Crocin Advance', 'Effective pain & fever relief.', 45.00, 80, 'Pharmaceuticals', 'https://rukminim2.flixcart.com/image/480/480/kr58yvk0/allopathy/y/y/w/650-advance-crocin-original-imag5ydyyggm6r2m.jpeg?q=90');
INSERT INTO products (product_id, product_name, description, price, quantity_in_stock, category, image_url) 
VALUES (product_seq.NEXTVAL, 'ORS Sachet', 'Instant rehydration kit.', 20.00, 150, 'Pharmaceuticals', 'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=1080/da/cms-assets/cms/product/f91b13a0-11d8-4b6f-8391-12933bbbcea7.png?bg_token=color.background.quaternary');

COMMIT;


-- ============================================================
-- TRIGGERS
-- ============================================================

-- 1. UPDATE MODIFIED_DATE WHEN CART CHANGES
CREATE OR REPLACE TRIGGER cart_items_update_trig
AFTER INSERT OR UPDATE OR DELETE ON cart_items
FOR EACH ROW
BEGIN
    UPDATE shopping_cart 
    SET modified_date = SYSDATE 
    WHERE cart_id = COALESCE(:NEW.cart_id, :OLD.cart_id);
END;
/

-- 2. PREVENT NEGATIVE INVENTORY
CREATE OR REPLACE TRIGGER prevent_negative_inventory
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
    IF :NEW.quantity_in_stock < 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Quantity cannot be negative');
    END IF;
END;
/

-- VIEW FOR UI
CREATE OR REPLACE VIEW v_cart_details AS
SELECT ci.cart_item_id, p.product_name, ci.quantity, ci.unit_price, (ci.quantity * ci.unit_price) AS subtotal, sc.user_id
FROM cart_items ci
JOIN shopping_cart sc ON ci.cart_id = sc.cart_id
JOIN products p ON ci.product_id = p.product_id;
