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
const { lowerFirst } = require('lodash');

const app = express();

var picture = String;
var name = String;
var gId = String;

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

mongoose.connect("mongodb://localhost:27017/SaveNotes", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
mongoose.set('useCreateIndex', true);


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    notes: [{
        noteTitle: String,
        mainNote: String
    }]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema)

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
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/savenotes",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id, username: profile.emails[0].value }, function (err, user) {
            return cb(err, user);
        });
        picture = profile._json.picture;
        name = profile._json.name;
        gId = profile.id;
        return (picture, name, gId);
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
    passport.authenticate("google", { scope: ['profile',"email"] })
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

app.get("/notes", (req, res) => {
    if (req.isAuthenticated()) {
        User.find({ googleId: gId }, function (err, notes) {
            res.render("notes", { profilePicture: picture, userName: name, googleId: gId, notes: notes });
        })
    } else {
        res.redirect("login");
    }
});

app.post("/notes", (req, res) => {
    const updateDocument = async () => {
        try {
            const result = await User.updateOne({ googleId: req.body.google_id }, {
                $push: {
                    notes: [{
                        noteTitle: req.body.note_title,
                        mainNote: req.body.main_note
                    }]
                }
            })
        } catch (err) {
            console.log(err);
        }
    }
    updateDocument();
    res.redirect('back');
});

/*------------------ Log out your Account ------------------*/
app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});


app.get("/notes/:userId/:noteId", async (req, res) => {
    const requestedUserId = req.params.userId;
    const requestedNoteId = req.params.noteId;
    try {
        const readNote = await User.findById(requestedUserId)
        const note = readNote.notes.find(note => note._id == req.params.noteId)
        res.render('readNote', {
            note,
            profilePicture: picture,
            userName: name,
            googleId: gId,
            uId: requestedUserId,
            nId: requestedNoteId
        });
    } catch (error) {
        console.log(error);
        res.send(error.message)
    }

})

app.get("/delete/note/:uId/:nId", async (req, res) => {
    try {
        User.findOneAndUpdate({_id: req.params.uId}, {$pull: {notes: {_id: req.params.nId}}} ,(err) => {
            if (!err) {
                res.redirect("/notes")
            }
        })
    } catch (error) {
        console.log(error);
        res.send(error.message);
    }
})


app.listen(3000, function () {
    console.log("Server started at port 3000");
});
