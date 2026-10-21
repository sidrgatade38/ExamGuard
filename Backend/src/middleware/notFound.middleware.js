/**
 * 404 Not Found Middleware
 */
const notFound = (req, res, next) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};

module.exports = notFound;
