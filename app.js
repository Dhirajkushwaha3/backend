
require("dotenv").config();
const express = require("express");
const app = express();

const userModel = require("./models/User");
const postModel = require("./models/Post");

const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");

/* -------------------- ENV CHECK -------------------- */
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET missing in .env");
}

/* -------------------- DB -------------------- */
connectDB();

/* -------------------- MIDDLEWARE -------------------- */
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

/* -------------------- AUTH MIDDLEWARE -------------------- */
function isLoggedIn(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) return res.redirect("/login");
    const decoded = jwt.verify(token, JWT_SECRET); 
    req.user = decoded;
    next();
  } catch (err) {
    res.redirect("/login");
  }
}

/* -------------------- ROUTES -------------------- */

app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));

/* -------------------- PROFILE -------------------- */
app.get("/profile", isLoggedIn, async (req, res) => {
  try {

   if (!req.user || !req.user.userid) {
      return res.redirect("/login");
    }
    const user = await userModel
      .findById(req.user.userid)
      .populate("posts");

    res.render("profile", { user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error" + err.message);
  }
});

/* -------------------- CREATE POST -------------------- */
app.post("/post", isLoggedIn, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.redirect("/profile");

    const post = await postModel.create({
      user: req.user.userid,
      content,
    });

    await userModel.findByIdAndUpdate(req.user.userid, {
      $push: { posts: post._id },
    });

    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* -------------------- LIKE / UNLIKE -------------------- */
app.post("/like/:id", isLoggedIn, async (req, res) => {
  try {
    const post = await postModel.findById(req.params.id);
    if (!post) return res.redirect("/profile");

    const userId = req.user.userid;
    const index = post.likes.findIndex(
      id => id.toString() === userId
    );

    if (index === -1) post.likes.push(userId);
    else post.likes.splice(index, 1);

    await post.save();
    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  const { content } = req.body;
  await postModel.findByIdAndUpdate(
    {_id: req.params.id, user: req.user.userid}, { content }
  );
  res.redirect("/profile");
});

/* -------------------- edit -------------------- */
app.get("/edit/:id", isLoggedIn, async (req, res) => {
  const post = await postModel.findById(req.params.id);
  if(!post || post.user.toString() !== req.user.userid){
  return res.redirect("/profile"); 
  }
  res.render("edit", {post});
});

/* -------------------- DELETE POST -------------------- */
app.post("/delete/:id", isLoggedIn, async (req, res) => {
  try {
   
    await postModel.findOneAndDelete({ _id: req.params.id, user: req.user.userid });

    
    await userModel.findByIdAndUpdate(req.user.userid, {
      $pull: { posts: req.params.id }
    });

    res.redirect("/profile");
  } catch (err) {
    res.status(500).send("Delete failed");
  }
});


/* -------------------- REGISTER -------------------- */
app.post("/register", async (req, res) => {
  try {

    console.log("Data received from form:", req.body);
    const { username, name, email, age, password } = req.body;

    if (!email || !password || password.length < 6) {
      return res.status(400).send("Invalid input");
    }

    if (await userModel.findOne({ email })) {
      return res.status(400).send("User already exists");
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await userModel.create({
      username,
      name,
      email,
      age,
      password: hash,
    });

    const token = jwt.sign(
    { userid: user._id, email: user.email }, 
  JWT_SECRET,
  { expiresIn: "7d" }
    );

    res.cookie("token", token, { httpOnly: true });
    res.redirect("/profile");
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).send(err.message);
  }
});

/* -------------------- LOGIN -------------------- */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) {
      console.log("user not found in DB");
      return res.status(400).send("Invalid credentials");
  }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send("Invalid credentials");

    const token = jwt.sign(
      { userid: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, { httpOnly: true });
    res.redirect("/profile");
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).send(err.message);
  }
});

/* -------------------- LOGOUT -------------------- */
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

/* -------------------- SERVER -------------------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
