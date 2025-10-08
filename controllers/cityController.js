const City = require('../models/City');
const Product = require('../models/Product');

exports.getCities = async (req, res) => {
    try {
        const cities = await City.find().sort({ name: 1 });
        
        // Get product count for each city
        const citiesWithCount = await Promise.all(cities.map(async (city) => {
            const productCount = await Product.countDocuments({ cities: city._id });
            return {
                ...city.toObject(),
                productCount
            };
        }));
        
        res.json({ cities: citiesWithCount });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cities' });
    }
};

exports.addCity = async (req, res) => {
    try {
        const { name, state } = req.body;
        const city = new City({ name, state });
        await city.save();
        res.status(201).json({ city });
    } catch (err) {
        res.status(400).json({ error: 'Failed to add city' });
    }
};

exports.deleteCity = async (req, res) => {
    try {
        await City.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: 'Failed to delete city' });
    }
};

exports.updateCity = async (req, res) => {
    try {
        const { name, state } = req.body;
        const city = await City.findByIdAndUpdate(req.params.id, { name, state }, { new: true });
        res.json({ city });
    } catch (err) {
        res.status(400).json({ error: 'Failed to update city' });
    }
};

// Get products for a specific city
exports.getCityProducts = async (req, res) => {
    try {
        const products = await Product.find({ cities: req.params.id })
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .sort({ date: -1 });
        res.json({ products });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch city products' });
    }
};

// Add products to a city
exports.addProductsToCity = async (req, res) => {
    try {
        const { productIds } = req.body;
        const cityId = req.params.id;
        
        // Add city to each product's cities array
        await Product.updateMany(
            { _id: { $in: productIds } },
            { $addToSet: { cities: cityId } }
        );
        
        res.json({ success: true, message: 'Products added to city' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to add products to city' });
    }
};

// Remove products from a city
exports.removeProductsFromCity = async (req, res) => {
    try {
        const { productIds } = req.body;
        const cityId = req.params.id;
        
        // Remove city from each product's cities array
        await Product.updateMany(
            { _id: { $in: productIds } },
            { $pull: { cities: cityId } }
        );
        
        res.json({ success: true, message: 'Products removed from city' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to remove products from city' });
    }
};

// Import products from another city
exports.importProductsFromCity = async (req, res) => {
    try {
        const { sourceCityId } = req.body;
        const targetCityId = req.params.id;
        
        // Get all products from source city
        const sourceProducts = await Product.find({ cities: sourceCityId });
        
        // Add target city to each product's cities array
        const productIds = sourceProducts.map(p => p._id);
        await Product.updateMany(
            { _id: { $in: productIds } },
            { $addToSet: { cities: targetCityId } }
        );
        
        res.json({ 
            success: true, 
            message: `Imported ${productIds.length} products from source city`,
            count: productIds.length 
        });
    } catch (err) {
        res.status(400).json({ error: 'Failed to import products' });
    }
};
