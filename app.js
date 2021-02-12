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

const PORT = process.env.PORT;
const app = express();

var picture = String;
var name = String;

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

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
}).then(() => {
    console.log(`MongoDB is connected Successfully`);
}).catch((error) => {
    console.log(error);
});
mongoose.set('useCreateIndex', true);


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String
});
const noteSchema = new mongoose.Schema({
    title: String,
    description: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema)
const Note = new mongoose.model("Note", noteSchema)

passport.use(User.createStrategy());


passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID || 'dshksdhsdhhsdkj',
    clientSecret: process.env.CLIENT_SECRET || 'sihsdhdh',
    callbackURL: "http://localhost:3000/auth/google/savenotes",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
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
    // if (req.isAuthenticated()) {
    //     res.redirect("notes");
    // } else {
    //     res.render("home");
    // }

    res.redirect("notes");

});

/*------------------ Google Api For Account ------------------*/
app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/savenotes",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect home.

        res.redirect("/notes");
    });

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});
app.post("/register", async (req, res) => {
    const { username, password } = req.body
    const user = await User.findOne({ email: username })
    try {
        if (user) {
            res.send('User already registered')
        } else {
            const newUser = new User({
                email: username,
                password
            })
            await newUser.save();
        }
        res.status(200).redirect('/login');
    } catch (error) {
        console.log(`${error}`);
    }
});

app.get("/notes", (req, res) => {
    // if (req.isAuthenticated()) {
    //     res.render("notes", { profilePicture: picture, userName: name });
    // } else {
    //     res.redirect("login");
    // }

    res.render("notes", { profilePicture: picture, userName: name });

});
app.post('/notes', (req, res) => {
    const { title, description } = req.body;
    res.redirect('back')
})

/*------------------ Log out your Account ------------------*/
app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});


app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
})