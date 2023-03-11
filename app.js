const express = require("express");
const mongoose = require("mongoose");
const createError = require("http-errors");
// const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const logger = require("morgan");
const handlebars = require('express-handlebars');
var bodyParser = require('body-parser')
const request = require('request')
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
require('dotenv').config()

const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access');






const app = express();
const port = process.env.PORT || 3000;


function loggedIn(req, res, next) {
    if (req.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use(logger("dev"));
app.use(express.static("public"));

app.use(express.json());
app.use(cookieParser());

passport.use(
    new LocalStrategy((username, password, done) => {
        User.findOne({ username: username }, (err, user) => {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false, { message: "Incorrect username" });
            }
            if (user.password !== password) {
                return done(null, false, { message: "Incorrect password" });
            }
            return done(null, user);
        });
    })
);

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});



app.use(session({ secret: "cats", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));








mongoose.set('strictQuery', false);
const mongoDB = process.env.mongoDB

main().catch(err => console.log(err));
async function main() {
    await mongoose.connect(mongoDB);
}


const Schema = mongoose.Schema;

const linkSchema = new Schema({
    title: String,
    url: String,
    platform: String,
    tags: [],
    dateadded: { type: Date, default: Date.now() }
});
const Linkmodel = mongoose.model("Link", linkSchema);


const User = mongoose.model(
    "User",
    new Schema({
        username: { type: String, required: true },
        password: { type: String, required: true }
    })
);


const Tag = mongoose.model(
    "Tag",
    new Schema({
        tagtitle: { type: String, required: true },
        count: { type: Number, required: true }
    })
);



// app.engine('handlebars', handlebars.engine({
//     layoutsDir: __dirname + '/views/layouts',
// }));





app.engine('handlebars', handlebars.engine({

    layoutsDir: __dirname + '/views/layouts',
   

}));


app.set('view engine', 'handlebars');





app.get('/', (req, res) => {

    const pageOptions = {
        page: parseInt(req.query.page, 10) || 0,
        limit: parseInt(req.query.limit, 10) || 5
    }






    Linkmodel.find({}, "title url platform tags dateadded").sort('-dateadded').skip(pageOptions.page * pageOptions.limit)
        .limit(pageOptions.limit).lean().exec(function (err, alllinks) {
            if (err) {
                return next(err);
            }
            //  console.log(alllinks)
            Tag.find({}, "tagtitle count").lean().exec(function (err, alltags) {

                let username = ""
                if (req.user) {
                    username = req.user.username
                }

                Linkmodel.count({}, function (err, count) {
                    let numberofdocs = count;
                    res.render('index', { layout: 'index', alllinks, page: pageOptions.page + 1, user: req.user, username: username, alltags: alltags, numberofdocs: numberofdocs });

                });




            });


        });
});




app.get('/addnew', loggedIn, (req, res) => {
    let username = ""
    if (req.user) {
        username = req.user.username
    }

    Tag.find({}, "tagtitle count").lean().exec(function (err, alltags) {

        let username = ""
        if (req.user) {
            username = req.user.username
        }

        res.render('addnew', { layout: 'index', user: req.user, username: username, alltags: alltags });

    });
});

app.post('/addnew', loggedIn, (req, res) => {

    // success code
    let title = req.body.title
    let url = req.body.url
    let platform = req.body.platform
    let tags = req.body.tags.split(',');

    Linkmodel.create({ title: title, url: url, platform: platform, tags: tags }, function (err, instance) {
        if (err) return handleError(err);
        // saved!
        // redirect to home


        for (let index = 0; index < tags.length; index++) {
            Tag.findOne({ tagtitle: tags[index] }, "tagtitle count").lean().exec(function (err, tagresult) {
                if (err) {
                    return next(err);
                }
                if (tagresult) {
                    // there is user
                    Tag.updateOne({ tagtitle: tags[index] },
                        { count: tagresult.count + 1 }, function (err, docs) {
                            if (err) {
                                console.log(err)
                            }
                            else {
                                // tag updated
                            }
                        });


                } else {
                    // there is no tag
                    Tag.create({ tagtitle: tags[index], count: 1 }, function (err, docs) {
                        if (err) {
                            console.log(err)
                        }
                        else {
                            // tag created
                        }
                    });

                }


            });
        }

        res.redirect('/');



    });
});




app.get('/login', (req, res) => {
    let username = ""
    if (req.user) {
        username = req.user.username
    }


    res.render('login', { layout: 'index', user: req.user, username: username });

});

app.post(
    "/login",
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/login"
    })
);



app.get("/logout", (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        res.redirect("/");
    });
});




app.get('/dashboard', loggedIn, (req, res) => {

    // let urlusername = req.params.username;

    let username = ""
    if (req.user) {
        username = req.user.username
    }

    // if(urlusername !== username) {
    //     res.redirect('/');
    // }

    res.render('dashboard', { layout: 'index', user: req.user, username: username });

});



app.get('/tag/:tagtitle', (req, res) => {
    let tagtitle = req.params.tagtitle;
    const pageOptions = {
        page: parseInt(req.query.page, 10) || 0,
        limit: parseInt(req.query.limit, 10) || 5
    }


    Linkmodel.find({ tags: tagtitle }, "title url platform tags dateadded").sort('-dateadded').skip(pageOptions.page * pageOptions.limit)
        .limit(pageOptions.limit).lean().exec(function (err, alllinks) {
            if (err) {
                return next(err);
            }
            //  console.log(alllinks)

            let username = ""
            if (req.user) {
                username = req.user.username
            }


            Tag.find({}, "tagtitle count").lean().exec(function (err, alltags) {

                let username = ""
                if (req.user) {
                    username = req.user.username
                }


                Linkmodel.count({ tags: tagtitle }, function (err, count) {
                    let numberofdocs = count;
                    res.render('tags', { layout: 'index', alllinks, page: pageOptions.page + 1, user: req.user, username: username, tagtitle: tagtitle, alltags: alltags, numberofdocs: numberofdocs });

                });




            });

        });
});



// temp sign up

// app.get('/signup', (req, res) => {

//     const user = new User({
//         username: 'admin',
//         password: 'ilovedesign'
//     }).save(err => {
//         if (err) {
//             return next(err);
//         }
//         res.redirect("/");
//     });

// });


app.listen(port, function () {
    console.log(`Example app listening on port ${port}!`);
});


app.use((req, res, next) => {
    next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
    console.log(err)
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.send(err);
});