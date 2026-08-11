const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getProducts, getProduct, createProduct,
  updateProduct, toggleProduct, deleteProduct,
} = require('../controllers/productController');

router.use(protect);   // every product route requires a logged-in brand admin

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id/toggle', toggleProduct);
router.delete('/:id', deleteProduct);

module.exports = router;