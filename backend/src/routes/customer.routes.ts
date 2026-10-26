import { Router } from "express";
import { CustomerController } from "../controllers/customer.controller";
import { authMiddleware, adminOnly } from "../middlewares/auth.middleware";

const router = Router();

console.log("Customer routes loaded");

router.get("/customers", authMiddleware, CustomerController.getAll);
router.put("/customers/:id", authMiddleware, adminOnly, CustomerController.update);
router.post("/customers", authMiddleware, adminOnly, CustomerController.create);
router.delete("/customers/:id", authMiddleware, adminOnly, CustomerController.delete);
router.patch("/customers/:id/status", authMiddleware, adminOnly, CustomerController.updateStatus);

export default router;