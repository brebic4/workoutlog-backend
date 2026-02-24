import express from "express";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../config/db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { body, param, validationResult } from "express-validator";

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

/**
 * GET /api/admin/workouts
 * Admin vidi sve workoutove
 */
router.get("/workouts", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const workoutsCol = db.collection("workouts");
    const usersCol = db.collection("users");

    const items = await workoutsCol.find({}).sort({ date: -1 }).toArray();

    const userIdStrings = [
      ...new Set(items.map((w) => w.userId?.toString()).filter(Boolean)),
    ];
    const userObjectIds = userIdStrings.map((id) => new ObjectId(id));

    const users = await usersCol
      .find({ _id: { $in: userObjectIds } })
      .project({ email: 1 })
      .toArray();

    const userEmailById = new Map(
      users.map((u) => [u._id.toString(), u.email]),
    );

    res.json(
      items.map((w) => ({
        ...w,
        id: w._id.toString(),
        _id: undefined,
        userId: w.userId?.toString(),
        userEmail: userEmailById.get(w.userId?.toString()) || null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/workouts/:id
 * Admin može obrisati bilo koji workout
 */
router.delete(
  "/workouts/:id",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const workoutId = new ObjectId(req.params.id);

      const db = await connectToDatabase();
      const workouts = db.collection("workouts");

      const result = await workouts.deleteOne({ _id: workoutId });

      if (result.deletedCount === 0) {
        res.status(404);
        throw new Error("Workout ne postoji.");
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/admin/workouts/:id
 * Admin može ažurirati bilo koji workout
 */
router.patch(
  "/workouts/:id",
  requireAuth,
  requireAdmin,
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
  body("notes")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("notes max 1000 znakova."),
  async (req, res, next) => {
    try {
      ensureValid(req);

      const workoutId = new ObjectId(req.params.id);

      const patch = {};
      if (req.body.date !== undefined) patch.date = new Date(req.body.date);
      if (req.body.type !== undefined)
        patch.type = String(req.body.type).trim();
      if (req.body.durationMin !== undefined)
        patch.durationMin = Number(req.body.durationMin);
      if (req.body.notes !== undefined) patch.notes = String(req.body.notes);

      patch.updatedAt = new Date();

      const db = await connectToDatabase();
      const workouts = db.collection("workouts");

      const updateRes = await workouts.updateOne(
        { _id: workoutId },
        { $set: patch },
      );

      if (updateRes.matchedCount === 0) {
        res.status(404);
        throw new Error("Workout ne postoji.");
      }

      const w = await workouts.findOne({ _id: workoutId });

      res.json({
        ...w,
        id: w._id.toString(),
        _id: undefined,
        userId: w.userId?.toString(),
      });
    } catch (err) {
      if (err.statusCode) res.status(err.statusCode);
      next(err);
    }
  },
);

function parseRangeToFromDate(range) {
  const now = new Date();

  if (!range) return null;

  const r = String(range).toLowerCase();
  if (r === "3d") return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  if (r === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (r === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 3m = 3 mjeseca unazad (kalendarski)
  if (r === "3m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d;
  }

  return null;
}

/**
 * GET /api/admin/stats?range=3d|7d|30d|3m
 * Agregirane statistike s range filterom
 */
router.get("/stats", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const workouts = db.collection("workouts");

    const range = req.query.range || "30d";
    const fromDate = parseRangeToFromDate(range);

    const matchStage = fromDate
      ? { $match: { date: { $gte: fromDate } } }
      : { $match: {} };

    const [result] = await workouts
      .aggregate([
        matchStage,
        {
          $addFields: {
            // normalizacija za statistike (free text ostaje)
            typeNorm: {
              $toLower: {
                $trim: { input: "$type" },
              },
            },
          },
        },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalWorkouts: { $sum: 1 },
                  totalMinutes: { $sum: "$durationMin" },
                  avgMinutesPerWorkout: { $avg: "$durationMin" },
                },
              },
            ],
            byType: [
              {
                $group: {
                  _id: "$typeNorm",
                  count: { $sum: 1 },
                  minutes: { $sum: "$durationMin" },
                },
              },
              { $sort: { count: -1 } },
            ],
            mostActiveUser: [
              {
                $group: {
                  _id: "$userId",
                  minutes: { $sum: "$durationMin" },
                  workouts: { $sum: 1 },
                },
              },
              { $sort: { minutes: -1 } },
              { $limit: 1 },
              {
                $lookup: {
                  from: "users",
                  localField: "_id",
                  foreignField: "_id",
                  as: "user",
                },
              },
              { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: 0,
                  userId: { $toString: "$_id" },
                  email: "$user.email",
                  minutes: 1,
                  workouts: 1,
                },
              },
            ],
            durationBuckets: [
              {
                $bucket: {
                  groupBy: "$durationMin",
                  boundaries: [0, 31, 61, 91, 121, 1000000],
                  default: "121+",
                  output: { count: { $sum: 1 } },
                },
              },
            ],
          },
        },
      ])
      .toArray();

    const totals = result?.totals?.[0] || {
      totalWorkouts: 0,
      totalMinutes: 0,
      avgMinutesPerWorkout: 0,
    };

    const byType = result?.byType || [];
    const topType = byType.length ? byType[0]._id : "-";

    const mostActiveUser = result?.mostActiveUser?.[0] || null;

    // bucket label map
    const bucketLabel = (id) => {
      if (id === 0) return "0-30";
      if (id === 31) return "31-60";
      if (id === 61) return "61-90";
      if (id === 91) return "91-120";
      return "121+";
    };

    const durationBuckets = (result?.durationBuckets || []).map((b) => ({
      label: bucketLabel(b._id),
      count: b.count || 0,
    }));

    res.json({
      range,
      from: fromDate ? fromDate.toISOString() : null,
      totalWorkouts: totals.totalWorkouts,
      totalMinutes: totals.totalMinutes,
      avgMinutesPerWorkout: Number(
        (totals.avgMinutesPerWorkout || 0).toFixed(1),
      ),
      topType,
      byType, // top 6 i dalje radi
      durationBuckets,
      mostActiveUser,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
