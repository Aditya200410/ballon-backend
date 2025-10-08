const City = require('../models/City');
const Product = require('../models/Product');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const HeroCarousel = require('../models/heroCarousel');

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

// Get categories for a specific city
exports.getCityCategories = async (req, res) => {
    try {
        const categories = await Category.find({ cities: req.params.id })
            .sort({ sortOrder: 1, name: 1 });
        res.json({ categories });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch city categories' });
    }
};

// Add categories to a city (and automatically add their subcategories)
exports.addCategoriesToCity = async (req, res) => {
    try {
        const { categoryIds } = req.body;
        const cityId = req.params.id;
        
        // Add categories to city
        await Category.updateMany(
            { _id: { $in: categoryIds } },
            { $addToSet: { cities: cityId } }
        );
        
        // Automatically add all subcategories of these categories to the city
        const subcategories = await SubCategory.find({ 
            parentCategory: { $in: categoryIds } 
        });
        
        if (subcategories.length > 0) {
            const subCategoryIds = subcategories.map(sc => sc._id);
            await SubCategory.updateMany(
                { _id: { $in: subCategoryIds } },
                { $addToSet: { cities: cityId } }
            );
        }
        
        res.json({ 
            success: true, 
            message: `Categories added to city (${subcategories.length} subcategories auto-imported)`,
            categoriesAdded: categoryIds.length,
            subCategoriesAdded: subcategories.length
        });
    } catch (err) {
        res.status(400).json({ error: 'Failed to add categories to city' });
    }
};

// Remove categories from a city (and automatically remove their subcategories)
exports.removeCategoriesFromCity = async (req, res) => {
    try {
        const { categoryIds } = req.body;
        const cityId = req.params.id;
        
        // Remove categories from city
        await Category.updateMany(
            { _id: { $in: categoryIds } },
            { $pull: { cities: cityId } }
        );
        
        // Automatically remove all subcategories of these categories from the city
        const subcategories = await SubCategory.find({ 
            parentCategory: { $in: categoryIds } 
        });
        
        if (subcategories.length > 0) {
            const subCategoryIds = subcategories.map(sc => sc._id);
            await SubCategory.updateMany(
                { _id: { $in: subCategoryIds } },
                { $pull: { cities: cityId } }
            );
        }
        
        res.json({ 
            success: true, 
            message: `Categories removed from city (${subcategories.length} subcategories auto-removed)`,
            categoriesRemoved: categoryIds.length,
            subCategoriesRemoved: subcategories.length
        });
    } catch (err) {
        res.status(400).json({ error: 'Failed to remove categories from city' });
    }
};

// Get subcategories for a specific city
exports.getCitySubCategories = async (req, res) => {
    try {
        const subCategories = await SubCategory.find({ cities: req.params.id })
            .populate('parentCategory', 'name')
            .sort({ sortOrder: 1, name: 1 });
        res.json({ subCategories });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch city subcategories' });
    }
};

// Add subcategories to a city
exports.addSubCategoriesToCity = async (req, res) => {
    try {
        const { subCategoryIds } = req.body;
        const cityId = req.params.id;
        
        await SubCategory.updateMany(
            { _id: { $in: subCategoryIds } },
            { $addToSet: { cities: cityId } }
        );
        
        res.json({ success: true, message: 'Subcategories added to city' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to add subcategories to city' });
    }
};

// Remove subcategories from a city
exports.removeSubCategoriesFromCity = async (req, res) => {
    try {
        const { subCategoryIds } = req.body;
        const cityId = req.params.id;
        
        await SubCategory.updateMany(
            { _id: { $in: subCategoryIds } },
            { $pull: { cities: cityId } }
        );
        
        res.json({ success: true, message: 'Subcategories removed from city' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to remove subcategories from city' });
    }
};

// Get hero carousel items for a specific city
exports.getCityCarouselItems = async (req, res) => {
    try {
        const items = await HeroCarousel.find({ cities: req.params.id })
            .sort({ order: 1 });
        res.json({ items });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch city carousel items' });
    }
};

// Add carousel items to a city
exports.addCarouselItemsToCity = async (req, res) => {
    try {
        const { itemIds } = req.body;
        const cityId = req.params.id;
        
        await HeroCarousel.updateMany(
            { _id: { $in: itemIds } },
            { $addToSet: { cities: cityId } }
        );
        
        res.json({ success: true, message: 'Carousel items added to city' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to add carousel items to city' });
    }
};

// Remove carousel items from a city
exports.removeCarouselItemsFromCity = async (req, res) => {
    try {
        const { itemIds } = req.body;
        const cityId = req.params.id;
        
        await HeroCarousel.updateMany(
            { _id: { $in: itemIds } },
            { $pull: { cities: cityId } }
        );
        
        res.json({ success: true, message: 'Carousel items removed from city' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to remove carousel items from city' });
    }
};

// Import all content (products, categories, subcategories, carousel) from another city
exports.importAllFromCity = async (req, res) => {
    try {
        const { sourceCityId } = req.body;
        const targetCityId = req.params.id;
        
        // Get all items from source city
        const [sourceProducts, sourceCategories, sourceSubCategories, sourceCarouselItems] = await Promise.all([
            Product.find({ cities: sourceCityId }),
            Category.find({ cities: sourceCityId }),
            SubCategory.find({ cities: sourceCityId }),
            HeroCarousel.find({ cities: sourceCityId })
        ]);
        
        // Add target city to all items
        await Promise.all([
            Product.updateMany(
                { _id: { $in: sourceProducts.map(p => p._id) } },
                { $addToSet: { cities: targetCityId } }
            ),
            Category.updateMany(
                { _id: { $in: sourceCategories.map(c => c._id) } },
                { $addToSet: { cities: targetCityId } }
            ),
            SubCategory.updateMany(
                { _id: { $in: sourceSubCategories.map(s => s._id) } },
                { $addToSet: { cities: targetCityId } }
            ),
            HeroCarousel.updateMany(
                { _id: { $in: sourceCarouselItems.map(h => h._id) } },
                { $addToSet: { cities: targetCityId } }
            )
        ]);
        
        res.json({ 
            success: true, 
            message: 'Imported all content from source city',
            counts: {
                products: sourceProducts.length,
                categories: sourceCategories.length,
                subCategories: sourceSubCategories.length,
                carouselItems: sourceCarouselItems.length
            }
        });
    } catch (err) {
        res.status(400).json({ error: 'Failed to import all content' });
    }
};
