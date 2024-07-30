import User from "../models/user.js";
import { createJWT, generateRefreshToken } from "../utils/index.js";
import bcryptjs from "bcryptjs";
import bcrypt from "bcryptjs";
import multer from 'multer';
import path from 'path';

const validateEmail = (email) => {
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
};

const validatePassword = (password) => {
  return password.length >= 8;
};

const validateInputs = (email, password) => {
  const errors = [];
  if (!validateEmail(email)) {
    errors.push("Invalid email format");
  }
  if (!validatePassword(password)) {
    errors.push("Password must be at least 8 characters long");
  }
  return errors;
};

export const registerUser = async (req, res) => {
  try {
    const { username, email, password, isAdmin, role, title } = req.body;

    // Validate inputs
    const errors = validateInputs(email, password);
    if (errors.length > 0) {
      return res.status(400).json({ status: false, message: errors.join(", ") });
    }

    // Check if user already exists
    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.status(400).json({
        status: false,
        message: "User already exists",
      });
    }

    // Hash the password
    const saltRounds = 10; // Ensure this is consistent
    const hashedPassword = await bcryptjs.hash(password, saltRounds);

    // Create the user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      isAdmin,
      role,
      title,
    });

    if (user) {
      const token = createJWT(user._id);
      const refreshToken = generateRefreshToken(user._id);

      return res.status(201).json({ user, token, refreshToken });
    } else {
      return res.status(400).json({ status: false, message: "Invalid user data" });
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ status: false, message: "Invalid email or password." });
    }

    // Check if the user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: false,
        message: "User account has been deactivated, contact the administrator",
      });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcryptjs.compare(password, user.password);

    // Log debugging information
    console.log("User:", user);
    console.log("Password Provided:", password);
    console.log("Hashed Password Stored:", user.password);
    //console.log("Salt Rounds:", saltRounds);
    console.log("Password Match:", isMatch);

    if (isMatch) {
      // Generate tokens if the password matches
      const token = createJWT(user._id);
      const refreshToken = generateRefreshToken(user._id);

      return res.status(200).json({ user, token, refreshToken });
    } else {
      return res.status(401).json({ status: false, message: "Invalid email or password" });
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};







export const logoutUser = async (req, res) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    });
    res.cookie("refreshToken", "", {
      httpOnly: true,
      expires: new Date(0),
    });

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

export const getTeamList = async (req, res) => {
  try {
    const users = await User.find().select("username title role email isActive");

    res.status(200).json(users);
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

export const getNotificationsList = async (req, res) => {
  try {
    const { userId } = req.user;

    const notice = await Notice.find({
      team: userId,
      isRead: { $nin: [userId] },
    }).populate("task", "title");

    res.status(201).json(notice);
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars'); // Directory to store uploaded files
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

export const updateUserProfile = async (req, res) => {
  try {
    const { userId, isAdmin } = req.user;
    const { _id } = req.body;

    const id =
      isAdmin && userId === _id
        ? userId
        : isAdmin && userId !== _id
        ? _id
        : userId;

    const user = await User.findById(id);

    if (user) {
      if (req.file) {
        user.avatar = req.file.path; // Save avatar path to user document
      }
      user.username = req.body.username || user.username;
      user.title = req.body.title || user.title;
      user.role = req.body.role || user.role;
      

      const updatedUser = await user.save();

      updatedUser.password = undefined;

      res.status(201).json({
        status: true,
        message: "Profile Updated Successfully.",
        user: updatedUser,
      });
    } else {
      res.status(404).json({ status: false, message: "User not found" });
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};
export const uploadAvatar = upload.single('avatar');

export const markNotificationRead = async (req, res) => {
  try {
    const { userId } = req.user;

    const { isReadType, id } = req.query;

    if (isReadType === "all") {
      await Notice.updateMany(
        { team: userId, isRead: { $nin: [userId] } },
        { $push: { isRead: userId } },
        { new: true }
      );
    } else {
      await Notice.findOneAndUpdate(
        { _id: id, isRead: { $nin: [userId] } },
        { $push: { isRead: userId } },
        { new: true }
      );
    }

    res.status(201).json({ status: true, message: "Done" });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

export const changeUserPassword = async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await User.findById(userId);

    if (user) {
      const isMatch = await user.matchPassword(req.body.currentPassword);
      if (!isMatch) {
        return res
          .status(400)
          .json({ status: false, message: "Current password is incorrect" });
      }

      user.password = req.body.newPassword;

      await user.save();

      user.password = undefined;

      res.status(201).json({
        status: true,
        message: "Password changed successfully.",
      });
    } else {
      res.status(404).json({ status: false, message: "User not found" });
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

export const activateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (user) {
      user.isActive = req.body.isActive;

      await user.save();

      res.status(201).json({
        status: true,
        message: `User account has been ${
          user.isActive ? "activated" : "deactivated"
        }`,
      });
    } else {
      res.status(404).json({ status: false, message: "User not found" });
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};

export const deleteUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    await User.findByIdAndDelete(id);

    res.status(200).json({ status: true, message: "User deleted successfully" });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};


/*export const verifyEmail = async (req, res) => {
  try {
    const { email, token } = req.body;

    const user = await User.findOne({ email, verificationToken: token });

    if (!user) {
      return res.status(400).json({
        status: false,
        message: "Invalid verification token or email",
      });
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;

    await user.save();

    res.status(200).json({ status: true, message: "Email verified successfully" });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ status: false, message: error.message });
  }
};*/
