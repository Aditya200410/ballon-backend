const City = require('../models/City');
const Product = require('../models/Product');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const HeroCarousel = require('../models/heroCarousel');

exports.getCities = async (req, res) => {
    try {
        // Check if request is from admin (has showAll query param)
        const showAll = req.query.showAll === 'true';

        // For frontend, only show cities where isActive is not explicitly false
        // This handles legacy cities (undefined) and new cities (true)
        // For admin, show all cities
        const query = showAll ? {} : { isActive: { $ne: false } };
        const cities = await City.find(query).sort({ name: 1 });

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
        const { name, state, contactNumber } = req.body;
        const city = new City({ name, state, contactNumber });
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
        const { name, state, isActive, contactNumber } = req.body;
        const updateData = { name, state };
        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }
        if (contactNumber !== undefined) {
            updateData.contactNumber = contactNumber;
        }
        const city = await City.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json({ city });
    } catch (err) {
        res.status(400).json({ error: 'Failed to update city' });
    }
};

// Toggle city active status
exports.toggleCityStatus = async (req, res) => {
    try {
        const city = await City.findById(req.params.id);
        if (!city) {
            return res.status(404).json({ error: 'City not found' });
        }
        city.isActive = !city.isActive;
        await city.save();
        res.json({ city, message: `City ${city.isActive ? 'activated' : 'deactivated'} successfully` });
    } catch (err) {
        res.status(400).json({ error: 'Failed to toggle city status' });
    }
};

// Get products for a specific city
exports.getCityProducts = async (req, res) => {
    try {
        // First get all active categories
        const Category = require('../models/Category');
        const activeCategories = await Category.find({ isActive: true }).select('_id');
        const activeCategoryIds = activeCategories.map(cat => cat._id);

        const products = await Product.find({
            cities: req.params.id,
            category: { $in: activeCategoryIds } // Only show products from active categories
        })
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

// Update a product for a specific city (creates city-specific copy if needed)
exports.updateCityProduct = async (req, res) => {
    try {
        const cityId = req.params.cityId;
        const productId = req.params.productId;
        const updateData = req.body;

        console.log('City Product Update - Request Data:', {
            cityId,
            productId,
            price: updateData.price,
            regularPrice: updateData.regularPrice,
            name: updateData.name
        });

        // Get the existing product
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log('Existing Product:', {
            name: existingProduct.name,
            price: existingProduct.price,
            regularPrice: existingProduct.regularPrice,
            citiesCount: existingProduct.cities ? existingProduct.cities.length : 0
        });

        // Check if product exists in multiple cities
        const citiesCount = existingProduct.cities ? existingProduct.cities.length : 0;

        if (citiesCount > 1) {
            // Product exists in multiple cities - create a city-specific copy

            // Create a new product with the same data
            const newProductData = {
                name: updateData.name || existingProduct.name,
                material: updateData.material || existingProduct.material,
                size: updateData.size || existingProduct.size,
                colour: updateData.colour || existingProduct.colour,
                category: updateData.category || existingProduct.category,
                subCategory: updateData.subCategory !== undefined ?
                    (updateData.subCategory === '' ? undefined : updateData.subCategory) :
                    existingProduct.subCategory,
                utility: updateData.utility || existingProduct.utility,
                care: updateData.care || existingProduct.care,
                price: updateData.price !== undefined ? parseFloat(updateData.price) : existingProduct.price,
                regularPrice: updateData.regularPrice !== undefined ? parseFloat(updateData.regularPrice) : existingProduct.regularPrice,
                image: existingProduct.image,
                images: existingProduct.images || [],
                inStock: updateData.inStock !== undefined ? (updateData.inStock === 'true' || updateData.inStock === true) : existingProduct.inStock,
                isBestSeller: updateData.isBestSeller !== undefined ? (updateData.isBestSeller === 'true' || updateData.isBestSeller === true) : existingProduct.isBestSeller,
                isTrending: updateData.isTrending !== undefined ? (updateData.isTrending === 'true' || updateData.isTrending === true) : existingProduct.isTrending,
                isMostLoved: updateData.isMostLoved !== undefined ? (updateData.isMostLoved === 'true' || updateData.isMostLoved === true) : existingProduct.isMostLoved,
                codAvailable: updateData.codAvailable !== undefined ? (updateData.codAvailable !== 'false' && updateData.codAvailable !== false) : existingProduct.codAvailable,
                stock: updateData.stock !== undefined ? Number(updateData.stock) : existingProduct.stock,
                rating: existingProduct.rating,
                reviews: existingProduct.reviews,
                cities: [cityId] // Only assign to the current city
            };

            // Create the new product
            const newProduct = new Product(newProductData);
            await newProduct.save();

            // Remove the city from the original product's cities array
            await Product.findByIdAndUpdate(
                productId,
                { $pull: { cities: cityId } }
            );

            res.json({
                success: true,
                message: 'Product cloned and updated for this city only',
                product: newProduct,
                isNewProduct: true
            });
        } else {
            // Product exists only in this city - update it directly
            const updatedProductData = {
                name: updateData.name || existingProduct.name,
                material: updateData.material || existingProduct.material,
                size: updateData.size || existingProduct.size,
                colour: updateData.colour || existingProduct.colour,
                category: updateData.category || existingProduct.category,
                subCategory: updateData.subCategory !== undefined ?
                    (updateData.subCategory === '' ? undefined : updateData.subCategory) :
                    existingProduct.subCategory,
                utility: updateData.utility || existingProduct.utility,
                care: updateData.care || existingProduct.care,
                price: updateData.price !== undefined ? parseFloat(updateData.price) : existingProduct.price,
                regularPrice: updateData.regularPrice !== undefined ? parseFloat(updateData.regularPrice) : existingProduct.regularPrice,
                inStock: updateData.inStock !== undefined ? (updateData.inStock === 'true' || updateData.inStock === true) : existingProduct.inStock,
                isBestSeller: updateData.isBestSeller !== undefined ? (updateData.isBestSeller === 'true' || updateData.isBestSeller === true) : existingProduct.isBestSeller,
                isTrending: updateData.isTrending !== undefined ? (updateData.isTrending === 'true' || updateData.isTrending === true) : existingProduct.isTrending,
                isMostLoved: updateData.isMostLoved !== undefined ? (updateData.isMostLoved === 'true' || updateData.isMostLoved === true) : existingProduct.isMostLoved,
                codAvailable: updateData.codAvailable !== undefined ? (updateData.codAvailable !== 'false' && updateData.codAvailable !== false) : existingProduct.codAvailable,
                stock: updateData.stock !== undefined ? Number(updateData.stock) : existingProduct.stock
            };

            const updatedProduct = await Product.findByIdAndUpdate(
                productId,
                updatedProductData,
                { new: true }
            );

            res.json({
                success: true,
                message: 'Product updated for this city',
                product: updatedProduct,
                isNewProduct: false
            });
        }
    } catch (err) {
        console.error('Error updating city product:', err);
        res.status(500).json({ error: 'Failed to update city product', details: err.message });
    }
};
