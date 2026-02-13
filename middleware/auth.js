import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const [type, token] = auth.split(" ");

    if (type !== "Bearer" || !token) {
      res.status(401);
      throw new Error("Nedostaje Bearer token.");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    next();
  } catch (err) {
    res.status(401);
    next(new Error("Neispravan ili istekao token."));
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    res.status(401);
    return next(new Error("Niste prijavljeni."));
  }
  if (req.user.role !== "ADMIN") {
    res.status(403);
    return next(new Error("Nemate admin ovlasti."));
  }
  next();
}
