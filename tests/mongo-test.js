require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testMongoConnection() {
    const uri = process.env.MONGODB_URI;
    console.log('Testing connection to:', uri);
    
    const client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully to MongoDB');
        
        const db = client.db('cryptopup');
        const collections = await db.listCollections().toArray();
        console.log('📊 Available collections:', collections.map(c => c.name));
        
        // Test insert
        const testCollection = db.collection('test');
        const result = await testCollection.insertOne({ test: true, date: new Date() });
        console.log('✅ Test document inserted:', result.insertedId);
        
        // Clean up
        await testCollection.deleteOne({ _id: result.insertedId });
        console.log('✅ Test document cleaned up');
        
    } catch (err) {
        console.error('❌ Connection error:', err);
    } finally {
        await client.close();
        console.log('✅ Connection closed');
    }
}

testMongoConnection();
