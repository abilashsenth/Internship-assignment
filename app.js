require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const ipfsClient = require("ipfs-http-client");
const CID = require("cids");

const ipfs = ipfsClient.create({
  host: "localhost",
  port: "5001",
  protocol: "http",
});

const app = express();
app.use(express.static(__dirname + "/public"));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload());

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/saarvidUserDB", {
  useNewUrlParser: true,
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const fileSchema = new mongoose.Schema({
  fileName: String,
  fileHash: String,
  uploadedBy: String,
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);
const File = new mongoose.model("File", fileSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//get requests
app.get("/", function (req, res) {
  res.render("home");
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/uploadfile", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("upload_file");
  } else {
    res.redirect("/login");
  }
});

app.get("/requestfile", function (req, res) {
  if (req.isAuthenticated()) {
    File.find({}, function (err, files) {
      if (err) {
        console.log(err);
      } else {
        console.log(files);
        res.render("request_file", { files: files });
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/viewrequests", function (req, res) {
  if (req.isAuthenticated()) {
    File.find({}, function (err, files) {
      if (err) {
        console.log(err);
      } else {
        console.log(files);
        //res.render("view_requests", { files: files });
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function (req, res) {
  //log out user
  req.logOut();
  res.redirect("/");
});

//post requests

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  //use passport to login and auth
  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/uploadfile");
      });
    }
  });
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/requestFile", function (req, res) {
  console.log(req.body);
  const fileHash = req.body.requestbutton;
  const fileName = req.body.filename;
  res.render("upload", { fileHash: fileHash, fileName: fileName });
});

app.post("/uploadFile", (req, res) => {
  const file = req.files.file;
  const fileName = req.files.file.name;
  const filePath = req.files.file.name;

  file.mv(filePath, async (err) => {
    if (err) {
      console.log("error : while uploading file");
      return res.status(500).send(err);
    }
    const fileHash = await addIpfsFile(fileName, filePath);
    fs.unlink(filePath, (err) => {
      if (err) console.log(err);
    });
    console.log(fileHash);
    const file = new File({
      fileName: fileName,
      fileHash: fileHash,
      uploadedBy: req.user.username,
    });
    file.save();
    res.render("upload", { fileName, fileHash });
  });
});

const addIpfsFile = async (fileName, filePath) => {
  const file = fs.readFileSync(filePath);
  const fileAdded = await ipfs.add({ path: fileName, content: file });
  const { cid } = fileAdded;
  return cid;
};

//listen
app.listen(process.env.PORT || "3000", function () {
  console.log("server started on port 3000");
});
