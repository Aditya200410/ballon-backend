const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

async function checkInternalDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ballon-party');
        console.log('Connected to MongoDB');

        const products = await Product.find({});
        let internalDupsFixed = 0;

        for (const product of products) {
            let changed = false;

            // Check for duplicate cities
            if (product.cities && product.cities.length > 0) {
                const uniqueCities = [...new Set(product.cities.map(c => c.toString()))];
                if (uniqueCities.length !== product.cities.length) {
                    product.cities = uniqueCities;
                    changed = true;
                }
            }

            // Check for duplicate cityPrices
            if (product.cityPrices && product.cityPrices.length > 0) {
                const seenCities = new Set();
                const uniqueCityPrices = [];
                for (const cp of product.cityPrices) {
                    const cityId = cp.city.toString();
                    if (!seenCities.has(cityId)) {
                        seenCities.add(cityId);
                        uniqueCityPrices.push(cp);
                    } else {
                        changed = true;
                    }
                }
                if (changed) {
                    product.cityPrices = uniqueCityPrices;
                }
            }

            if (changed) {
                await product.save();
                internalDupsFixed++;
            }
        }

        console.log(`Internal duplicates fixed in ${internalDupsFixed} products.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkInternalDuplicates();
