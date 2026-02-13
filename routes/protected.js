import express from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/user-only", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

router.get("/admin-only", requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, admin: true, user: req.user });
});

export default router;
