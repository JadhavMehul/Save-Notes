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

var pUname = String;

app.use(express.static("public"));
app.set('view engine', 'ejs');
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

app.get("/h", (req, res) => {
    if (req.isAuthenticated()) {
        User.find({ username: pUname }, function (err, notes) {
            res.render("privateNotes", {Uname: pUname, notes: notes });
        })
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
    const otp = Math.floor(Math.random() * 9999) + 1;

    res.render("register",{generatedOTP: otp});
});

app.get("/otp/:email_id/:pass/:OTP", function(req, res){
    const userEmail = req.params.email_id;
    const userPass = req.params.pass;
    const otp = req.params.OTP;
    res.render("otpPage",{userEmail: userEmail, userPass:userPass, otp:otp});
});

app.post("/successfulRegister", function(req, res){
    const email = req.body.username;
    const password = req.body.password;
    const generatedOTP = req.body.mainOtp;
    const userOtp = req.body.userOtp;

    if (generatedOTP === userOtp) {
        User.register({username: email}, password, function(err, user){
            if (err) {
                console.log(err);
                res.redirect("/register");
            } else {
                passport.authenticate("local")(req, res, function(){
                    res.redirect("/")
                });
            }
        });
    } else {
        res.send("error occur try again later.")
    }

})

app.post("/register", function(req, res){

    const OTP = req.body.originalOTP;
    

    const email_id = req.body.username;
    const pass = req.body.password;

    var transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth:{
            user: process.env.EMAIL_ID,
            pass: process.env.EMAIL_PASS,
        }
    });

    var mailOptions = {
        from: 'jmehuljadhav.mj@gmail.com',
        to: email_id,
        subject: "Save Notes",
        text: "hello this email is generated for you by Save Notes to check weather your login credentials are true or not. This is your otp for getting register :-" + OTP + "If you did not register your self with save notes then kindly change your email password."
    }

    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            console.log(error);
        } else {
            console.log("email sent", info.response);
            res.redirect("otp/"+email_id+"/"+pass+"/"+OTP);
        }
    })
});

app.post("/login", function(req, res){

    pUname = req.body.username
    
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err){
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/h")
            });
        }
    });
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
    res.redirect("/");
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
