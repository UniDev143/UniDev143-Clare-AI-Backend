const Product = require('../models/Product');
const { sendSuccess, sendError } = require('../middleware/response');

// GET /api/products — all products for the logged-in brand
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ brandId: req.admin.brandId })
      .sort({ isActive: -1, category: 1, name: 1 });
    sendSuccess(res, products);
  } catch (err) {
    sendError(res, 'Could not load products', 500);
  }
};

// GET /api/products/:id
const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id, brandId: req.admin.brandId,
    });
    if (!product) return sendError(res, 'Product not found', 404);
    sendSuccess(res, product);
  } catch (err) {
    sendError(res, 'Could not load product', 500);
  }
};

// POST /api/products
const createProduct = async (req, res) => {
  try {
    const product = await Product.create({ ...req.body, brandId: req.admin.brandId });
    sendSuccess(res, product, 'Product created', 201);
  } catch (err) {
    sendError(res, err.message, 400);
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const { brandId, _id, ...updates } = req.body;   // never trust these from the client
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, brandId: req.admin.brandId },
      updates,
      { new: true, runValidators: true }
    );
    if (!product) return sendError(res, 'Product not found', 404);
    sendSuccess(res, product, 'Product updated');
  } catch (err) {
    sendError(res, err.message, 400);
  }
};

// PATCH /api/products/:id/toggle
const toggleProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id, brandId: req.admin.brandId,
    });
    if (!product) return sendError(res, 'Product not found', 404);
    product.isActive = !product.isActive;
    await product.save();
    sendSuccess(res, product, product.isActive ? 'Product activated' : 'Product deactivated');
  } catch (err) {
    sendError(res, 'Could not toggle product', 500);
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id, brandId: req.admin.brandId,
    });
    if (!product) return sendError(res, 'Product not found', 404);
    sendSuccess(res, { deleted: true }, 'Product deleted');
  } catch (err) {
    sendError(res, 'Could not delete product', 500);
  }
};

module.exports = {
  getProducts, getProduct, createProduct,
  updateProduct, toggleProduct, deleteProduct,
};