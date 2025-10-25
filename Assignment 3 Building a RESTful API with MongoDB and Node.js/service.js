// INET 2005 – Fruits API (Node.js + Express + MongoDB)
// ---------------------------------------------------------------
// Quick start:
//   2) npm install
//   3) node service.js

// --- Import required modules ---
const express = require('express');               // Web framework for Node.js
const { MongoClient, ObjectId } = require('mongodb'); // MongoDB client and ObjectId helper
const cors = require('cors');                     // Enables Cross-Origin Resource Sharing
const morgan = require('morgan');                 // HTTP request logger middleware
require('dotenv').config();                       // Loads environment variables from .env file

// --- Initialize Express app ---
const app = express();
const PORT = process.env.PORT; // Port number from .env file

// --- Middleware setup ---
// These functions run before your routes and help process requests
app.use(cors());              // Allow requests from other origins (e.g., frontend apps)
app.use(express.json());      // Automatically parse incoming JSON payloads
app.use(morgan('dev'));       // Log HTTP requests to the console in 'dev' format

// --- MongoDB connection setup ---
const MONGODB_URI = process.env.MONGODB_URI; // MongoDB connection string
const DB_NAME = process.env.DB_NAME;         // Database name
const COLLECTION = 'fruits';                 // Collection name

let client;           // Will hold the MongoClient instance
let fruitsCollection; // Will hold a reference to the 'fruits' collection

/**
 * Initializes the MongoDB client and connects to the database.
 * This is called once and reused for all requests.
 */
async function initMongo() {
  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      directConnection: true // Helps when connecting to standalone localhost MongoDB
    });
    await client.connect(); // Connect to MongoDB server
    const db = client.db(DB_NAME); // Select the database
    fruitsCollection = db.collection(COLLECTION); // Cache the collection reference
  }
}

// --- Middleware to ensure DB is connected before handling requests ---
app.use(async (req, res, next) => {
  try {
    if (!fruitsCollection) {
      await initMongo(); // Connect to MongoDB if not already connected
    }
    next(); // Proceed to the next middleware or route
  } catch (err) {
    console.error('DB connection error:', err);
    res.status(500).json({
      error: 'Database connection failed',
      details: String(err)
    });
  }
});

// --- Routes ---

/**
 * Health check endpoint.
 * Useful for verifying that the server is running.
 * Accessible via GET /api/health or GET /
 */
app.get(['/api/health', '/'], (req, res) => {
  try {
    res.json({
      status: 'ok',
      time: new Date().toISOString() // Current server time
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: 'Health check failed',
      details: String(err)
    });
  }});

/**
 * Fetch all Fruits from a document in MongoDB.
 */
app.get('/api/fruits', async (req, res) => {
  try {
    // Retrieve all fruits from the collection
    const fruits = await fruitsCollection.find({}).toArray();

    if (!fruits || fruits.length === 0) {
      return res.status(404).json({ error: 'No fruits found' });
    }

    res.json(fruits); // Returns array of fruits
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to fetch fruits',
      details: String(err)
    });
  }
});


/**
 * Fetch a Fruit document by its MongoDB ObjectId.
 * Example: GET /api/fruits/68e3e80c919729b73936ec3a
 */
app.get('/api/fruits/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ObjectId' });
    }

    // Query the database for the Fruit with the given _id
    const doc = await fruitsCollection.findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return res.status(404).json({ error: 'Fruit not found' });
    }

    res.json(doc); // Return the Fruit document
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to fetch Fruit',
      details: String(err)
    });
  }
});

app.post('/api/fruits', async (request, response) => {
  try {
    const newFruit = {
      _id: new ObjectId(),
      name: request.body.name,
      color: request.body.color,
      sweetness: request.body.sweetness,
      available: request.body.available
    };

    if (!newFruit || Object.keys(newFruit).length === 0) {
      return response.status(400).json({ error: 'Fruit data is required' });
    }

    const result = await fruitsCollection.insertOne(newFruit);
    const newId = result.insertedId;

    response.status(201).json({ insertedId: newId });
  } catch (err) {
    console.error(err);
    response.status(500).json({
      error: 'Failed to create new Fruit',
      details: String(err)
    });
  }
});


app.put('/api/fruits/:id', async (request, response) => { 
  try {
    const { id } = request.params;
    const updates = request.body;

    if (!ObjectId.isValid(id)) {
      return response.status(400).json({ error: 'Invalid ObjectId'});
    }

    const result = fruitsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return response.status(404).json({ error: 'Fruit not found' })
    }

    response.json({ updatedCount: result.modifiedCount })

  } catch (err) {
    console.error(err);
    response.status(500).json({ error: 'Failed to update Fruit', details: String(err)})
  }
});

app.delete('/api/fruits/:id', async (request, response) => {
  try {
    const { id } = request.params;

    if (!ObjectId.isValid(id)) {
      return response.status(400).json({ error: 'Invalid ObjectId' });
    }

    const result = await fruitsCollection.deleteOne({ _id: new ObjectId(id) });


    if (result.deletedCount === 0) {
      return response.status(404).json({ error: 'Fruit not found' });
    } 

    let delcount = result.deletedCount;
    response.json({ deletedCount: delcount });

  } catch (err) {
    console.error(err);
    response.status(500).json({ error: 'Failed to delete Fruit', details: String(err)})
  }
})

/**
 * Fetch a Fruit document by name.
 * Example: GET /api/fruits/apple
 */
app.get('/api/fruits/name/:name', async (req, res) => {
  try {
    let { name } = req.params;

    // Validate and sanitize the name
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Fruit name cannot be empty.' });
    }

    name = name.trim();

    // Use case-insensitive search to improve flexibility
    const doc = await fruitsCollection.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });

    if (!doc) {
      return res.status(404).json({ error: `Fruit '${name}' not found.` });
    }

    res.status(200).json(doc);
  } catch (err) {
    console.error('Error fetching fruit:', err);
    res.status(500).json({
      error: 'Failed to fetch fruit from database.',
      details: err.message || String(err)
    });
  }
});


// --- Graceful shutdown handler ---
// Ensures MongoDB connection is closed when the server is stopped
process.on('SIGINT', async () => {
  if (client) await client.close(); // Close MongoDB connection
  process.exit(0); // Exit the Node.js process
});

// --- Start the server ---
app.listen(PORT, () => {
  console.log(`INET 2005 Fruits API listening on http://localhost:${PORT}`);
});