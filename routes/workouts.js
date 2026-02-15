import express from "express";
import { body, param, query, validationResult } from "express-validator";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

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

function toObjectId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

const allowedIntensity = ["LOW", "MEDIUM", "HIGH"];

/**
 * POST /api/workouts
 * Owner = logged user
 */
router.post(
  "/",
  requireAuth,
  body("date")
    .notEmpty()
    .withMessage("date je obavezan.")
    .isISO8601()
    .withMessage("date mora biti ISO datum (YYYY-MM-DD)."),
  body("type")
    .notEmpty()
    .withMessage("type je obavezan.")
    .isString()
    .isLength({ min: 2, max: 30 })
    .withMessage("type mora biti 2-30 znakova."),
  body("durationMin")
    .notEmpty()
    .withMessage("durationMin je obavezan.")
    .isInt({ min: 1, max: 600 })
    .withMessage("durationMin mora biti 1-600."),
  body("intensity")
    .optional()
    .isIn(allowedIntensity)
    .withMessage("intensity mora biti LOW, MEDIUM ili HIGH."),
  body("notes")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("notes max 1000 znakova."),
  body("tags")
    .optional()
    .isArray({ max: 20 })
    .withMessage("tags mora biti array (max 20)."),
  body("tags.*")
    .optional()
    .isString()
    .isLength({ min: 1, max: 20 })
    .withMessage("svaki tag mora biti 1-20 znakova."),
  async (req, res, next) => {
    try {
      ensureValid(req);

      const db = await connectToDatabase();
      const workouts = db.collection("workouts");

      const userId = toObjectId(req.user.id);
      if (!userId) {
        res.status(401);
        throw new Error("Neispravan user id u tokenu.");
      }

      const { date, type, durationMin, intensity, notes, tags } = req.body;

      const doc = {
        userId,
        date: new Date(date), // ISO string -> Date
        type: String(type).trim(),
        durationMin: Number(durationMin),
        intensity: intensity ? String(intensity) : "MEDIUM",
        notes: notes ? String(notes) : "",
        tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()) : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await workouts.insertOne(doc);

      res.status(201).json({
        id: result.insertedId.toString(),
        ...doc,
        userId: doc.userId.toString(),
      });
    } catch (err) {
      if (err.statusCode) res.status(err.statusCode);
      next(err);
    }
  },
);

/**
 * GET /api/workouts
 * User dobiva samo svoje
 * (Opcionalno: filteri kasnije)
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const workouts = db.collection("workouts");

    const userId = toObjectId(req.user.id);
    if (!userId) {
      res.status(401);
      throw new Error("Neispravan user id u tokenu.");
    }

    const items = await workouts
      .find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    res.json(
      items.map((w) => ({
        ...w,
        id: w._id.toString(),
        _id: undefined,
        userId: w.userId.toString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/workouts/:id
 * User samo svoj
 */
router.get(
  "/:id",
  requireAuth,
  param("id").notEmpty().withMessage("id je obavezan."),
  async (req, res, next) => {
    try {
      ensureValid(req);

      const workoutId = toObjectId(req.params.id);
      if (!workoutId) {
        res.status(400);
        throw new Error("Neispravan workout id.");
      }

      const userId = toObjectId(req.user.id);
      if (!userId) {
        res.status(401);
        throw new Error("Neispravan user id u tokenu.");
      }

      const db = await connectToDatabase();
      const workouts = db.collection("workouts");

      const workout = await workouts.findOne({ _id: workoutId, userId });

      // Ako ne postoji pod tim userom, može biti:
      // - ne postoji uopće
      // - postoji ali nije njegov -> to tretiramo kao 403 (owner rule)
      if (!workout) {
        const exists = await workouts.findOne(
          { _id: workoutId },
          { projection: { _id: 1 } },
        );
        if (exists) {
          res.status(403);
          throw new Error("Nemate pravo pristupa ovom workoutu.");
        }
        res.status(404);
        throw new Error("Workout ne postoji.");
      }

      res.json({
        ...workout,
        id: workout._id.toString(),
        _id: undefined,
        userId: workout.userId.toString(),
      });
    } catch (err) {
      if (err.statusCode) res.status(err.statusCode);
      next(err);
    }
  },
);

/**
 * PATCH /api/workouts/:id
 * User samo svoj
 */
router.patch(
  "/:id",
  requireAuth,
  param("id").notEmpty().withMessage("id je obavezan."),
  body("date")
    .optional()
    .isISO8601()
    .withMessage("date mora biti ISO datum (YYYY-MM-DD)."),
  body("type")
    .optional()
    .isString()
    .isLength({ min: 2, max: 30 })
    .withMessage("type mora biti 2-30 znakova."),
  body("durationMin")
    .optional()
    .isInt({ min: 1, max: 600 })
    .withMessage("durationMin mora biti 1-600."),
  body("intensity")
    .optional()
    .isIn(allowedIntensity)
    .withMessage("intensity mora biti LOW, MEDIUM ili HIGH."),
  body("notes")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("notes max 1000 znakova."),
  body("tags")
    .optional()
    .isArray({ max: 20 })
    .withMessage("tags mora biti array (max 20)."),
  body("tags.*")
    .optional()
    .isString()
    .isLength({ min: 1, max: 20 })
    .withMessage("svaki tag mora biti 1-20 znakova."),
  async (req, res, next) => {
    try {
      ensureValid(req);

      const workoutId = toObjectId(req.params.id);
      if (!workoutId) {
        res.status(400);
        throw new Error("Neispravan workout id.");
      }

      const userId = toObjectId(req.user.id);
      if (!userId) {
        res.status(401);
        throw new Error("Neispravan user id u tokenu.");
      }

      const patch = {};
      if (req.body.date !== undefined) patch.date = new Date(req.body.date);

      if (req.body.type !== undefined)
        patch.type = String(req.body.type).trim();

      if (req.body.durationMin !== undefined)
        patch.durationMin = Number(req.body.durationMin);

      if (req.body.intensity !== undefined)
        patch.intensity = String(req.body.intensity);

      if (req.body.notes !== undefined) patch.notes = String(req.body.notes);

      if (req.body.tags !== undefined)
        patch.tags = Array.isArray(req.body.tags)
          ? req.body.tags.map((t) => String(t).trim())
          : [];

      patch.updatedAt = new Date();

      const db = await connectToDatabase();
      const workouts = db.collection("workouts");

      const updateRes = await workouts.updateOne(
        { _id: workoutId, userId },
        { $set: patch },
      );

      if (updateRes.matchedCount === 0) {
        const exists = await workouts.findOne(
          { _id: workoutId },
          { projection: { _id: 1 } },
        );
        if (exists) {
          res.status(403);
          throw new Error("Nemate pravo uređivanja ovog workouta.");
        }
        res.status(404);
        throw new Error("Workout ne postoji.");
      }

      const w = await workouts.findOne({ _id: workoutId, userId });

      res.json({
        ...w,
        id: w._id.toString(),
        _id: undefined,
        userId: w.userId.toString(),
      });

      res.json({
        ...w,
        id: w._id.toString(),
        _id: undefined,
        userId: w.userId.toString(),
      });
    } catch (err) {
      if (err.statusCode) res.status(err.statusCode);
      next(err);
    }
  },
);

/**
 * DELETE /api/workouts/:id
 * User samo svoj
 */
router.delete(
  "/:id",
  requireAuth,
  param("id").notEmpty().withMessage("id je obavezan."),
  async (req, res, next) => {
    try {
      ensureValid(req);

      const workoutId = toObjectId(req.params.id);
      if (!workoutId) {
        res.status(400);
        throw new Error("Neispravan workout id.");
      }

      const userId = toObjectId(req.user.id);
      if (!userId) {
        res.status(401);
        throw new Error("Neispravan user id u tokenu.");
      }

      const db = await connectToDatabase();
      const workouts = db.collection("workouts");

      const result = await workouts.deleteOne({ _id: workoutId, userId });

      if (result.deletedCount === 0) {
        const exists = await workouts.findOne(
          { _id: workoutId },
          { projection: { _id: 1 } },
        );
        if (exists) {
          res.status(403);
          throw new Error("Nemate pravo brisanja ovog workouta.");
        }
        res.status(404);
        throw new Error("Workout ne postoji.");
      }

      res.status(204).send();
    } catch (err) {
      if (err.statusCode) res.status(err.statusCode);
      next(err);
    }
  },
);

export default router;
