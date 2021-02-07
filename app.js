//jshint esversion:6
require('dotenv').config(); //This package is to store our key in .env file and (that key helps us to encrypt our users password)
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const _ = require("lodash");
const path = require('path');
const nodemailer = require("nodemailer");
const passportLocalMongoose = require("passport-local-mongoose"); // use this for security like password will salted and hashed.
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

var picture = String;
var name = String;

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "Our Little Secret",
    resave: false,
    saveUninitialized: false
}));


app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_DB_ADDRESS, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
mongoose.set('useCreateIndex', true);


const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema)

passport.use(User.createStrategy());


passport.serializeUser(function(user, done) {
    done(null, user.id);
});
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/savenotes",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
    });
    picture = profile._json.picture;
    name = profile._json.name;
    return (picture, name);
  }
));


app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect("notes");
    } else {
        res.render("home");
    }
});

/*------------------ Google Api For Account ------------------*/
app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/savenotes", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    
    res.redirect("/notes");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/notes", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("notes", {profilePicture: picture, userName: name});
    } else {
        res.redirect("login");
    }
});

/*------------------ Log out your Account ------------------*/
app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
});


app.listen(3000, function() {
    console.log("Server started at port 3000");
});