import accessRoutes from "./routes/access.routes";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import customerRoutes from "./routes/customer.routes";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api", customerRoutes);
app.get("/test", (_req, res) => {
  res.send("Backend OK");
});

app.use('/api', accessRoutes);
app.use((_req, res) => {res.status(404).json({message:'API route not found'});});
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
 console.error(error instanceof Error ? error.message : 'Server error');
 res.status(500).json({message:'Internal server error'});
});
export default app;