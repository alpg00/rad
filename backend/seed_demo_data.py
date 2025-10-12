#!/usr/bin/env python3
"""
Seed demo data into Snowflake for RAD Portfolio Management
Run this script to populate the 3 demo custodians with sample positions
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    import snowflake.connector
except ImportError:
    print("Error: snowflake-connector-python not installed")
    print("Run: pip install snowflake-connector-python")
    sys.exit(1)

def get_snowflake_connection():
    """Create Snowflake connection from environment variables"""
    return snowflake.connector.connect(
        account=os.getenv('SF_ACCOUNT'),
        user=os.getenv('SF_USER'),
        password=os.getenv('SF_PASSWORD'),
        role=os.getenv('SF_ROLE'),
        warehouse=os.getenv('SF_WAREHOUSE'),
        database=os.getenv('SF_DATABASE', 'RAD_DB'),
        schema=os.getenv('SF_SCHEMA', 'PUBLIC')
    )

def seed_demo_data():
    """Seed demo data into Snowflake"""
    print("Connecting to Snowflake...")
    conn = get_snowflake_connection()
    cursor = conn.cursor()
    
    try:
        # Read and execute SQL file
        sql_file = os.path.join(os.path.dirname(__file__), 'demo_data.sql')
        with open(sql_file, 'r') as f:
            sql_content = f.read()
        
        # Split by semicolon and execute each statement
        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip() and not stmt.strip().startswith('--')]
        
        for i, statement in enumerate(statements, 1):
            if statement:
                print(f"\nExecuting statement {i}/{len(statements)}...")
                try:
                    cursor.execute(statement)
                    result = cursor.fetchall()
                    if result:
                        print("Result:")
                        for row in result:
                            print(f"  {row}")
                except Exception as e:
                    print(f"Warning: {e}")
                    continue
        
        print("\n✅ Demo data seeded successfully!")
        print("\nDemo custodians created:")
        print("  1. Quantum Capital Fund - 5 positions")
        print("  2. Apex Growth Partners - 5 positions")
        print("  3. Horizon Ventures - 5 positions")
        print("\nYou can now view these custodians in the Portfolio Manager dashboard.")
        
    except Exception as e:
        print(f"\n❌ Error seeding data: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    seed_demo_data()
