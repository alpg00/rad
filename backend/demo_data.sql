-- Demo Data for RAD Portfolio Management
-- Run this in your Snowflake environment to populate demo custodians

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS RAD_DB.PUBLIC.CLIENTS (
    ID VARCHAR(50) PRIMARY KEY,
    NAME VARCHAR(255) NOT NULL,
    EMAIL VARCHAR(255),
    TYPE VARCHAR(50) DEFAULT 'custodian',
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS RAD_DB.PUBLIC.POSITIONS (
    ID VARCHAR(50) PRIMARY KEY,
    ACCOUNT VARCHAR(255) NOT NULL,
    SYMBOL VARCHAR(20) NOT NULL,
    QTY DECIMAL(18, 4) NOT NULL,
    COST_BASIS DECIMAL(18, 2),
    SOD_PRICE DECIMAL(18, 4),
    LAST_PRICE DECIMAL(18, 4),
    TIMESTAMP TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS RAD_DB.PUBLIC.PRICES (
    SYMBOL VARCHAR(20) PRIMARY KEY,
    P DECIMAL(18, 4) NOT NULL,
    BID DECIMAL(18, 4),
    ASK DECIMAL(18, 4),
    TS TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Insert demo clients
MERGE INTO RAD_DB.PUBLIC.CLIENTS AS target
USING (
    SELECT 'quantum-capital' AS ID, 'Quantum Capital Fund' AS NAME, 'contact@quantum.com' AS EMAIL, 'custodian' AS TYPE
    UNION ALL
    SELECT 'apex-growth', 'Apex Growth Partners', 'info@apex.com', 'custodian'
    UNION ALL
    SELECT 'horizon-ventures', 'Horizon Ventures', 'hello@horizon.com', 'custodian'
) AS source
ON target.ID = source.ID
WHEN NOT MATCHED THEN
    INSERT (ID, NAME, EMAIL, TYPE) VALUES (source.ID, source.NAME, source.EMAIL, source.TYPE);

-- Insert demo positions for Quantum Capital Fund
MERGE INTO RAD_DB.PUBLIC.POSITIONS AS target
USING (
    SELECT 'quantum-aapl' AS ID, 'Quantum Capital Fund' AS ACCOUNT, 'AAPL' AS SYMBOL, 5000 AS QTY, 875000.00 AS COST_BASIS, 175.00 AS SOD_PRICE, 178.50 AS LAST_PRICE
    UNION ALL
    SELECT 'quantum-msft', 'Quantum Capital Fund', 'MSFT', 3500, 1225000.00, 350.00, 365.75
    UNION ALL
    SELECT 'quantum-googl', 'Quantum Capital Fund', 'GOOGL', 2000, 280000.00, 140.00, 145.20
    UNION ALL
    SELECT 'quantum-tsla', 'Quantum Capital Fund', 'TSLA', 1500, 382500.00, 255.00, 268.90
    UNION ALL
    SELECT 'quantum-nvda', 'Quantum Capital Fund', 'NVDA', 2500, 1125000.00, 450.00, 485.30
) AS source
ON target.ID = source.ID
WHEN NOT MATCHED THEN
    INSERT (ID, ACCOUNT, SYMBOL, QTY, COST_BASIS, SOD_PRICE, LAST_PRICE)
    VALUES (source.ID, source.ACCOUNT, source.SYMBOL, source.QTY, source.COST_BASIS, source.SOD_PRICE, source.LAST_PRICE);

-- Insert demo positions for Apex Growth Partners
MERGE INTO RAD_DB.PUBLIC.POSITIONS AS target
USING (
    SELECT 'apex-amzn' AS ID, 'Apex Growth Partners' AS ACCOUNT, 'AMZN' AS SYMBOL, 4000 AS QTY, 640000.00 AS COST_BASIS, 160.00 AS SOD_PRICE, 168.45 AS LAST_PRICE
    UNION ALL
    SELECT 'apex-meta', 'Apex Growth Partners', 'META', 3000, 1350000.00, 450.00, 475.80
    UNION ALL
    SELECT 'apex-nflx', 'Apex Growth Partners', 'NFLX', 1800, 828000.00, 460.00, 485.20
    UNION ALL
    SELECT 'apex-nvda', 'Apex Growth Partners', 'NVDA', 2000, 900000.00, 450.00, 485.30
    UNION ALL
    SELECT 'apex-aapl', 'Apex Growth Partners', 'AAPL', 3000, 525000.00, 175.00, 178.50
) AS source
ON target.ID = source.ID
WHEN NOT MATCHED THEN
    INSERT (ID, ACCOUNT, SYMBOL, QTY, COST_BASIS, SOD_PRICE, LAST_PRICE)
    VALUES (source.ID, source.ACCOUNT, source.SYMBOL, source.QTY, source.COST_BASIS, source.SOD_PRICE, source.LAST_PRICE);

-- Insert demo positions for Horizon Ventures
MERGE INTO RAD_DB.PUBLIC.POSITIONS AS target
USING (
    SELECT 'horizon-tsla' AS ID, 'Horizon Ventures' AS ACCOUNT, 'TSLA' AS SYMBOL, 2500 AS QTY, 637500.00 AS COST_BASIS, 255.00 AS SOD_PRICE, 268.90 AS LAST_PRICE
    UNION ALL
    SELECT 'horizon-googl', 'Horizon Ventures', 'GOOGL', 3500, 490000.00, 140.00, 145.20
    UNION ALL
    SELECT 'horizon-msft', 'Horizon Ventures', 'MSFT', 2800, 980000.00, 350.00, 365.75
    UNION ALL
    SELECT 'horizon-amzn', 'Horizon Ventures', 'AMZN', 3200, 512000.00, 160.00, 168.45
    UNION ALL
    SELECT 'horizon-meta', 'Horizon Ventures', 'META', 1500, 675000.00, 450.00, 475.80
) AS source
ON target.ID = source.ID
WHEN NOT MATCHED THEN
    INSERT (ID, ACCOUNT, SYMBOL, QTY, COST_BASIS, SOD_PRICE, LAST_PRICE)
    VALUES (source.ID, source.ACCOUNT, source.SYMBOL, source.QTY, source.COST_BASIS, source.SOD_PRICE, source.LAST_PRICE);

-- Insert demo market prices
MERGE INTO RAD_DB.PUBLIC.PRICES AS target
USING (
    SELECT 'AAPL' AS SYMBOL, 178.50 AS P, 178.45 AS BID, 178.55 AS ASK
    UNION ALL
    SELECT 'MSFT', 365.75, 365.70, 365.80
    UNION ALL
    SELECT 'GOOGL', 145.20, 145.15, 145.25
    UNION ALL
    SELECT 'TSLA', 268.90, 268.85, 268.95
    UNION ALL
    SELECT 'NVDA', 485.30, 485.25, 485.35
    UNION ALL
    SELECT 'AMZN', 168.45, 168.40, 168.50
    UNION ALL
    SELECT 'META', 475.80, 475.75, 475.85
    UNION ALL
    SELECT 'NFLX', 485.20, 485.15, 485.25
) AS source
ON target.SYMBOL = source.SYMBOL
WHEN NOT MATCHED THEN
    INSERT (SYMBOL, P, BID, ASK) VALUES (source.SYMBOL, source.P, source.BID, source.ASK)
WHEN MATCHED THEN
    UPDATE SET P = source.P, BID = source.BID, ASK = source.ASK, TS = CURRENT_TIMESTAMP();

-- Verify data
SELECT 'Clients' AS Table_Name, COUNT(*) AS Record_Count FROM RAD_DB.PUBLIC.CLIENTS
UNION ALL
SELECT 'Positions', COUNT(*) FROM RAD_DB.PUBLIC.POSITIONS
UNION ALL
SELECT 'Prices', COUNT(*) FROM RAD_DB.PUBLIC.PRICES;
