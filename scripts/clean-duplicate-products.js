const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

async function cleanDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ballon-party');
        console.log('Connected to MongoDB');

        const products = await Product.find({});
        const groups = {};

        products.forEach(p => {
            const name = p.name.trim().toLowerCase();
            if (!groups[name]) {
                groups[name] = [];
            }
            groups[name].push(p);
        });

        const toDelete = [];
        let keptCount = 0;

        for (const name in groups) {
            if (groups[name].length > 1) {
                // Sort to keep the "best" record
                // Heuristic: keep the one with the most cityPrices or cities, or the oldest/newest
                // Since user said "will add city and price from new", any record will do, 
                // but let's keep the one that seems most complete.
                groups[name].sort((a, b) => {
                    const scoreA = (a.cityPrices?.length || 0) + (a.cities?.length || 0);
                    const scoreB = (b.cityPrices?.length || 0) + (b.cities?.length || 0);
                    if (scoreB !== scoreA) return scoreB - scoreA;
                    return a.date - b.date; // Keep oldest if scores are equal
                });

                const kept = groups[name][0];
                const duplicates = groups[name].slice(1);

                console.log(`Keeping: "${kept.name}" (${kept._id}) - score: ${(kept.cityPrices?.length || 0) + (kept.cities?.length || 0)}`);
                console.log(`Removing ${duplicates.length} duplicates for "${kept.name}"`);

                duplicates.forEach(d => toDelete.push(d._id));
                keptCount++;
            } else {
                keptCount++;
            }
        }

        console.log('\nSummary:');
        console.log('Total products currently:', products.length);
        console.log('Total unique names (to be kept):', Object.keys(groups).length);
        console.log('Total duplicates to delete:', toDelete.length);

        if (toDelete.length > 0) {
            console.log('Starting deletion...');
            const result = await Product.deleteMany({ _id: { $in: toDelete } });
            console.log(`Successfully deleted ${result.deletedCount} products.`);
        } else {
            console.log('No duplicates found.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error during cleanup:', err);
        process.exit(1);
    }
}

cleanDuplicates();
