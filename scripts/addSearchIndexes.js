const mongoose = require('mongoose');
const Product = require('../models/Product');
require('dotenv').config();

// Script to add database indexes for better search performance

async function addSearchIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('Adding indexes for search optimization...');

    // Add text indexes for search fields
    await Product.collection.createIndex(
      { 
        name: 'text', 
        material: 'text', 
        colour: 'text',
        utility: 'text'
      },
      { 
        name: 'product_search_index',
        weights: {
          name: 10,      // Highest priority
          material: 5,
          colour: 3,
          utility: 2
        }
      }
    );

    // Add regular indexes for commonly queried fields
    await Product.collection.createIndex({ category: 1 });
    await Product.collection.createIndex({ subCategory: 1 });
    await Product.collection.createIndex({ price: 1 });
    await Product.collection.createIndex({ date: -1 });
    
    // Compound indexes for filtered searches
    await Product.collection.createIndex({ category: 1, price: 1 });
    await Product.collection.createIndex({ isBestSeller: 1, date: -1 });
    await Product.collection.createIndex({ isFeatured: 1, date: -1 });
    await Product.collection.createIndex({ isMostLoved: 1, date: -1 });

    console.log('✅ Search indexes created successfully!');
    
    // List all indexes
    const indexes = await Product.collection.indexes();
    console.log('\nCurrent indexes:');
    indexes.forEach(index => {
      console.log(`- ${index.name}`);
    });

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

addSearchIndexes();

