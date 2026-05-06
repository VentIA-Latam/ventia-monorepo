-- Create messaging database if it doesn't exist
SELECT 'CREATE DATABASE messaging_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'messaging_db')\gexec
