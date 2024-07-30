import express from "express";
import userRoutes from "./userRoutes.js";
import taskRoutes from "./taskRoutes.js";
import { uploadAvatar, updateUserProfile } from "../controllers/userController.js";
import { protectRoute } from "../middlewares/authMiddlewave.js"; 

const router = express.Router();

router.use("/user", userRoutes); 
router.use("/task", taskRoutes);
router.put("/update-profile", protectRoute, uploadAvatar, updateUserProfile);

export default router;
