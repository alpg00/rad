import snowflake.connector as sf
import os
from dotenv import load_dotenv
from pathlib import Path

def init_db():
    # load environment variables
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(env_path)

    # connect to snowflake
    conn = sf.connect(
        user=os.getenv('SF_USER'),
        password=os.getenv('SF_PASSWORD'),
        account=os.getenv('SF_ACCOUNT'),
        role=os.getenv('SF_ROLE', 'ACCOUNTADMIN'),
        warehouse=os.getenv('SF_WAREHOUSE', 'COMPUTE_WH')
    )

    try:
        cur = conn.cursor()
        
        # read and execute schema
        with open('rad_schema.sql', 'r') as f:
            sql = f.read()
            
        # split and execute statements
        for stmt in sql.split(';'):
            if stmt.strip():
                print(f'Executing: {stmt[:100]}...')
                cur.execute(stmt)
                
        print('Schema initialization completed successfully!')
        
    except Exception as e:
        print(f'Error initializing schema: {str(e)}')
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    init_db()