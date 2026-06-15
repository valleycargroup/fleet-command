process.env.NODE_ENV = 'test';
// Provide dummy DB config so db.ts doesn't throw on import
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DB_HOST = 'localhost';
