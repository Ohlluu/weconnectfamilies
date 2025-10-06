const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://mongodb0987_db_user:6YRu32t6adCalF52@cluster0.whrxemg.mongodb.net/weconnectfamilies?retryWrites=true&w=majority';

async function test() {
  try {
    console.log('Testing MongoDB connection...');
    const client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connected!');
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
