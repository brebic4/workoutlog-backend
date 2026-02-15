import express from "express";
import { connectToDatabase } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/error.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import protectedRouter from "./routes/protected.js";
import workoutsRouter from "./routes/workouts.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/protected", protectedRouter);
app.use("/api/workouts", workoutsRouter);

const db = await connectToDatabase();

//Početna ruta
app.get("/", (req, res) => {
  res.status(200).json({ message: "Backend uspješno radi!" });
});

// Route middleware
app.use(notFound);
app.use(errorHandler);

//Pokretanje poslužitelja
app.listen(PORT, (error) => {
  if (error) {
    console.error(`Greška prilikom pokretanja poslužitelja: ${error.message}`);
  } else {
    console.log(`Server je pokrenut na http://localhost:${PORT}`);
  }
});
