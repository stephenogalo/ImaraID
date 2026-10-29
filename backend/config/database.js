const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "identity.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS identities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        did TEXT,
        public_key TEXT,
        private_key TEXT
    );

    CREATE TABLE IF NOT EXISTS authentication_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identity_id INTEGER,
        success INTEGER NOT NULL,
        ip_address TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (identity_id) REFERENCES identities(id)
    );
`);

const columns = db.prepare(
    "PRAGMA table_info(identities)"
).all();

const columnNames = columns.map(
    column => column.name
);

if (!columnNames.includes("did")) {
    db.exec(
        "ALTER TABLE identities ADD COLUMN did TEXT"
    );
}

if (!columnNames.includes("public_key")) {
    db.exec(
        "ALTER TABLE identities ADD COLUMN public_key TEXT"
    );
}

if (!columnNames.includes("private_key")) {
    db.exec(
        "ALTER TABLE identities ADD COLUMN private_key TEXT"
    );
}


const eventColumns = db.prepare(
    "PRAGMA table_info(authentication_events)"
).all();
const eventColumnNames = eventColumns.map(column => column.name);

if (!eventColumnNames.includes("event_type")) {
    db.exec("ALTER TABLE authentication_events ADD COLUMN event_type TEXT");
}

db.exec(`
    UPDATE authentication_events
    SET event_type = CASE
        WHEN success = 1 THEN 'VERIFICATION_SUCCEEDED'
        ELSE 'VERIFICATION_FAILED'
    END
    WHERE event_type IS NULL
`);

module.exports = db;
