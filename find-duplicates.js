const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Product = require('./models/Product');

async function findDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ballon-party');
        console.log('Connected to MongoDB');

        const products = await Product.find({});
        const groups = {};

        products.forEach(p => {
            const name = p.name.trim();
            if (!groups[name]) {
                groups[name] = [];
            }
            groups[name].push({
                id: p._id,
                cities: p.cities,
                cityPrices: p.cityPrices
            });
        });

        console.log('Total unique product names:', Object.keys(groups).length);
        console.log('Total products:', products.length);

        let totalDuplicates = 0;
        for (const name in groups) {
            if (groups[name].length > 1) {
                console.log(`\nName: "${name}"`);
                console.log(`Count: ${groups[name].length}`);
                groups[name].forEach((p, idx) => {
                    console.log(`  ${idx + 1}. ID: ${p.id}, Cities: ${p.cities?.length || 0}, CityPrices: ${p.cityPrices?.length || 0}`);
                });
                totalDuplicates += (groups[name].length - 1);
            }
        }

        console.log('\nTotal redundant products to remove:', totalDuplicates);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findDuplicates();
