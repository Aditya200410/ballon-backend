const City = require('../models/City');
const Product = require('../models/Product');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const HeroCarousel = require('../models/heroCarousel');
const mongoose = require('mongoose');

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
        const cityId = req.params.id;
        // First get all active categories
        const Category = require('../models/Category');
        const activeCategories = await Category.find({ isActive: true }).select('_id');
        const activeCategoryIds = activeCategories.map(cat => cat._id);

        // Fetch products that are assigned to this city
        // We look in both cityPrices (new logic) and cities array (support for older assignments/legacy)
        let products = await Product.find({
            $or: [
                { 'cityPrices.city': cityId },
                { cities: cityId }
            ],
            category: { $in: activeCategoryIds }
        })
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .populate('cities', 'name') // Populate city names to show assigned cities
            .sort({ date: -1 });

        // Adjust returned prices based on city-specific entries
        products = products.map(product => {
            const cityPrice = product.cityPrices.find(cp => cp.city.toString() === cityId);
            const prodObj = product.toObject();

            if (cityPrice) {
                prodObj.price = cityPrice.price;
                prodObj.regularPrice = cityPrice.regularPrice;
            }
            // If no cityPrice entry found, it uses the product's base price/regularPrice

            return prodObj;
        });

        res.json({ products });
    } catch (err) {
        console.error('getCityProducts error:', err);
        res.status(500).json({ error: 'Failed to fetch city products' });
    }
};

// Add products to a city
exports.addProductsToCity = async (req, res) => {
    try {
        const { productIds, products: productData } = req.body;
        const cityId = req.params.id;

        const itemsToProcess = [];
        if (productData && Array.isArray(productData)) {
            itemsToProcess.push(...productData);
        } else if (productIds && Array.isArray(productIds)) {
            // Fetch default prices for bulk IDs
            const productsList = await Product.find({ _id: { $in: productIds } });
            productsList.forEach(p => {
                itemsToProcess.push({
                    productId: p._id,
                    price: p.price,
                    regularPrice: p.regularPrice
                });
            });
        }

        for (const item of itemsToProcess) {
            const productId = item.productId || item.id;
            const product = await Product.findById(productId);

            if (product) {
                // Ensure city is in cities array
                if (!product.cities.includes(cityId)) {
                    product.cities.push(cityId);
                }

                // Update or add cityPrice entry
                const existingPriceIndex = product.cityPrices.findIndex(
                    cp => cp.city.toString() === cityId.toString()
                );

                if (existingPriceIndex > -1) {
                    product.cityPrices[existingPriceIndex].price = item.price;
                    product.cityPrices[existingPriceIndex].regularPrice = item.regularPrice;
                } else {
                    product.cityPrices.push({
                        city: cityId,
                        price: item.price,
                        regularPrice: item.regularPrice
                    });
                }

                await product.save();
            }
        }

        res.json({ success: true, message: 'Products integrated with city pricing' });
    } catch (err) {
        console.error('Add items error:', err);
        res.status(400).json({ error: 'Failed to add products to city' });
    }
};

// Remove products from a city
exports.removeProductsFromCity = async (req, res) => {
    try {
        const { productIds } = req.body;
        const cityId = req.params.id;

        // Remove city from 'cities' and 'cityPrices' arrays
        await Product.updateMany(
            { _id: { $in: productIds } },
            {
                $pull: {
                    cities: cityId,
                    cityPrices: { city: cityId }
                }
            }
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

        // Import products by adding target city and copying prices where possible
        const updatePromises = sourceProducts.map(product => {
            // Find price for source city
            const sourcePriceEntry = product.cityPrices.find(cp => cp.city.toString() === sourceCityId);
            const price = sourcePriceEntry ? sourcePriceEntry.price : product.price;
            const regularPrice = sourcePriceEntry ? sourcePriceEntry.regularPrice : product.regularPrice;

            return Product.findByIdAndUpdate(product._id, {
                $addToSet: {
                    cities: targetCityId,
                    cityPrices: {
                        city: targetCityId,
                        price: price,
                        regularPrice: regularPrice
                    }
                }
            });
        });

        await Promise.all(updatePromises);

        res.json({
            success: true,
            message: `Imported ${sourceProducts.length} products from source city`,
            count: sourceProducts.length
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
        const subcategories = await SubCategory.find({ cities: req.params.id })
            .populate('parentCategory', 'name')
            .sort({ name: 1 });
        res.json({ subcategories });
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

// Get Hero Carousel items for a specific city
exports.getCityCarouselItems = async (req, res) => {
    try {
        const carouselItems = await HeroCarousel.find({ cities: req.params.id })
            .sort({ sortOrder: 1, createdAt: -1 });
        res.json({ carouselItems });
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

// Import all content from another city
exports.importAllFromCity = async (req, res) => {
    try {
        const { sourceCityId } = req.body;
        const targetCityId = req.params.id;

        // Get all content from source city
        const [sourceProducts, sourceCategories, sourceSubCategories, sourceCarouselItems] = await Promise.all([
            Product.find({ cities: sourceCityId }),
            Category.find({ cities: sourceCityId }),
            SubCategory.find({ cities: sourceCityId }),
            HeroCarousel.find({ cities: sourceCityId })
        ]);

        // Add target city to all items and handle product prices
        const productUpdatePromises = sourceProducts.map(product => {
            const sourcePriceEntry = product.cityPrices.find(cp => cp.city.toString() === sourceCityId);
            const price = sourcePriceEntry ? sourcePriceEntry.price : product.price;
            const regularPrice = sourcePriceEntry ? sourcePriceEntry.regularPrice : product.regularPrice;

            return Product.findByIdAndUpdate(product._id, {
                $addToSet: {
                    cities: targetCityId,
                    cityPrices: {
                        city: targetCityId,
                        price: price,
                        regularPrice: regularPrice
                    }
                }
            });
        });

        await Promise.all([
            ...productUpdatePromises,
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

        // Update the product with city-specific price in cityPrices array
        const price = updateData.price !== undefined ? parseFloat(updateData.price) : existingProduct.price;
        const regularPrice = updateData.regularPrice !== undefined ? parseFloat(updateData.regularPrice) : existingProduct.regularPrice;

        // Ensure cityPrices exists
        if (!existingProduct.cityPrices) {
            existingProduct.cityPrices = [];
        }

        // Find if this city already has a price entry
        const cityPriceIndex = existingProduct.cityPrices.findIndex(cp => cp.city.toString() === cityId);

        if (cityPriceIndex !== -1) {
            // Update existing city price
            existingProduct.cityPrices[cityPriceIndex].price = price;
            existingProduct.cityPrices[cityPriceIndex].regularPrice = regularPrice;
        } else {
            // Add new city price entry
            existingProduct.cityPrices.push({
                city: cityId,
                price: price,
                regularPrice: regularPrice
            });
        }

        // Ensure the city is also in the 'cities' array for filtering
        if (!existingProduct.cities.map(c => c.toString()).includes(cityId)) {
            existingProduct.cities.push(cityId);
        }

        // Update other fields if provided (mostly for compatibility with how it was used)
        if (updateData.name) existingProduct.name = updateData.name;
        if (updateData.material) existingProduct.material = updateData.material;
        if (updateData.size) existingProduct.size = updateData.size;
        if (updateData.colour) existingProduct.colour = updateData.colour;
        if (updateData.inStock !== undefined) existingProduct.inStock = (updateData.inStock === 'true' || updateData.inStock === true);
        if (updateData.stock !== undefined) existingProduct.stock = Number(updateData.stock);

        await existingProduct.save();

        res.json({
            success: true,
            message: 'Product updated with city-specific pricing',
            product: existingProduct,
            isNewProduct: false
        });
    } catch (err) {
        console.error('Error in updateCityProduct:', err);
        res.status(400).json({ error: 'Failed to update city product' });
    }
};
