import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// standardni validation error
function ensureValid(req) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join(" | ");
    const err = new Error(message);
    err.statusCode = 400;
    throw err;
  }
}

// POST /api/auth/register
router.post(
  "/register",
  body("email")
    .isEmail()
    .withMessage("Email nije ispravan.")
    .normalizeEmail({ gmail_remove_dots: false }), //ugasi opciju da si miču točke (dots) prije @.
  body("password")
    .isString()
    .withMessage("Lozinka je obavezna.")
    .isLength({ min: 8 })
    .withMessage("Lozinka mora imati barem 8 znakova.")
    .matches(/[A-Za-z]/)
    .withMessage("Lozinka mora sadržavati barem jedno slovo.")
    .matches(/[0-9]/)
    .withMessage("Lozinka mora sadržavati barem jedan broj."),
  async (req, res, next) => {
    try {
      ensureValid(req);

      const { email, password } = req.body;

      const db = await connectToDatabase();
      const users_collection = db.collection("users");

      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = {
        email, // normalizeEmail() je već normalizirao
        passwordHash,
        role: "USER",
        createdAt: new Date(),
      };

      let result;
      try {
        result = await users_collection.insertOne(newUser);
      } catch (e) {
        // UNIQUE index na email -> duplicate key, MongoDB baca error 11000 kada je duplicate key
        if (e?.code === 11000) {
          return res.status(409).json({
            error: { message: "Email već postoji.", status: 409 },
          });
        }
        throw e;
      }

      res.status(201).json({
        message: "Korisnik uspješno registriran. Molimo prijavite se.",
        user: {
          id: result.insertedId.toString(),
          email: newUser.email,
        },
      });
    } catch (err) {
      if (err.statusCode) res.status(err.statusCode);
      next(err);
    }
  },
);

// POST /api/auth/login
router.post(
  "/login",
  body("email")
    .isEmail()
    .withMessage("Email nije ispravan.")
    .normalizeEmail({ gmail_remove_dots: false }), //ugasi opciju da si miču točke (dots) prije @.
  body("password")
    .isString()
    .withMessage("Lozinka je obavezna.")
    .notEmpty()
    .withMessage("Lozinka je obavezna."),
  async (req, res, next) => {
    try {
      ensureValid(req);

      const { email, password } = req.body;

      const db = await connectToDatabase();
      const users_collection = db.collection("users");

      const user = await users_collection.findOne({ email });

      if (!user) {
        res.status(401);
        throw new Error("Pogrešan email ili lozinka.");
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        res.status(401);
        throw new Error("Pogrešan email ili lozinka.");
      }

      const token = jwt.sign(
        { sub: user._id.toString(), role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "12h" },
      );

      res.status(200).json({
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      if (err.statusCode) res.status(err.statusCode);
      next(err);
    }
  },
);

// PATCH /api/auth/password
// Ulogirani korisnik mijenja lozinku -> nakon toga frontend radi logout
router.patch(
  "/password",
  requireAuth,
  body("newPassword")
    .notEmpty()
    .withMessage("Nova lozinka je obavezna.")
    .isString()
    .isLength({ min: 8 })
    .withMessage("Nova lozinka mora imati najmanje 8 znakova.")
    .matches(/[A-Za-z]/)
    .withMessage("Lozinka mora sadržavati barem jedno slovo.")
    .matches(/[0-9]/)
    .withMessage("Lozinka mora sadržavati barem jedan broj."),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors });
      }

      const userId = ObjectId.isValid(req.user.id)
        ? new ObjectId(req.user.id)
        : null;
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Neispravan user id u tokenu." });
      }

      const db = await connectToDatabase();
      const users = db.collection("users");

      const user = await users.findOne({ _id: userId });
      if (!user) {
        return res.status(401).json({ message: "Korisnik ne postoji." });
      }

      const newPassword = String(req.body.newPassword);

      // zabrani istu lozinku
      const same = await bcrypt.compare(newPassword, user.passwordHash);
      if (same) {
        return res
          .status(400)
          .json({ message: "Nova lozinka mora biti drugačija." });
      }

      const newHash = await bcrypt.hash(newPassword, 10);

      await users.updateOne(
        { _id: userId },
        { $set: { passwordHash: newHash, updatedAt: new Date() } },
      );

      return res
        .status(204)
        .json({
          message:
            "Lozinka uspješno promijenjena. Molimo ponovno se prijavite.",
        });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/auth/me */
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const users_collection = db.collection("users");

    const user = await users_collection.findOne(
      { _id: new ObjectId(req.user.id) },
      { projection: { passwordHash: 0 } },
    );

    if (!user) {
      res.status(404);
      throw new Error("Korisnik ne postoji.");
    }

    res.json({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
