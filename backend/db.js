const neo4j = require('neo4j-driver');
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  ),
  {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 10000,
  }
);

const getSession = () => driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });

const verifyConnection = async () => {
  const session = getSession();
  try {
    await session.run('RETURN 1');
    console.log('✅ Neo4j connected successfully');
  } catch (err) {
    console.error('❌ Neo4j connection failed:', err.message);
    throw err;
  } finally {
    await session.close();
  }
};

module.exports = { driver, getSession, verifyConnection };