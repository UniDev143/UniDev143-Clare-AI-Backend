// Seeds 11 varied products for the test brand.
// Variety is deliberate: every filter and scorer path gets exercised.
require('dotenv').config();
const mongoose = require('mongoose');
const Brand    = require('../models/Brand');
const Product  = require('../models/Product');

const CATALOG = [
  { name: 'Clear Skin Salicylic Cleanser', category: 'cleanser', price: 1450, budgetTier: 'low',
    description: 'Gentle foaming cleanser with 2% salicylic acid for blemish-prone skin.',
    buyLink: 'https://example.com/p/salicylic-cleanser',
    keyIngredients: ['Salicylic Acid 2%', 'Green Tea Extract'], priorityScore: 7,
    tags: { targetsIssues: ['acne','oiliness'], suitableFor: ['oily','combination'],
            severity: ['mild','moderate'], containsAllergens: ['aha_bha'] } },

  { name: 'Hydra Barrier Moisturizer', category: 'moisturizer', price: 2200, budgetTier: 'medium',
    description: 'Ceramide-rich daily moisturizer that repairs and calms the skin barrier.',
    buyLink: 'https://example.com/p/hydra-barrier',
    keyIngredients: ['Ceramides', 'Panthenol'], priorityScore: 6,
    tags: { targetsIssues: ['dryness','redness'], suitableFor: ['dry','sensitive','normal'],
            severity: ['all'], containsAllergens: [] } },

  { name: 'Niacinamide 10% Serum', category: 'serum', price: 2800, budgetTier: 'medium',
    description: 'Oil-balancing serum that fades marks and refines pores.',
    buyLink: 'https://example.com/p/niacinamide-serum',
    keyIngredients: ['Niacinamide 10%', 'Zinc PCA'], priorityScore: 8,
    tags: { targetsIssues: ['oiliness','dark_spots','acne'], suitableFor: ['oily','combination'],
            severity: ['mild','moderate'], containsAllergens: ['niacinamide'] } },

  { name: 'Retinol Renewal Night Serum', category: 'serum', price: 4500, budgetTier: 'high',
    description: 'Encapsulated retinol for fine lines and uneven tone, released overnight.',
    buyLink: 'https://example.com/p/retinol-night',
    keyIngredients: ['Retinol 0.3%', 'Squalane'], priorityScore: 7,
    tags: { targetsIssues: ['wrinkles','dark_spots'], suitableFor: ['normal','dry','combination'],
            severity: ['mild','moderate'], containsAllergens: ['retinol'] } },

  { name: 'Gentle Oat Cleanser', category: 'cleanser', price: 1200, budgetTier: 'low',
    description: 'Soap-free creamy cleanser with colloidal oat for easily-upset skin.',
    buyLink: 'https://example.com/p/oat-cleanser',
    keyIngredients: ['Colloidal Oatmeal', 'Glycerin'], priorityScore: 5,
    tags: { targetsIssues: ['redness','dryness'], suitableFor: ['sensitive','dry','normal'],
            severity: ['all'], containsAllergens: [] } },

  { name: 'Spot Rescue BHA Gel', category: 'spot_treatment', price: 950, budgetTier: 'low',
    description: 'Targeted overnight gel that shrinks active breakouts fast.',
    buyLink: 'https://example.com/p/spot-rescue',
    keyIngredients: ['Salicylic Acid', 'Tea Tree'], priorityScore: 6,
    tags: { targetsIssues: ['acne'], suitableFor: ['oily','combination','normal'],
            severity: ['moderate','severe'], containsAllergens: ['aha_bha'] } },

  { name: 'Vitamin C Brightening Serum', category: 'serum', price: 5200, budgetTier: 'high',
    description: 'Potent vitamin C to visibly fade dark spots and boost glow.',
    buyLink: 'https://example.com/p/vitamin-c',
    keyIngredients: ['Vitamin C 15%', 'Ferulic Acid'], priorityScore: 9,
    tags: { targetsIssues: ['dark_spots'], suitableFor: ['all'],
            severity: ['mild','moderate'], containsAllergens: ['fragrance'] } },

  { name: 'Eye Revive Cream', category: 'eye_cream', price: 3200, budgetTier: 'medium',
    description: 'Caffeine and peptide eye cream for tired-looking under-eyes.',
    buyLink: 'https://example.com/p/eye-revive',
    keyIngredients: ['Caffeine', 'Peptides'], priorityScore: 6,
    tags: { targetsIssues: ['dark_circles','wrinkles'], suitableFor: ['all'],
            severity: ['mild','moderate'], containsAllergens: [] } },

  { name: 'Oil-Balance Toner', category: 'toner', price: 1100, budgetTier: 'low',
    description: 'Light exfoliating toner that keeps shine in check through the day.',
    buyLink: 'https://example.com/p/oil-balance-toner',
    keyIngredients: ['Witch Hazel', 'PHA'], priorityScore: 5,
    tags: { targetsIssues: ['oiliness','acne'], suitableFor: ['oily','combination'],
            severity: ['mild'], containsAllergens: ['alcohol'] } },

  { name: 'Daily Shield SPF 50', category: 'sunscreen', price: 1900, budgetTier: 'medium',
    description: 'Weightless broad-spectrum sunscreen that prevents dark spots from deepening.',
    buyLink: 'https://example.com/p/daily-shield',
    keyIngredients: ['Zinc Oxide', 'Vitamin E'], priorityScore: 8,
    tags: { targetsIssues: ['dark_spots'], suitableFor: ['all'],
            severity: ['all'], containsAllergens: [] } },

  { name: 'Soothing Cica Mask', category: 'mask', price: 1600, budgetTier: 'medium',
    description: 'Weekly calming mask with centella for stressed, reactive skin.',
    buyLink: 'https://example.com/p/cica-mask',
    keyIngredients: ['Centella Asiatica', 'Madecassoside'], priorityScore: 5,
    tags: { targetsIssues: ['redness','dryness'], suitableFor: ['sensitive','dry'],
            severity: ['mild','moderate'], containsAllergens: [] } },
  
  { name: 'Deep Hydration Night Cream', category: 'moisturizer', price: 4800, budgetTier: 'high',
    description: 'Rich overnight cream with hyaluronic acid and shea for parched, mature skin.',
    buyLink: 'https://example.com/p/deep-hydration-night',
    keyIngredients: ['Hyaluronic Acid', 'Shea Butter', 'Squalane'], priorityScore: 7,
    tags: { targetsIssues: ['dryness','wrinkles'], suitableFor: ['dry','normal','sensitive'],
            severity: ['all'], containsAllergens: [] } },

  { name: 'Peptide Firming Serum', category: 'serum', price: 5500, budgetTier: 'high',
    description: 'Multi-peptide serum that supports firmness and softens fine lines.',
    buyLink: 'https://example.com/p/peptide-firming',
    keyIngredients: ['Matrixyl Peptides', 'Bakuchiol'], priorityScore: 8,
    tags: { targetsIssues: ['wrinkles'], suitableFor: ['all'],
            severity: ['mild','moderate','severe'], containsAllergens: [] } },

  { name: 'Hydra Boost Toner', category: 'toner', price: 1650, budgetTier: 'medium',
    description: 'Alcohol-free hydrating toner that preps dry skin without stripping.',
    buyLink: 'https://example.com/p/hydra-boost-toner',
    keyIngredients: ['Hyaluronic Acid', 'Rose Water'], priorityScore: 5,
    tags: { targetsIssues: ['dryness'], suitableFor: ['dry','sensitive','normal'],
            severity: ['all'], containsAllergens: [] } },

  { name: 'Rich Repair Eye Balm', category: 'eye_cream', price: 4200, budgetTier: 'high',
    description: 'Ceramide eye balm for crepey lines and dryness around the eyes.',
    buyLink: 'https://example.com/p/rich-repair-eye',
    keyIngredients: ['Ceramides', 'Vitamin E'], priorityScore: 6,
    tags: { targetsIssues: ['wrinkles','dryness','dark_circles'], suitableFor: ['dry','normal','sensitive'],
            severity: ['all'], containsAllergens: [] } },

  { name: 'Fragrance-Free Daily Sunscreen SPF 40', category: 'sunscreen', price: 1400, budgetTier: 'low',
    description: 'Mineral sunscreen with zero fragrance, made for reactive skin.',
    buyLink: 'https://example.com/p/ff-sunscreen',
    keyIngredients: ['Zinc Oxide', 'Niacinamide'], priorityScore: 7,
    tags: { targetsIssues: ['redness','dark_spots'], suitableFor: ['sensitive','all'],
            severity: ['all'], containsAllergens: ['niacinamide'] } },

  { name: 'Calm & Clear Gel Moisturizer', category: 'moisturizer', price: 1350, budgetTier: 'low',
    description: 'Featherweight gel moisture that hydrates oily skin without adding shine.',
    buyLink: 'https://example.com/p/calm-clear-gel',
    keyIngredients: ['Aloe Vera', 'Hyaluronic Acid'], priorityScore: 6,
    tags: { targetsIssues: ['oiliness','dryness'], suitableFor: ['oily','combination','sensitive'],
            severity: ['mild','moderate'], containsAllergens: [] } },

  { name: 'Charcoal Clay Mask', category: 'mask', price: 1250, budgetTier: 'low',
    description: 'Weekly deep-clean clay mask that pulls oil from congested pores.',
    buyLink: 'https://example.com/p/charcoal-clay',
    keyIngredients: ['Kaolin Clay', 'Charcoal'], priorityScore: 5,
    tags: { targetsIssues: ['oiliness','acne'], suitableFor: ['oily','combination'],
            severity: ['moderate','severe'], containsAllergens: [] } },

  { name: 'Brightening Eye Serum', category: 'eye_cream', price: 1550, budgetTier: 'low',
    description: 'Affordable vitamin-C eye serum for dark circles and dull under-eyes.',
    buyLink: 'https://example.com/p/brightening-eye',
    keyIngredients: ['Vitamin C', 'Caffeine'], priorityScore: 6,
    tags: { targetsIssues: ['dark_circles'], suitableFor: ['all'],
            severity: ['mild','moderate'], containsAllergens: [] } },

  { name: 'Overnight Renewal Retinal Cream', category: 'moisturizer', price: 5900, budgetTier: 'high',
    description: 'Advanced retinal night cream for pronounced lines and uneven texture.',
    buyLink: 'https://example.com/p/retinal-renewal',
    keyIngredients: ['Retinaldehyde', 'Ceramides'], priorityScore: 8,
    tags: { targetsIssues: ['wrinkles','dark_spots'], suitableFor: ['normal','dry'],
            severity: ['moderate','severe'], containsAllergens: ['retinol'] } },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const brand = await Brand.findOne({ email: 'brand@test.com' });
  if (!brand) { console.error('Test brand not found — register it first.'); process.exit(1); }

  await Product.deleteMany({ brandId: brand._id });
  const docs = await Product.insertMany(CATALOG.map(p => ({ ...p, brandId: brand._id })));

  console.log(`Seeded ${docs.length} products for ${brand.name}`);
  process.exit(0);
})();