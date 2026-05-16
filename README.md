# Dorm Dash

> A campus e-commerce web app for dorm essentials — groceries, snacks, and pharmaceuticals, built with Node.js, Express, and Oracle Database.

---

## Table of Contents
- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [PL/SQL Procedures & Triggers](#plsql-procedures--triggers)
- [Author](#author)

---

## About

**Dorm Dash** is a full-stack shopping cart application designed for college students to order dorm essentials online. It was built as a **Database Systems Lab Mini Project** and demonstrates real-world use of Oracle SQL, PL/SQL stored procedures, triggers, and sequences — connected to a modern web frontend via a Node.js REST API.

---

## Features

- **User Authentication** — Sign up and log in with username/password
- **Product Catalog** — Browse items by category (Groceries, Pharmaceuticals, etc.)
- **Shopping Cart** — Add items, update quantities, with live stock validation
- **Checkout & Payment Simulation** — Orders are placed and payment is randomly simulated (80% success rate)
- **Automatic Order Tracking** — A background task advances order status every minute: `CONFIRMED → SHIPPED → DELIVERED`
- **Stock Guard** — PL/SQL procedures prevent overselling; users can't add more than available stock

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | Oracle Database XE (11g/21c) |
| DB Driver | `oracledb` (node-oracledb) |
| ORM / Logic | Raw SQL + PL/SQL Stored Procedures |
| Auth | Basic username/password (session via `localStorage`) |

---

## Project Structure

```
shopping_cart_project/
│
├── server.js               # Express server & all REST API endpoints
├── database_setup.sql      # Full Oracle DB schema, procedures, triggers & seed data
│
├── login.html              # Login & Sign-up page (frontend)
├── shopping_cart_fe.html   # Main shopping cart frontend
│
├── package.json            # Node.js project config & dependencies
├── .env.example            # Environment variable template
├── .gitignore              # Files excluded from git
│
└── (utility scripts)
    ├── test_db.js          # Test Oracle DB connection
    ├── check_sync.js       # Check DB sequence synchronization
    ├── verify_stock_fix.js # Verify stock validation logic
    ├── find_violator.js    # Find constraint-violating records
    ├── apply_fix.js        # Apply data fixes
    └── sync_sequences.js   # Re-sync Oracle sequences
```

---

## Database Schema

```
USERS ──────────────┐
                    │ (1 to many)
SHOPPING_CART ──────┤
      │             │
      │ (1 to many) │
CART_ITEMS          │
      │             │
      │ (many to 1) └──── ORDERS ──── ORDER_ITEMS
PRODUCTS ───────────────────────────────────┘
```

**Key Tables:** `USERS`, `PRODUCTS`, `SHOPPING_CART`, `CART_ITEMS`, `ORDERS`, `ORDER_ITEMS`

---

## Getting Started

### Prerequisites

- **Node.js** (v18+ recommended) — [Download](https://nodejs.org/)
- **Oracle Database XE** — [Download](https://www.oracle.com/database/technologies/xe-downloads.html)
- **Oracle Instant Client** — Required by `node-oracledb`

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/dorm-dash.git
cd dorm-dash
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up the Database

Open **SQL*Plus** (or Oracle SQL Developer) and run:

```sql
@database_setup.sql
```

This will create all tables, sequences, stored procedures, triggers, and insert sample data.

### 4. Configure Environment Variables

Copy the example file and fill in your Oracle credentials:

```bash
copy .env.example .env
```

Edit `.env`:
```env
DB_USER=system
DB_PASSWORD=your_password_here
DB_CONNECTION_STRING=localhost:1521/XE
PORT=3000
```

### 5. Start the Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

The app will be live at **[http://localhost:3000](http://localhost:3000)** and redirect you to the login page.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/login` | Log in with username & password |
| `POST` | `/api/signup` | Register a new user account |
| `GET` | `/api/products` | Fetch all available products |
| `POST` | `/api/cart/add` | Add an item to the shopping cart |
| `POST` | `/api/checkout` | Process order & simulate payment |

---

## ⚙️ PL/SQL Procedures & Triggers

| Name | Type | Description |
|------|------|-------------|
| `create_or_get_cart` | Procedure | Creates a cart for a user if one doesn't exist |
| `add_to_cart` | Procedure | Adds item to cart with cumulative stock validation |
| `process_order` | Procedure | Converts cart to an order with inventory deduction |
| `simulate_payment` | Procedure | Randomly confirms (80%) or cancels (20%) an order |
| `cart_items_update_trig` | Trigger | Updates `modified_date` on shopping cart after changes |
| `prevent_negative_inventory` | Trigger | Blocks any update that would make stock go negative |

---

## Author

**Abhirami Anil ˖ ࣪⭑** 



