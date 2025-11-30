
const express = require("express");
const app = express();
const userModel = require("./models/user");
const postModel = require('./models/post');
const cookieParser = require("cookie-parser");
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const connectDB = require("./config/db.js");
connectDB();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

app.get('/', (req,res) =>{
res.render("index");
});

app.get('/login', (req,res) =>{
res.render("login");
});

app.get('/profile', isloggedIn, async (req,res) =>{
  let user = await userModel.findOne({email: req.user.email}).populate("posts");
  console.log(user.posts);
  res.render("profile", {user});
});

app.get('/like/:id', isloggedIn, async (req,res) =>{
  let post = await postModel.findOne({_id: req.params.id}).populate("user");
if(post.likes.indexOf(req.user.userid) === -1){
  post.likes.push(req.user.userid);
}
else{
  post.likes.splice(post.likes.indexOf(req.user.userid), 1);
}

 await post.save();
  res.redirect("/profile");
});

app.get('/edit/:id', isloggedIn, async (req,res) =>{
  let post = await postModel.findOne({_id: req.params.id}).populate("user");
  res.render("edit", {post});
});

app.post('/update/:id', isloggedIn, async (req,res) =>{
  let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content})
  res.redirect("/profile");
});

app.post('/delete/:id', isloggedIn, async (req, res) => {
  const post = await postModel.findById(req.params.id);
  if (!post) return res.status(404).send("Post not found");
  if (post.user.toString() !== req.user.userid.toString()) {
    return res.status(403).send("Unauthorized: You can't delete this post");
  }
  await postModel.findByIdAndDelete(req.params.id);
  await userModel.updateOne(
    { _id: req.user.userid },
    { $pull: { posts: req.params.id } }
  );
  res.redirect("/profile");
});




app.post('/post', isloggedIn, async (req,res) =>{
  let user = await userModel.findOne({email: req.user.email});
  let {content} = req.body;
  let post = await postModel.create({
    user: user._id,
    content
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

app.post('/register', async (req,res) =>
  {
   let {email, password, username, name, age} = req.body;
   let user = await userModel.findOne({email});
   if(user) return res.status(500).send("User already registered");

   bcrypt.genSalt(10, (err , salt) =>{
   bcrypt.hash(password, salt, async (err, hash) =>{
    let user = await userModel.create({
      username,
      name,
      email,
      age,
      password: hash

    });
    let token = jwt.sign({email: email, userid: user._id}, "shhhhh");
   res.cookie("token", token);
  res.redirect("/profile");

   })
   })

  });

  app.post('/login', async (req,res) =>
  {
   let {email, password} = req.body;
   let user = await userModel.findOne({email});
   if(!user) return res.status(500).send("Something went wrong");

   bcrypt.compare(password, user.password, (err, result) =>{
    if(result){
           let token = jwt.sign({email: email, userid: user._id}, "shhhhh");
           res.cookie("token", token);
           return res.status(200).redirect("/profile");
    } 
    else res.redirect("/login");
   })
  });

app.get('/logout', (req,res) =>{
  res.cookie("token", "")
res.redirect("/login");
});

function isloggedIn(req, res, next){
  if(req.cookies.token === "") res.redirect("/login");
  else{
    let data = jwt.verify(req.cookies.token, "shhhhh");
    req.user = data;
  }
  next();
}





app.listen(3000); 