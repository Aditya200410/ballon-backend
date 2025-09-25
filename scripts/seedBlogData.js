const mongoose = require('mongoose');
const Blog = require('../models/Blog');
require('dotenv').config();

const sampleBlogs = [
  {
    title: "10 Amazing Party Decoration Ideas for Your Next Celebration",
    slug: "10-amazing-party-decoration-ideas",
    excerpt: "Discover creative and budget-friendly decoration ideas that will make your party unforgettable. From DIY projects to professional tips.",
    content: `
      <h2>Transform Your Party with These Creative Ideas</h2>
      
      <p>Planning a party can be overwhelming, but with the right decoration ideas, you can create a memorable experience for your guests. Here are our top 10 party decoration ideas that are both creative and budget-friendly.</p>

      <h3>1. Balloon Garlands</h3>
      <p>Balloon garlands are versatile and can be customized to match any theme. Create stunning arches or backdrops using balloons in your party colors.</p>

      <h3>2. DIY Photo Booth</h3>
      <p>Set up a photo booth with fun props and backdrops. This not only serves as decoration but also provides entertainment for your guests.</p>

      <h3>3. String Light Magic</h3>
      <p>Fairy lights and string lights can transform any space into a magical setting. Drape them around trees, hang them from ceilings, or create light curtains.</p>

      <h3>4. Themed Centerpieces</h3>
      <p>Create eye-catching centerpieces that match your party theme. Use flowers, candles, or creative DIY elements.</p>

      <h3>5. Colorful Table Settings</h3>
      <p>Coordinate your tableware, napkins, and place cards to create a cohesive and visually appealing table setting.</p>

      <blockquote>
        "The key to great party decorations is not spending more money, but being more creative with what you have."
      </blockquote>

      <h3>6. Backdrop Creations</h3>
      <p>Create stunning backdrops using fabric, paper, or even painted murals. These serve as perfect photo opportunities and focal points.</p>

      <h3>7. Outdoor Lighting</h3>
      <p>For outdoor parties, use lanterns, torches, or solar lights to create ambiance and ensure safety as the evening progresses.</p>

      <h3>8. Interactive Decorations</h3>
      <p>Include decorations that guests can interact with, such as a wishing tree, message board, or decoration station.</p>

      <h3>9. Seasonal Elements</h3>
      <p>Incorporate seasonal flowers, colors, and elements to make your party feel current and relevant to the time of year.</p>

      <h3>10. Personal Touches</h3>
      <p>Add personal elements that reflect the guest of honor or the occasion being celebrated. This makes the decoration meaningful and unique.</p>

      <h2>Tips for Success</h2>
      <ul>
        <li>Plan your color scheme in advance</li>
        <li>Start decorating early to avoid last-minute stress</li>
        <li>Have backup plans for outdoor decorations in case of weather</li>
        <li>Take photos of your setup for future reference</li>
      </ul>

      <p>Remember, the best party decorations are those that create joy and bring people together. Don't be afraid to experiment and have fun with your creative ideas!</p>
    `,
    featuredImage: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&h=600&fit=crop",
    author: "Sarah Johnson",
    tags: ["Party Planning", "DIY", "Decoration Ideas", "Budget Friendly"],
    category: "Party Planning",
    isPublished: true,
    isFeatured: true,
    publishedAt: new Date(),
    readTime: 8,
    metaDescription: "Discover 10 amazing party decoration ideas that are creative, budget-friendly, and will make your celebration unforgettable.",
    seoKeywords: ["party decorations", "DIY party ideas", "celebration decorations", "party planning tips"]
  },
  {
    title: "Seasonal Celebration Trends: What's Hot This Year",
    slug: "seasonal-celebration-trends-2024",
    excerpt: "Stay ahead of the curve with the latest trends in seasonal celebrations. From color palettes to decoration themes, discover what's trending this year.",
    content: `
      <h2>The Future of Seasonal Celebrations</h2>
      
      <p>As we move through 2024, new trends are emerging in how we celebrate seasonal events. From intimate gatherings to grand celebrations, here's what's trending this year.</p>

      <h3>Color Trends</h3>
      <p>This year's color palettes are all about warmth and sustainability. Earth tones, muted pastels, and natural colors are dominating the celebration scene.</p>

      <h3>Sustainable Celebrations</h3>
      <p>More people are choosing eco-friendly decorations and practices. Biodegradable balloons, reusable decorations, and locally sourced flowers are becoming the norm.</p>

      <h3>Technology Integration</h3>
      <p>Smart lighting, interactive displays, and social media integration are making celebrations more engaging and shareable than ever before.</p>

      <h3>Personalized Experiences</h3>
      <p>Custom decorations, personalized favors, and unique themes that reflect individual personalities are becoming increasingly popular.</p>
    `,
    featuredImage: "https://images.unsplash.com/photo-1464207687429-7505649dae38?w=800&h=600&fit=crop",
    author: "Mike Chen",
    tags: ["Trends", "Seasonal", "2024", "Celebrations"],
    category: "Event Trends",
    isPublished: true,
    isFeatured: false,
    publishedAt: new Date(),
    readTime: 5,
    metaDescription: "Discover the latest trends in seasonal celebrations for 2024, from color palettes to sustainable practices.",
    seoKeywords: ["celebration trends", "seasonal events", "2024 trends", "party trends"]
  },
  {
    title: "DIY Balloon Arch Tutorial: Step-by-Step Guide",
    slug: "diy-balloon-arch-tutorial",
    excerpt: "Learn how to create a stunning balloon arch with our easy step-by-step tutorial. Perfect for parties, weddings, and special events.",
    content: `
      <h2>Create Your Own Balloon Arch</h2>
      
      <p>Balloon arches are a fantastic way to add wow factor to any celebration. With this step-by-step guide, you'll be able to create a professional-looking balloon arch at home.</p>

      <h3>Materials You'll Need</h3>
      <ul>
        <li>Balloons in various sizes (5-inch, 11-inch, 16-inch)</li>
        <li>Balloon pump</li>
        <li>Balloon decorating strip</li>
        <li>Command hooks or balloon weights</li>
        <li>Ribbon or fishing line</li>
      </ul>

      <h3>Step 1: Prepare Your Balloons</h3>
      <p>Inflate your balloons to different sizes for a more dynamic look. Mix colors and sizes to create visual interest.</p>

      <h3>Step 2: Create the Base</h3>
      <p>Start by creating clusters of 4 balloons and tying them together. This will be the foundation of your arch.</p>

      <h3>Step 3: Build the Arch</h3>
      <p>Attach your balloon clusters to the decorating strip, alternating colors and sizes as you go.</p>

      <h3>Step 4: Secure and Shape</h3>
      <p>Once your arch is assembled, secure it in place and gently shape it into your desired curve.</p>

      <h3>Tips for Success</h3>
      <ul>
        <li>Work in sections to avoid overwhelming yourself</li>
        <li>Use a balloon pump to save time and energy</li>
        <li>Plan your color scheme before you start</li>
        <li>Have extra balloons on hand for repairs</li>
      </ul>
    `,
    featuredImage: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&h=600&fit=crop",
    author: "Emma Rodriguez",
    tags: ["DIY", "Balloon Arch", "Tutorial", "Party Decorations"],
    category: "DIY Projects",
    isPublished: true,
    isFeatured: true,
    publishedAt: new Date(),
    readTime: 6,
    metaDescription: "Learn how to create a stunning balloon arch with our easy step-by-step DIY tutorial. Perfect for parties and events.",
    seoKeywords: ["balloon arch tutorial", "DIY balloon decorations", "party decorations", "balloon crafts"]
  }
];

async function seedBlogData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing blog data (optional)
    // await Blog.deleteMany({});
    // console.log('Cleared existing blog data');

    // Insert sample blogs
    const insertedBlogs = await Blog.insertMany(sampleBlogs);
    console.log(`Successfully inserted ${insertedBlogs.length} blog posts`);

    console.log('Sample blog data seeded successfully!');
  } catch (error) {
    console.error('Error seeding blog data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seed function
seedBlogData();