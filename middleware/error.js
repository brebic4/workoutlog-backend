export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Ruta nije pronađena: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, next) {
  const statusCode =
    err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  res.status(statusCode).json({
    error: {
      message: err.message,
      status: statusCode,
    },
  });
}
