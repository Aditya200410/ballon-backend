const mongoose = require('mongoose');
const Category = require('../models/cate');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const FeaturedProduct = require('../models/FeaturedProduct');
const BestSeller = require('../models/bestSeller');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ballon-party');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Main categories from balloondekor.com
const mainCategories = [
  {
    name: 'Birthday',
    description: 'Beautiful birthday decorations for all ages. From simple home decor to extravagant party setups.',
    image: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?auto=format&fit=crop&w=400&q=80',
    sortOrder: 1
  },
  {
    name: 'Anniversary',
    description: 'Romantic anniversary decorations to celebrate your special moments together.',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80',
    sortOrder: 2
  },
  {
    name: 'Baby Shower',
    description: 'Celebrate the upcoming arrival with beautiful baby shower decorations.',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80',
    sortOrder: 3
  },
  {
    name: 'Newborn Welcome',
    description: 'Welcome your little bundle of joy with special newborn welcome decorations.',
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80',
    sortOrder: 4
  },
  {
    name: 'Kids Special',
    description: 'Fun-filled themed decorations for kids with popular characters and themes.',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80',
    sortOrder: 5
  },
  {
    name: 'Wedding Collection',
    description: 'From Haldi to Honeymoon - complete wedding decoration solutions.',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80',
    sortOrder: 6
  },
  {
    name: 'Balloon Hampers',
    description: 'Beautiful balloon bouquets and hampers for special occasions.',
    image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=400&q=80',
    sortOrder: 7
  },
  {
    name: 'Corporate Events',
    description: 'Professional decorations for office parties, shop openings, and corporate events.',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=400&q=80',
    sortOrder: 8
  }
];

// Subcategories for each main category
const subcategories = {
  'Birthday': [
    { name: 'All Birthday', description: 'Complete birthday decoration packages' },
    { name: 'Bangalore', description: 'Birthday decorations in Bangalore' },
    { name: 'Mumbai', description: 'Birthday decorations in Mumbai' },
    { name: 'Delhi', description: 'Birthday decorations in Delhi' },
    { name: 'Ahmedabad', description: 'Birthday decorations in Ahmedabad' },
    { name: 'Kolkata', description: 'Birthday decorations in Kolkata' },
    { name: 'Chennai', description: 'Birthday decorations in Chennai' },
    { name: 'Hyderabad', description: 'Birthday decorations in Hyderabad' },
    { name: 'Pune', description: 'Birthday decorations in Pune' }
  ],
  'Anniversary': [
    { name: 'All Anniversary', description: 'Complete anniversary decoration packages' },
    { name: 'Bangalore', description: 'Anniversary decorations in Bangalore' },
    { name: 'Mumbai', description: 'Anniversary decorations in Mumbai' },
    { name: 'Delhi', description: 'Anniversary decorations in Delhi' },
    { name: 'Ahmedabad', description: 'Anniversary decorations in Ahmedabad' },
    { name: 'Kolkata', description: 'Anniversary decorations in Kolkata' },
    { name: 'Chennai', description: 'Anniversary decorations in Chennai' },
    { name: 'Hyderabad', description: 'Anniversary decorations in Hyderabad' },
    { name: 'Pune', description: 'Anniversary decorations in Pune' }
  ],
  'Baby Shower': [
    { name: 'All Baby Shower', description: 'Complete baby shower decoration packages' },
    { name: 'Bangalore', description: 'Baby shower decorations in Bangalore' },
    { name: 'Mumbai', description: 'Baby shower decorations in Mumbai' },
    { name: 'Delhi', description: 'Baby shower decorations in Delhi' },
    { name: 'Ahmedabad', description: 'Baby shower decorations in Ahmedabad' },
    { name: 'Kolkata', description: 'Baby shower decorations in Kolkata' },
    { name: 'Chennai', description: 'Baby shower decorations in Chennai' },
    { name: 'Hyderabad', description: 'Baby shower decorations in Hyderabad' },
    { name: 'Pune', description: 'Baby shower decorations in Pune' }
  ],
  'Newborn Welcome': [
    { name: 'All Newborn Welcome', description: 'Complete newborn welcome decoration packages' },
    { name: 'Bangalore', description: 'Newborn welcome decorations in Bangalore' },
    { name: 'Mumbai', description: 'Newborn welcome decorations in Mumbai' },
    { name: 'Delhi', description: 'Newborn welcome decorations in Delhi' },
    { name: 'Ahmedabad', description: 'Newborn welcome decorations in Ahmedabad' },
    { name: 'Kolkata', description: 'Newborn welcome decorations in Kolkata' },
    { name: 'Chennai', description: 'Newborn welcome decorations in Chennai' },
    { name: 'Hyderabad', description: 'Newborn welcome decorations in Hyderabad' },
    { name: 'Pune', description: 'Newborn welcome decorations in Pune' }
  ],
  'Kids Special': [
    { name: 'All Kids Decor', description: 'Complete kids decoration packages' },
    { name: 'Jungle', description: 'Jungle theme decorations for kids' },
    { name: 'Frozen', description: 'Frozen theme decorations for kids' },
    { name: 'Cocomelon', description: 'Cocomelon theme decorations for kids' },
    { name: 'Mermaid', description: 'Mermaid theme decorations for kids' },
    { name: 'Baby Shark', description: 'Baby Shark theme decorations for kids' },
    { name: 'Boss Baby', description: 'Boss Baby theme decorations for kids' }
  ],
  'Wedding Collection': [
    { name: 'Bridal Shower', description: 'Elegant bridal shower decorations' },
    { name: 'Haldi Decor', description: 'Traditional Haldi ceremony decorations' },
    { name: 'Mehndi Decor', description: 'Beautiful Mehndi ceremony decorations' },
    { name: 'Wedding Car', description: 'Stunning wedding car decorations' },
    { name: 'Bride Welcome', description: 'Special bride welcome decorations' },
    { name: 'First Night', description: 'Romantic first night decorations' }
  ],
  'Balloon Hampers': [
    { name: 'Birthday Bouquets', description: 'Beautiful birthday balloon bouquets' },
    { name: 'Anniversary Bouquets', description: 'Romantic anniversary balloon bouquets' },
    { name: 'Proposal Bouquets', description: 'Special proposal balloon bouquets' },
    { name: 'Custom Bouquets', description: 'Customized balloon bouquets' }
  ],
  'Corporate Events': [
    { name: 'Shop Opening', description: 'Professional shop opening decorations' },
    { name: 'Office Parties', description: 'Corporate office party decorations' },
    { name: 'Cafe Opening', description: 'Cafe and restaurant opening decorations' },
    { name: 'Corporate Gala', description: 'Elegant corporate gala decorations' }
  ]
};

// Products data from balloondekor.com
const products = [
  // Birthday Products
  {
    name: 'Simple Balloon Decor for Home',
    description: 'Beautiful and simple balloon decoration perfect for home celebrations. Easy to set up and creates a festive atmosphere.',
    price: 1499,
    regularPrice: 1999,
    rating: 4.9,
    reviews: 487,
    category: 'Birthday',
    subCategory: 'All Birthday',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Rose Gold Birthday Home Decor',
    description: 'Elegant rose gold themed birthday decoration that adds a touch of luxury to your celebration.',
    price: 1999,
    regularPrice: 2299,
    rating: 4.9,
    reviews: 352,
    category: 'Birthday',
    subCategory: 'All Birthday',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Adorable Birthday Arch Backdrop',
    description: 'Stunning birthday arch backdrop perfect for photo opportunities and creating memorable moments.',
    price: 2499,
    regularPrice: 3299,
    rating: 5.0,
    reviews: 325,
    category: 'Birthday',
    subCategory: 'All Birthday',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Blush & Glow Birthday Theme',
    description: 'Soft blush and glow themed birthday decoration that creates a dreamy and romantic atmosphere.',
    price: 2199,
    regularPrice: 2499,
    rating: 4.9,
    reviews: 287,
    category: 'Birthday',
    subCategory: 'All Birthday',
    isBestSeller: false,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Cocomelon Theme Decoration',
    description: 'Fun Cocomelon themed decoration perfect for kids who love the popular cartoon character.',
    price: 2799,
    regularPrice: 3299,
    rating: 4.8,
    reviews: 156,
    category: 'Kids Special',
    subCategory: 'Cocomelon',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Baby Shark Theme Decoration',
    description: 'Adorable Baby Shark themed decoration that will make your little one dance with joy.',
    price: 2599,
    regularPrice: 2999,
    rating: 4.7,
    reviews: 203,
    category: 'Kids Special',
    subCategory: 'Baby Shark',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Frozen Theme Decoration',
    description: 'Magical Frozen themed decoration that brings the world of Elsa and Anna to your party.',
    price: 2999,
    regularPrice: 3499,
    rating: 4.9,
    reviews: 189,
    category: 'Kids Special',
    subCategory: 'Frozen',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Mermaid Theme Decoration',
    description: 'Enchanting mermaid themed decoration perfect for little princesses who love the underwater world.',
    price: 2699,
    regularPrice: 3199,
    rating: 4.8,
    reviews: 142,
    category: 'Kids Special',
    subCategory: 'Mermaid',
    isBestSeller: false,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Jungle Theme Decoration',
    description: 'Wild jungle themed decoration with animal balloons and green foliage for adventurous little explorers.',
    price: 2399,
    regularPrice: 2799,
    rating: 4.6,
    reviews: 98,
    category: 'Kids Special',
    subCategory: 'Jungle',
    isBestSeller: false,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Boss Baby Theme Decoration',
    description: 'Cute Boss Baby themed decoration perfect for little business-minded kids.',
    price: 2499,
    regularPrice: 2899,
    rating: 4.5,
    reviews: 87,
    category: 'Kids Special',
    subCategory: 'Boss Baby',
    isBestSeller: false,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  // Anniversary Products
  {
    name: 'Anniversary Home Decoration',
    description: 'Romantic anniversary decoration perfect for celebrating your special moments together at home.',
    price: 1999,
    regularPrice: 2199,
    rating: 4.9,
    reviews: 165,
    category: 'Anniversary',
    subCategory: 'All Anniversary',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Red Anniversary Home Decor',
    description: 'Classic red themed anniversary decoration symbolizing love and passion.',
    price: 2099,
    regularPrice: 2499,
    rating: 4.8,
    reviews: 185,
    category: 'Anniversary',
    subCategory: 'All Anniversary',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Romantic Anniversary Room Celebration',
    description: 'Intimate room decoration perfect for a romantic anniversary celebration.',
    price: 2399,
    regularPrice: 2499,
    rating: 4.4,
    reviews: 23,
    category: 'Anniversary',
    subCategory: 'All Anniversary',
    isBestSeller: false,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Anniversary Bliss Setup',
    description: 'Complete anniversary bliss setup with flowers, balloons, and romantic lighting.',
    price: 2499,
    regularPrice: 2999,
    rating: 4.6,
    reviews: 255,
    category: 'Anniversary',
    subCategory: 'All Anniversary',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80'
  },
  // Baby Shower Products
  {
    name: 'Dreamy Baby Shower Balloons',
    description: 'Beautiful dreamy baby shower balloon decoration perfect for celebrating the upcoming arrival.',
    price: 2999,
    regularPrice: 3299,
    rating: 4.4,
    reviews: 192,
    category: 'Baby Shower',
    subCategory: 'All Baby Shower',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Oh Baby Decor for Mom to be',
    description: 'Special "Oh Baby" decoration designed specifically for the mom-to-be celebration.',
    price: 3499,
    regularPrice: 3999,
    rating: 4.9,
    reviews: 287,
    category: 'Baby Shower',
    subCategory: 'All Baby Shower',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Luxe Oh Baby Wall Setup',
    description: 'Luxurious "Oh Baby" wall setup with premium materials and elegant design.',
    price: 2899,
    regularPrice: 3499,
    rating: 4.9,
    reviews: 297,
    category: 'Baby Shower',
    subCategory: 'All Baby Shower',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Flower Backdrop for Baby Shower',
    description: 'Stunning flower backdrop perfect for baby shower photo opportunities.',
    price: 12999,
    regularPrice: 14999,
    rating: 4.7,
    reviews: 20,
    category: 'Baby Shower',
    subCategory: 'All Baby Shower',
    isBestSeller: false,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=400&q=80'
  },
  // Newborn Welcome Products
  {
    name: 'Welcome Baby Princess Decoration',
    description: 'Beautiful princess themed welcome decoration for your little princess.',
    price: 3899,
    regularPrice: 4499,
    rating: 4.8,
    reviews: 287,
    category: 'Newborn Welcome',
    subCategory: 'All Newborn Welcome',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Baby Homecoming Setup',
    description: 'Complete baby homecoming setup to welcome your little one in style.',
    price: 3899,
    regularPrice: 4499,
    rating: 4.7,
    reviews: 281,
    category: 'Newborn Welcome',
    subCategory: 'All Newborn Welcome',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Welcome Balloon Setup',
    description: 'Simple yet elegant welcome balloon setup for your newborn.',
    price: 1999,
    regularPrice: 2399,
    rating: 5.0,
    reviews: 610,
    category: 'Newborn Welcome',
    subCategory: 'All Newborn Welcome',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Simple Welcome Balloon Decoration',
    description: 'Affordable and beautiful simple welcome balloon decoration.',
    price: 1699,
    regularPrice: 2099,
    rating: 4.9,
    reviews: 317,
    category: 'Newborn Welcome',
    subCategory: 'All Newborn Welcome',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80'
  },
  // Wedding Collection Products
  {
    name: 'Bridal Shower Decoration',
    description: 'Elegant bridal shower decoration to celebrate the bride-to-be.',
    price: 3599,
    regularPrice: 3999,
    rating: 4.8,
    reviews: 156,
    category: 'Wedding Collection',
    subCategory: 'Bridal Shower',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Haldi Decor Setup',
    description: 'Traditional Haldi ceremony decoration with vibrant yellow theme.',
    price: 2799,
    regularPrice: 3299,
    rating: 4.7,
    reviews: 134,
    category: 'Wedding Collection',
    subCategory: 'Haldi Decor',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Mehndi Decor Setup',
    description: 'Beautiful Mehndi ceremony decoration with intricate designs and vibrant colors.',
    price: 3199,
    regularPrice: 3699,
    rating: 4.9,
    reviews: 198,
    category: 'Wedding Collection',
    subCategory: 'Mehndi Decor',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Audi Rose Bridal Car Decoration',
    description: 'Stunning rose themed decoration for Audi bridal car.',
    price: 4799,
    regularPrice: 5499,
    rating: 4.9,
    reviews: 44,
    category: 'Wedding Collection',
    subCategory: 'Wedding Car',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Premium Wedding Car Decoration',
    description: 'Premium wedding car decoration with luxury materials and elegant design.',
    price: 11999,
    regularPrice: 13999,
    rating: 4.7,
    reviews: 33,
    category: 'Wedding Collection',
    subCategory: 'Wedding Car',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Bridal Toyota Car Decoration',
    description: 'Beautiful decoration for Toyota bridal car with elegant design.',
    price: 4399,
    regularPrice: 5499,
    rating: 4.6,
    reviews: 32,
    category: 'Wedding Collection',
    subCategory: 'Wedding Car',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'White Car Wedding Decoration',
    description: 'Classic white car wedding decoration for a timeless look.',
    price: 9999,
    regularPrice: 10999,
    rating: 4.7,
    reviews: 55,
    category: 'Wedding Collection',
    subCategory: 'Wedding Car',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Bride Welcome Decoration',
    description: 'Special bride welcome decoration to greet the beautiful bride.',
    price: 3299,
    regularPrice: 3799,
    rating: 4.8,
    reviews: 89,
    category: 'Wedding Collection',
    subCategory: 'Bride Welcome',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'First Night Decoration',
    description: 'Romantic first night decoration for the newlyweds.',
    price: 2599,
    regularPrice: 2999,
    rating: 4.6,
    reviews: 67,
    category: 'Wedding Collection',
    subCategory: 'First Night',
    isBestSeller: false,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80'
  },
  // Balloon Hampers Products
  {
    name: 'Cute Happy Birthday Balloon Bouquet',
    description: 'Adorable happy birthday balloon bouquet perfect for gifting.',
    price: 2799,
    regularPrice: 2799,
    rating: 4.8,
    reviews: 150,
    category: 'Balloon Hampers',
    subCategory: 'Birthday Bouquets',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Golden Noir Balloon Bouquet',
    description: 'Elegant golden noir balloon bouquet for special occasions.',
    price: 2699,
    regularPrice: 2899,
    rating: 4.9,
    reviews: 220,
    category: 'Balloon Hampers',
    subCategory: 'Anniversary Bouquets',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Surprise Balloon Bouquet for Wife',
    description: 'Special surprise balloon bouquet designed for your beloved wife.',
    price: 2699,
    regularPrice: 2899,
    rating: 4.8,
    reviews: 216,
    category: 'Balloon Hampers',
    subCategory: 'Anniversary Bouquets',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Surprise Proposal Balloon Bouquet',
    description: 'Romantic proposal balloon bouquet to make your proposal unforgettable.',
    price: 3199,
    regularPrice: 3500,
    rating: 4.5,
    reviews: 215,
    category: 'Balloon Hampers',
    subCategory: 'Proposal Bouquets',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=400&q=80'
  },
  // Corporate Events Products
  {
    name: 'Cafe Opening Entrance Decoration',
    description: 'Professional entrance decoration for cafe opening celebrations.',
    price: 3199,
    regularPrice: 4099,
    rating: 4.4,
    reviews: 45,
    category: 'Corporate Events',
    subCategory: 'Cafe Opening',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Entrance Balloon Gate For Shop Opening',
    description: 'Impressive balloon gate decoration for shop opening ceremonies.',
    price: 5499,
    regularPrice: 6999,
    rating: 4.8,
    reviews: 78,
    category: 'Corporate Events',
    subCategory: 'Shop Opening',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Corporate Gala Balloon Decoration',
    description: 'Elegant corporate gala decoration for professional events.',
    price: 10999,
    regularPrice: 12999,
    rating: 4.2,
    reviews: 30,
    category: 'Corporate Events',
    subCategory: 'Corporate Gala',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=400&q=80'
  },
  {
    name: 'Shop Opening Decoration',
    description: 'Complete shop opening decoration package for new businesses.',
    price: 2999,
    regularPrice: 3699,
    rating: 4.9,
    reviews: 84,
    category: 'Corporate Events',
    subCategory: 'Shop Opening',
    isBestSeller: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=400&q=80'
  }
];

// Function to import categories
const importCategories = async () => {
  try {
    console.log('Importing main categories...');
    const createdCategories = [];
    
    for (const categoryData of mainCategories) {
      const existingCategory = await Category.findOne({ name: categoryData.name });
      if (!existingCategory) {
        const category = new Category(categoryData);
        await category.save();
        createdCategories.push(category);
        console.log(`Created category: ${categoryData.name}`);
      } else {
        createdCategories.push(existingCategory);
        console.log(`Category already exists: ${categoryData.name}`);
      }
    }
    
    return createdCategories;
  } catch (error) {
    console.error('Error importing categories:', error);
    throw error;
  }
};

// Function to import subcategories
const importSubcategories = async (categories) => {
  try {
    console.log('Importing subcategories...');
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat._id;
    });
    
    const createdSubcategories = [];
    
    for (const [categoryName, subcategoryList] of Object.entries(subcategories)) {
      const parentCategoryId = categoryMap[categoryName];
      if (!parentCategoryId) {
        console.log(`Parent category not found: ${categoryName}`);
        continue;
      }
      
      for (const subcategoryData of subcategoryList) {
        const existingSubcategory = await SubCategory.findOne({ 
          name: subcategoryData.name,
          parentCategory: parentCategoryId 
        });
        
        if (!existingSubcategory) {
          const subcategory = new SubCategory({
            ...subcategoryData,
            parentCategory: parentCategoryId,
            image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=400&q=80'
          });
          await subcategory.save();
          createdSubcategories.push(subcategory);
          console.log(`Created subcategory: ${subcategoryData.name} under ${categoryName}`);
        } else {
          createdSubcategories.push(existingSubcategory);
          console.log(`Subcategory already exists: ${subcategoryData.name} under ${categoryName}`);
        }
      }
    }
    
    return createdSubcategories;
  } catch (error) {
    console.error('Error importing subcategories:', error);
    throw error;
  }
};

// Function to import products
const importProducts = async (categories, subcategories) => {
  try {
    console.log('Importing products...');
    const categoryMap = {};
    const subcategoryMap = {};
    
    categories.forEach(cat => {
      categoryMap[cat.name] = cat._id;
    });
    
    subcategories.forEach(sub => {
      const key = `${sub.name}_${sub.parentCategory}`;
      subcategoryMap[key] = sub._id;
    });
    
    const createdProducts = [];
    
    for (const productData of products) {
      const categoryId = categoryMap[productData.category];
      const subcategoryId = subcategoryMap[`${productData.subCategory}_${categoryId}`];
      
      if (!categoryId) {
        console.log(`Category not found for product: ${productData.name}`);
        continue;
      }
      
      const existingProduct = await Product.findOne({ name: productData.name });
      if (!existingProduct) {
        const product = new Product({
          name: productData.name,
          description: productData.description,
          material: 'Balloon Decoration Materials',
          size: 'Standard',
          colour: 'Multi-color',
          category: categoryId,
          subCategory: subcategoryId,
          weight: 'Lightweight',
          utility: 'Party Decoration',
          care: 'Handle with care',
          price: productData.price,
          regularPrice: productData.regularPrice,
          image: productData.image,
          images: [productData.image],
          inStock: true,
          stock: 10,
          isBestSeller: productData.isBestSeller,
          isFeatured: productData.isFeatured,
          isMostLoved: false,
          rating: productData.rating,
          reviews: productData.reviews,
          codAvailable: true
        });
        
        await product.save();
        createdProducts.push(product);
        console.log(`Created product: ${productData.name}`);
      } else {
        console.log(`Product already exists: ${productData.name}`);
      }
    }
    
    return createdProducts;
  } catch (error) {
    console.error('Error importing products:', error);
    throw error;
  }
};

// Function to update featured products
const updateFeaturedProducts = async (products) => {
  try {
    console.log('Updating featured products...');
    
    // Clear existing featured products
    await FeaturedProduct.deleteMany({});
    
    // Add new featured products
    const featuredProducts = products.filter(p => p.isFeatured);
    for (const product of featuredProducts) {
      const featuredProduct = new FeaturedProduct({
        name: product.name,
        description: product.description,
        material: product.material,
        size: product.size,
        colour: product.colour,
        category: product.category,
        weight: product.weight,
        utility: product.utility,
        care: product.care,
        price: product.price,
        regularPrice: product.regularPrice,
        image: product.image,
        images: product.images,
        inStock: product.inStock,
        rating: product.rating,
        reviews: product.reviews
      });
      
      await featuredProduct.save();
      console.log(`Added to featured products: ${product.name}`);
    }
  } catch (error) {
    console.error('Error updating featured products:', error);
    throw error;
  }
};

// Function to update best sellers
const updateBestSellers = async (products) => {
  try {
    console.log('Updating best sellers...');
    
    // Clear existing best sellers
    await BestSeller.deleteMany({});
    
    // Add new best sellers
    const bestSellers = products.filter(p => p.isBestSeller);
    for (const product of bestSellers) {
      const bestSeller = new BestSeller({
        name: product.name,
        description: product.description,
        material: product.material,
        size: product.size,
        colour: product.colour,
        category: product.category,
        weight: product.weight,
        utility: product.utility,
        care: product.care,
        price: product.price,
        regularPrice: product.regularPrice,
        image: product.image,
        images: product.images,
        inStock: product.inStock,
        rating: product.rating,
        reviews: product.reviews
      });
      
      await bestSeller.save();
      console.log(`Added to best sellers: ${product.name}`);
    }
  } catch (error) {
    console.error('Error updating best sellers:', error);
    throw error;
  }
};

// Main import function
const importData = async () => {
  try {
    await connectDB();
    
    console.log('Starting data import from balloondekor.com...');
    
    // Import categories
    const categories = await importCategories();
    console.log(`Imported ${categories.length} categories`);
    
    // Import subcategories
    const subcategories = await importSubcategories(categories);
    console.log(`Imported ${subcategories.length} subcategories`);
    
    // Import products
    const products = await importProducts(categories, subcategories);
    console.log(`Imported ${products.length} products`);
    
    // Update featured products
    await updateFeaturedProducts(products);
    console.log('Updated featured products');
    
    // Update best sellers
    await updateBestSellers(products);
    console.log('Updated best sellers');
    
    console.log('Data import completed successfully!');
    console.log(`Summary:`);
    console.log(`- Categories: ${categories.length}`);
    console.log(`- Subcategories: ${subcategories.length}`);
    console.log(`- Products: ${products.length}`);
    
  } catch (error) {
    console.error('Error during data import:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the import
if (require.main === module) {
  importData();
}

module.exports = { importData };
