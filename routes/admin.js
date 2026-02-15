import express from "express";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../config/db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/admin/workouts
 * Admin vidi sve workoutove
 */
router.get("/workouts", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const workouts = db.collection("workouts");

    const items = await workouts.find({}).sort({ date: -1 }).toArray();

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
 * GET /api/admin/stats
 * Agregirane statistike
 */
router.get("/stats", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const workouts = db.collection("workouts");

    const total = await workouts.countDocuments();

    const byType = await workouts
      .aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const byIntensity = await workouts
      .aggregate([{ $group: { _id: "$intensity", count: { $sum: 1 } } }])
      .toArray();

    res.json({
      totalWorkouts: total,
      byType,
      byIntensity,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
