//jshint esversion:6
require('dotenv').config();
const fs = require('fs');
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const stripe = require('stripe')(process.env.STRIPE_KEY);
const session = require("express-session");
const nodemailer = require('nodemailer');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const generateUniqueId = require('generate-unique-id');
const Razorpay = require("razorpay");
const { log } = require('console');
const MongoStore = require('connect-mongo')(session);

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: 'SessionSecretFoREZADmiN',
    store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

app.use(passport.initialize());
app.use(passport.session());

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
});


mongoose.set("strictQuery", false);
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

const adminSchema = new mongoose.Schema({
    username: { type: String, require: true, unique: true },
    emp_id: { type: String, require: true, unique: true },
    emp_name: { type: String, require: true },
    emp_gender: { type: String, require: true },
    emp_email: { type: String, require: true, unique: true },
    roles: [{
        role_name: String,
        view: { type: Boolean, default: false },
        modify: { type: Boolean, default: false }
    }],
    admin: { type: Boolean, require: true, default: false },
    password: String
});

adminSchema.plugin(passportLocalMongoose);


const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    authType: String,
    name: String,
    phone: { type: String, unique: true },
    email: { type: String, unique: true },
    gender: String,
    doj: String,
    password: String,
    verified: { type: Boolean, default: false }
});

const modifiedTicketSchema = new mongoose.Schema({
    bookingID: { type: String, unique: true },
    service_no: String,
    customerID: String,
    previousJourneyDate: String,
    newJourneyDate: String,
    modifiedSeats: String
});

const serviceSchema = new mongoose.Schema({
    service_no: String,
    service_date: String,
    origin: String,
    destination: String,
    status: Boolean,
    type: String,
    bus_type: String,
    dep_time: String,
    arr_time: String,
    journeyDuration: String,
    boarding_point: String,
    drop_point: String,
    fare: String,
    seat: [{
        seat_no: String,
        seat_status: String,
    }],
    createdAt: { type: Date, default: Date.now, expires: 180000 }
});

const busSchema = new mongoose.Schema({
    bus_service_no: String,
    bus_origin: String,
    bus_destination: String,
    type: String,
    bus_name: String,
    bus_dep_time: String,
    bus_arr_time: String,
    journeyDuration: String,
    boarding_point: String,
    drop_point: String,
    fare: String
});



const bookingSchema = new mongoose.Schema({
    userID: String,
    bookingID: { type: String, unique: true },
    RzpOrderID: { type: String, unique: true },
    transactionID: { type: String, unique: true },
    paymentMethod: { type: String, default: "Razorpay" },
    bookingDate: String,
    bookingTime: String,
    bookingStatus: String,
    service_no: String,
    bus_type: String,
    origin: String,
    destination: String,
    journeyDate: String,
    dep_time: String,
    arr_time: String,
    boarding_point: String,
    drop_point: String,
    pax_name: String,
    pax_age: String,
    pax_phone: String,
    pax_gender: String,
    seats: [],
    fare: String,
});

const walletTransactionSchema = new mongoose.Schema({
    userID: String,
    amount: Number,
    type: { type: String, enum: ['credit', 'debit'] },
    status: { type: String, enum: ['initiated', 'completed', 'failed'] },
    date: { type: Date, default: Date.now },
    paymentID: { type: String, default: "-" }
});

const giftCardSchema = new mongoose.Schema({
    userID: String,
    cardID: { type: String, unique: true },
    cardPin: String,
    faceValue: Number,
    recName: String,
    recEmail: String,
    recMsg: String,
    status: { type: String, enum: ['open', 'redeemed'], default: "open" },
    paymentID: { type: String, default: "null" },
    paymentStatus: { type: String, enum: ['initiated', 'completed'], default: "initiated" },
    date: { type: Date, default: Date.now },
});


const Admin = mongoose.model("Admin", adminSchema);
const Service = mongoose.model('Service', serviceSchema);
const Bus = mongoose.model('Bus', busSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const User = mongoose.model("User", userSchema);
const ModifiedTicket = mongoose.model("ModifiedTicket", modifiedTicketSchema);
const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);
const GiftCard = mongoose.model("GiftCard", giftCardSchema);

passport.use(Admin.createStrategy());
passport.serializeUser(Admin.serializeUser());
passport.deserializeUser(Admin.deserializeUser());

// nodemailer initialize

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_ID,
        pass: process.env.MAIL_PASS
    },
    tls: {
        rejectedUnauthorized: false
    }
});

//auth part starts here
app.get('/logout', (req, res) => {
    req.logout(function (err) {
        if (!err) {
            res.redirect('/auth')
        } else {
            console.log(err);
        }
    });
})

app.get("/auth/login", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/')
    } else {
        res.render("login", { failure: false });
    }
});

app.get("/auth/register", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/')
    } else {
        res.render("register", { failure: false, dk: false });
    }
});

app.get("/badcred", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/')
    } else {
        res.render("login", { failure: true });
    }
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/badcred"
}), function (req, res) {
});

app.post("/register", function (req, res) {
    if (req.isAuthenticated()) {
        res.redirect('/')
    } else {
        const generatedEMPID = "EMP" + generateUniqueId({
            length: 5,
            useLetters: false
        });
        Admin.register({
            username: generatedEMPID, emp_id: generatedEMPID, emp_name: req.body.emp_name, emp_email: req.body.emp_email, emp_gender: req.body.emp_gender,
            roles: [{ role_name: "service" }, { role_name: "buses" }, { role_name: "bookings" }, { role_name: 'finance' }, { role_name: "IAM" }]
        }, req.body.password, function (err, user) {
            if (err) {
                console.log(err.code);
                if (err.code === 11000) {
                    res.render("register", { failure: false, dk: true });
                } else {
                    res.render("register", { failure: true, dk: false });
                    console.error('Error:', err);
                }
            } else {
                res.render("register-success", { employeeID: generatedEMPID });
            }
        });
    }
});

app.get('/auth', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/')
    } else {
        res.redirect('/auth/login')
    }
});

//auth part ends here

// function to check user permissions

function checkPermission(user, roleName, permission) {
    const foundRole = user.roles.find(role => role.role_name === roleName);
    if (foundRole) {
        if (foundRole[permission] === true) {
            return true;
        }
    }
    return false;
}

app.get('/unauthorized', (req, res) => {
    if (req.isAuthenticated()) {
        res.render('unauthorized')
    } else {
        res.redirect('/auth')
    }
});

app.get("/", function (req, res) {
    if (req.isAuthenticated()) {
        let todayRevenue;
        let monthRevenue;
        // Get the current date in the format "DD-MM-YYYY"
        const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

        // Get the current month and year
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // Months are zero-based, so add 1
        const currentYear = today.getFullYear();

        // Construct the start and end date strings for the current month
        const startDate = `01-${currentMonth.toString().padStart(2, '0')}-${currentYear}`;
        const endDate = `${currentMonth.toString().padStart(2, '0')}-${currentYear}`;

        // Define aggregation pipelines to calculate both totals
        const todayTotalPipeline = [
            {
                $match: {
                    bookingDate: todayDate // Match bookings with today's date
                }
            },
            {
                $group: {
                    _id: null,
                    totalFare: {
                        $sum: { $toInt: '$fare' } // Convert fare to an integer before summing
                    }
                }
            }
        ];

        const currentMonthTotalPipeline = [
            {
                $match: {
                    bookingDate: {
                        $gte: startDate, // Greater than or equal to the start of the month
                        $lte: endDate // Less than or equal to the end of the month
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalFare: {
                        $sum: { $toInt: '$fare' } // Convert fare to an integer before summing
                    }
                }
            }
        ];

        // Execute the aggregation queries
        Promise.all([
            Booking.aggregate(todayTotalPipeline),
            Booking.aggregate(currentMonthTotalPipeline)
        ])
            .then(([todayResult, currentMonthResult]) => {
                if (todayResult.length > 0) {
                    todayRevenue = todayResult[0].totalFare;
                } else {
                    todayRevenue = 0
                    // console.log('No bookings found for today.');
                }

                if (currentMonthResult.length > 0) {
                    monthRevenue = currentMonthResult[0].totalFare;
                } else {
                    monthRevenue = 0;
                    // console.log('No bookings found for the current month.');
                }
                res.render("home", { todayRevenue: todayRevenue, monthRevenue: monthRevenue });

            })
            .catch(error => {
                res.render("home", { todayRevenue: "NA", monthRevenue: "NA" });
                console.error('Error:', error);
            })
    } else {
        res.redirect('/auth');
    }
});


//Service part starts here

app.get("/service", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "view")) {
            Service.findOne({ service_no: req.query.no, service_date: req.query.date }, function (err, foundService) {
                if (!err) {
                    const disabledSeatNumbers = foundService.seat
                        .filter(seat => seat.seat_status === 'disabled')
                        .map(seat => seat.seat_no);
                    res.render("service", { service: foundService, blockedSeats: disabledSeatNumbers })
                } else {
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});


app.get("/services", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "view")) {
            Service.find({}, function (err, foundServices) {
                if (!err) {
                    res.render("tables", { foundServices: foundServices });
                } else {
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});



app.get("/modify-service", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "view")) {
            res.render("modifyservice", { error: false, success: false, nf: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.get("/delete-service", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "view")) {
            res.render("deleteservice", { error: false, success: false, nf: false, s_no: null });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.post("/found-delete-service", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "modify")) {
            Service.findOne({ service_no: req.body.service_no, service_date: req.body.d_date }, function (err, foundService) {
                if (!err) {
                    if (foundService != null) {
                        res.render("found-delete-service", { service: foundService });
                    } else {
                        res.render("deleteservice", { error: false, success: false, nf: true, s_no: null });
                    }
                } else {
                    res.render("deleteservice", { error: true, success: false, nf: false, s_no: null });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.post("/delete-service-confirm", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "modify")) {
            Service.findOneAndDelete({ _id: req.body.service_id }, function (err) {
                if (!err) {
                    res.render("deleteservice", { error: false, success: true, nf: false, s_no: req.body.service_no });
                } else {
                    console.log(err);
                    res.render("deleteservice", { error: true, success: false, nf: false, s_no: null });
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.post('/found-modify-service', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "modify")) {
            Service.findOne({ service_no: req.body.service_no, service_date: req.body.d_date }, function (err, foundService) {
                if (!err) {
                    if (foundService != null) {
                        res.render("modify-found-service", { service: foundService });
                    } else {
                        res.render("modifyservice", { error: false, success: false, nf: true });
                    }
                } else {
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post("/modify-service", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "modify")) {
            Service.findOneAndUpdate({ service_no: req.body.gotserviceNo, service_date: req.body.d_date }, { status: req.body.status, fare: req.body.fare }, function (err) {
                if (!err) {
                    res.render("modifyservice", { error: false, success: true, nf: false });
                } else {
                    console.log(err);
                    res.render("modifyservice", { error: true, success: false, nf: false });
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.get("/generate-pax-sheet", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "view")) {
            res.render("gpaxinput");
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.post("/gpaxsheet", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "service", "modify")) {
            Booking.find({ service_no: req.body.service_no, journeyDate: req.body.d_date }, function (err, foundBookings) {
                if (!err) {
                    res.render("gpaxsheet", { foundBookings: foundBookings })
                } else {
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

//Service part ends here

//Bus part starts here

app.get("/add-bus", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "buses", "view")) {
            res.render("addbus", { success: false, error: false, s_no: null });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth')
    }
});

app.post("/add-bus", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "buses", "modify")) {
            function calculateTimeDifference(dep_time, arr_time) {
                var time1 = dep_time;
                var time2 = arr_time;
                var date1 = new Date("2000-01-01T" + time1);
                var date2 = new Date("2000-01-01T" + time2);

                // Check if the second time is smaller than the first time
                if (date2 < date1) {
                    date2.setDate(date2.getDate() + 1); // Add 24 hours to the second time
                }
                var diffInMilliseconds = Math.abs(date2 - date1);
                var hours = Math.floor(diffInMilliseconds / 3600000).toString();
                var minutes = Math.floor((diffInMilliseconds % 3600000) / 60000).toString();
                if (hours.length < 2) {
                    hours = "0" + hours;
                }
                if (minutes.length < 2) {
                    minutes = "0" + minutes;
                }
                const final = `${hours}h ${minutes}m`
                return final;
            }
            const jD = calculateTimeDifference(req.body.dep_time, req.body.arr_time);
            const newBus = new Bus({
                bus_service_no: req.body.service_no,
                bus_origin: req.body.origin,
                bus_destination: req.body.destination,
                type: req.body.bus_type,
                bus_name: req.body.bus_model,
                bus_dep_time: req.body.dep_time,
                bus_arr_time: req.body.arr_time,
                journeyDuration: jD,
                boarding_point: req.body.boarding_point,
                drop_point: req.body.drop_point,
                fare: req.body.fare
            });
            newBus.save(function (err) {
                if (!err) {
                    res.render("addbus", { success: true, error: false, s_no: req.body.service_no });
                } else {
                    res.render("addbus", { success: false, error: true, s_no: null });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth')
    }
});

app.get("/buses", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "buses", "view")) {
            Bus.find({}, function (err, foundBuses) {
                if (!err) {
                    res.render("buses", { foundBuses: foundBuses })
                } else {
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.get("/delete-bus", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "buses", "view")) {
            res.render("deletebus", { success: false, error: false, nf: false, b_no: null });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.post("/delete-bus", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "buses", "view")) {
            Bus.findOne({ bus_service_no: req.body.service_no }, function (err, foundBus) {
                if (!err) {
                    if (foundBus != null) {
                        res.render("found-delete-bus", { bus: foundBus })
                    } else {
                        res.render("deletebus", { success: false, error: false, nf: true, b_no: null });
                    }
                } else {
                    res.render("deletebus", { success: false, error: true, nf: false, b_no: null });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }

    } else {
        res.redirect('/auth');
    }
});

app.post("/delete-bus-confirm", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "buses", "modify")) {
            Bus.findOneAndDelete({ _id: req.body.bus_id }, function (err) {
                if (!err) {
                    res.render("deletebus", { success: true, error: false, nf: false, b_no: req.body.bus_no });
                } else {
                    res.render("deletebus", { success: false, error: true, nf: false, b_no: null });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});


//Bus part ends here

//Booking part starts here


app.get('/booking', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            Booking.findOne({ bookingID: req.query.bookingID }, function (err, foundBooking) {
                if (!err) {
                    ModifiedTicket.findOne({ bookingID: req.query.bookingID }, (err, foundModifiedTicket) => {
                        if (!err) {
                            if (foundModifiedTicket != null) {
                                if (checkPermission(req.user, "finance", "modify")) {
                                    res.render("booking", { booking: foundBooking, modified: foundModifiedTicket, admin: true })
                                } else {
                                    res.render("booking", { booking: foundBooking, modified: foundModifiedTicket, admin: false })
                                }
                            } else {
                                if (checkPermission(req.user, "finance", "modify")) {
                                    res.render("booking", { booking: foundBooking, modified: null, admin: true })
                                } else {
                                    res.render("booking", { booking: foundBooking, modified: null, admin: false })
                                }
                            }
                        } else {
                            console.log(err);
                        }
                    });
                } else {
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.get("/bookings", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            Booking.find({}, function (err, foundBookings) {
                if (!err) {
                    res.render("bookings", { foundBookings: foundBookings })
                } else {
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.get("/modify-booking", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            res.render("modifybooking", { success: false, error: false, nf: false, b_id: null, am: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth')
    }
});

app.post('/found-modify-booking', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            Booking.findOne({ bookingID: req.body.booking_id, bookingStatus: "paid" }, function (err, foundBooking) {
                if (!err) {
                    if (foundBooking != null) {
                        res.render("found-modify-booking", { booking: foundBooking });
                    } else {
                        res.render("modifybooking", { success: false, error: false, nf: true, b_id: null, am: false });
                    }
                } else {
                    res.render("modifybooking", { success: false, error: true, nf: false, b_id: null, am: false });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth')
    }
});

app.post("/modify-booking-confirm", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "modify")) {
            Booking.findOneAndUpdate({ bookingID: req.body.bookingID, bookingStatus: "paid" }, { journeyDate: req.body.d_date }, function (err) {
                if (!err) {
                    const newArray = req.body.existing_seats.split(',');
                    newArray.forEach(function (element) {
                        Service.updateOne(
                            { service_no: req.body.service_no, service_date: req.body.existingJourneyDate, 'seat.seat_no': element },
                            { $set: { 'seat.$.seat_status': 'enabled' } },
                            function (err, count) {
                                if (!err) {
                                    const newModifiedTicket = new ModifiedTicket({
                                        bookingID: req.body.bookingID,
                                        service_no: req.body.service_no,
                                        customerID: req.body.userID,
                                        previousJourneyDate: req.body.existingJourneyDate,
                                        newJourneyDate: req.body.d_date,
                                        modifiedSeats: req.body.new_seats
                                    });
                                    newModifiedTicket.save(function (err) {
                                        if (!err) {
                                            res.render("modifybooking", { success: true, error: false, nf: false, b_id: req.body.bookingID, am: false });

                                            // Booking modification success! Sending confirmation to client

                                            User.findOne({ _id: req.body.userID }, function (err, foundUser) {
                                                if (!err) {
                                                    if (foundUser != null) {
                                                        const template = fs.readFileSync('email-temps/bookingmodify.ejs', 'utf8');
                                                        const data = {
                                                            name: foundUser.name,
                                                            bookingID: req.body.bookingID,
                                                            serviceNo: req.body.service_no,
                                                            oldjourneyDate: req.body.existingJourneyDate,
                                                            newjourneyDate: req.body.d_date,
                                                            seats: req.body.new_seats
                                                        };
                                                        const html = ejs.render(template, data);
                                                        const mailOptions = {
                                                            from: process.env.MAIL_ID,
                                                            to: foundUser.email,
                                                            subject: 'Booking Modification',
                                                            html: html
                                                        };
                                                        transporter.sendMail(mailOptions, (error, info) => {
                                                            if (error) {
                                                                console.log('Error occurred:', error.message);
                                                            } else {
                                                                console.log("mail sent");
                                                                // mail sent
                                                            }
                                                        });
                                                    }
                                                } else {
                                                    console.log(err);
                                                }
                                            });
                                        } else {
                                            if (err.code === 11000 || err.code === 11001) {
                                                res.render("modifybooking", { success: false, error: false, nf: false, b_id: null, am: true });
                                            } else {
                                                res.render("modifybooking", { success: false, error: true, nf: false, b_id: null, am: false });
                                            }
                                        }
                                    })
                                } else { console.log(err); }
                            });
                    });
                } else {
                    res.render("modifybooking", { success: false, error: true, nf: false, b_id: null, am: false });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.get('/cancel-booking', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            res.render('cancelbooking', { success: false, error: false, nf: false, b_id: null });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.post('/found-cancel-booking', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            Booking.findOne({ bookingID: req.body.booking_id, bookingStatus: "paid" }, (err, foundBooking) => {
                if (!err) {
                    if (foundBooking != null) {
                        res.render('found-cancel-booking', { booking: foundBooking });
                    } else {
                        res.render('cancelbooking', { success: false, error: false, nf: true, b_id: null });
                    }
                } else {
                    res.render('cancelbooking', { success: false, error: true, nf: false, b_id: null });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.post('/cancel-booking-confirm', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "modify")) {
            Booking.findOneAndUpdate({ bookingID: req.body.bookingID, bookingStatus: "paid" }, { bookingStatus: "cancelled" }, (err) => {
                if (!err) {
                    const newArray = req.body.seats.split(',');
                    newArray.forEach(function (element) {
                        Service.updateOne(
                            { service_no: req.body.service_no, service_date: req.body.service_date, 'seat.seat_no': element },
                            { $set: { 'seat.$.seat_status': 'enabled' } },
                            function (err, count) {
                                if (!err) {
                                    res.render('cancelbooking', { success: true, error: false, nf: false, b_id: req.body.bookingID });
                                } else { console.log(err); }
                            });
                    });
                } else {
                    res.render('cancelbooking', { success: false, error: true, nf: false, b_id: null });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
})

app.get("/check-pending-booking-status", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            res.render("check_pd_booking", { nf: false, error: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth')
    }
});

app.post("/get_pending_booking_status", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            Booking.findOne({ pax_phone: req.body.phone_no, bookingStatus: "initiated" }, function (err, foundBooking) {
                if (!err) {
                    if (foundBooking != null) {
                        res.render('found-pd-booking', { booking: foundBooking })
                    } else {
                        res.render("check_pd_booking", { nf: true, error: false });
                    }
                } else {
                    res.render("check_pd_booking", { nf: false, error: true });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth')
    }
});

//Booking part ends here

// Payments part start here


app.get("/razorpay-order-status", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            res.render("rzorderstatus", { error: false, nf: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.post("/found-razorpay-order", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            if (req.user.emp_id === "EMP49143") {
                if (req.body.order_id === "order_Mk9bfmK3JYsEAR") {
                    razorpay.orders.fetch(req.body.order_id)
                        .then(orderResponse => {
                            res.render("found-razorpay-order", { order: orderResponse })
                        })
                        .catch(error => {
                            const ntf = error.error.description.includes('not a valid id');
                            if (error.error.code === 'BAD_REQUEST_ERROR' && ntf) {
                                res.render("rzorderstatus", { error: false, nf: true });
                            } else {
                                console.log("Error occurred while fetching order : " + error);
                                res.render("rzorderstatus", { error: true, nf: false });
                            }
                        });
                } else {
                    res.redirect("/unauthorized")
                }
            } else {
                razorpay.orders.fetch(req.body.order_id)
                    .then(orderResponse => {
                        res.render("found-razorpay-order", { order: orderResponse })
                    })
                    .catch(error => {
                        const ntf = error.error.description.includes('not a valid id');
                        if (error.error.code === 'BAD_REQUEST_ERROR' && ntf) {
                            res.render("rzorderstatus", { error: false, nf: true });
                        } else {
                            console.log("Error occurred while fetching order : " + error);
                            res.render("rzorderstatus", { error: true, nf: false });
                        }
                    });
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});


app.get("/razorpay-payment-status", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            res.render("rzpaymentstatus", { error: false, nf: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect('/auth');
    }
});

app.post("/found-razorpay-payment", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            if (req.user.emp_id === "EMP49143") {
                if (req.body.paymentID === "pay_Mk9bpSFgrY9sfP") {
                    razorpay.payments.fetch(req.body.paymentID)
                        .then(paymentResponse => {
                            res.render("found-razorpay-payment", { payment: paymentResponse })
                        })
                        .catch(error => {
                            const ntf = error.error.description.includes('does not exist');
                            if (error.error.code === 'BAD_REQUEST_ERROR' && ntf) {
                                res.render("rzpaymentstatus", { error: false, nf: true });
                            } else {
                                console.log("Error occurred while fetching order : " + error);
                                res.render("rzpaymentstatus", { error: true, nf: false });
                            }
                        });
                } else {
                    res.redirect("/unauthorized")
                }
            } else {
                razorpay.payments.fetch(req.body.paymentID)
                    .then(paymentResponse => {
                        res.render("found-razorpay-payment", { payment: paymentResponse })
                    })
                    .catch(error => {
                        const ntf = error.error.description.includes('does not exist');
                        if (error.error.code === 'BAD_REQUEST_ERROR' && ntf) {
                            res.render("rzpaymentstatus", { error: false, nf: true });
                        } else {
                            console.log("Error occurred while fetching order : " + error);
                            res.render("rzpaymentstatus", { error: true, nf: false });
                        }
                    });
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.get("/stripe-payment-status", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            res.render("stripe-payment-status", { error: false, nf: false })
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});


app.post("/found-stripe-payment", async (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            if (req.user.emp_id === "EMP49143") {
                if (req.body.sessionID === "cs_test_b1cyhO4mhJPLdCQJ8a5ZdjsFWxMMSxWIhJkW8cWT4JU92vxQqFUU8s4SNl") {
                    const session = await stripe.checkout.sessions.retrieve(req.body.sessionID, (err, session) => {
                        if (!err) {
                            res.render("found-stripe-payment", { data: session })
                        } else {
                            if (err.raw.message.includes('No such checkout.session')) {
                                res.render("stripe-payment-status", { error: false, nf: true })
                            } else {
                                res.render("stripe-payment-status", { error: true, nf: false })
                                console.log(err);
                            }
                        }
                    });
                } else {
                    res.redirect("/unauthorized")
                }
            } else {
                const session = await stripe.checkout.sessions.retrieve(req.body.sessionID, (err, session) => {
                    if (!err) {
                        res.render("found-stripe-payment", { data: session })
                    } else {
                        if (err.raw.message.includes('No such checkout.session')) {
                            res.render("stripe-payment-status", { error: false, nf: true })
                        } else {
                            res.render("stripe-payment-status", { error: true, nf: false })
                            console.log(err);
                        }
                    }
                });
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.get("/create-razorpay-refund" , (req,res) => {
    if (req.isAuthenticated()){
        res.redirect("/unauthorized");
    } else {
        res.redirect("/auth");
    }
});

app.get("/track-razorpay-refund", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            res.render("track-razorpay-refund", { error: false, nf: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post("/track-razorpay-refund", (req, res) => {
    if (req.isAuthenticated()){
        if (checkPermission(req.user, "finance" , "view")){
            if (req.user.emp_id === "EMP49143"){
                if (req.body.refund_id === "rfnd_MkQWH4OHlhlFUf" && req.body.payment_id === "pay_MkQDJWre5JGm5y"){
                    razorpay.payments.fetchRefund(req.body.payment_id, req.body.refund_id, (error, refund) => {
                        if (error) {
                            if (error.error.description.includes('The id provided does not exist')){
                                res.render("track-razorpay-refund", { error: false, nf: true });
                            } else {
                                res.render("track-razorpay-refund", { error: true, nf: false });
                                console.error('Error:', error);
                            }
                        } else {
                          res.render("found-razorpay-refund" , {refund :refund});
                        }
                    });  
                } else {
                    res.redirect("/unauthorized")
                }
            } else {
                razorpay.payments.fetchRefund(req.body.payment_id, req.body.refund_id, (error, refund) => {
                    if (error) {
                        if (error.error.description.includes('The id provided does not exist')){
                            res.render("track-razorpay-refund", { error: false, nf: true });
                        } else {
                            res.render("track-razorpay-refund", { error: true, nf: false });
                            console.error('Error:', error);
                        }
                    } else {
                      res.render("found-razorpay-refund" , {refund :refund});
                    }
                });  
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
        
});



//coupons sub part starts here

app.get("/coupon-home", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            res.render("coupon-home");
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.get("/list-coupons", async function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            const coupons = await stripe.coupons.list({
                limit: 100,
            });
            res.render("list-coupons", { coupons: coupons });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.get("/link-promo-code", async function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            const promotionCodes = await stripe.promotionCodes.list({
                limit: 100,
            });
            const coupons = await stripe.coupons.list({
                limit: 100,
            });
            res.render("link-promo-code", { success: 'null', promocodes: promotionCodes, coupons: coupons })
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }

})

app.post("/link-promo-code", async function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "modify")) {
            const promotionCodes = await stripe.promotionCodes.list({
                limit: 100,
            });
            const coupons = await stripe.coupons.list({
                limit: 100,
            });
            if (req.body.minimum_amount === '') {
                try {
                    const promotionCode = await stripe.promotionCodes.create({
                        coupon: req.body.coupon_id,
                        code: req.body.promo_code,
                    });
                    res.render("link-promo-code", { success: 'true', promocodes: promotionCodes, coupons: coupons })
                } catch (error) {
                    if (error.type === "StripeInvalidRequestError" && error.message.includes("already exists")) {
                        res.render("link-promo-code", { success: 'false', promocodes: promotionCodes, coupons: coupons })
                    } else {
                        res.render("link-promo-code", { success: 'error', promocodes: promotionCodes, coupons: coupons })
                    }
                }
            } else {
                try {
                    const promotionCode = await stripe.promotionCodes.create({
                        coupon: req.body.coupon_id,
                        code: req.body.promo_code,
                        restrictions: {
                            minimum_amount: req.body.minimum_amount * 100,
                            minimum_amount_currency: 'inr'
                        }
                    });
                    res.render("link-promo-code", { success: 'true', promocodes: promotionCodes, coupons: coupons })
                } catch (error) {
                    if (error.type === "StripeInvalidRequestError" && error.message.includes("already exists")) {
                        res.render("link-promo-code", { success: 'false', promocodes: promotionCodes, coupons: coupons })
                    } else {
                        res.render("link-promo-code", { success: 'error', promocodes: promotionCodes, coupons: coupons })
                    }
                }
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

// app.get("/getpromo", async function (req, res) {
//     try {
//         const promotionCode = await stripe.promotionCodes.retrieve(
//             req.query.promo_id
//         );
//         res.json(promotionCode);
//     } catch (error) {
//         console.log(error);
//     }
// });

// app.get("/getcoupon", async function (req, res) {
//     try {
//         const coupon = await stripe.coupons.retrieve(
//             req.query.coupon_id
//         );
//         res.json(coupon);
//     } catch (error) {
//         res.json(null);
//         // NOT LOGGING ERROR
//     }
// });

app.get("/archive-promo", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            res.render("archive-promo", { success: false, error: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post("/archive-promo", async function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "modify")) {
            try {
                const promotionCode = await stripe.promotionCodes.update(
                    req.body.gotPromoID,
                    { active: req.body.status }
                );
                res.render("archive-promo", { success: true, error: false });
            } catch (err) {
                res.render("archive-promo", { success: false, error: true });
                console.log(err);
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }

});

app.get("/add-coupon", async function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            const products = await stripe.products.list({
                limit: 20,
            });
            res.render("add-coupon", { success: false, products: products });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post("/add-coupon", async function (req, res) {

    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "modify")) {
            if (req.body.percent_off === undefined) {
                if (req.body.valid_till === '') {
                    const coupon = await stripe.coupons.create({
                        name: req.body.coupon_name,
                        amount_off: req.body.amount_off * 100,
                        applies_to: {
                            products: [req.body.product_id], // Replace 'product_id' with the ID of the specific product you want to apply the coupon to
                        },
                        duration: 'forever',
                        currency: 'inr'
                    });
                    const products = await stripe.products.list({
                        limit: 20,
                    });
                    res.render("add-coupon", { success: true, products: products });
                } else {
                    const coupon = await stripe.coupons.create({
                        name: req.body.coupon_name,
                        amount_off: req.body.amount_off * 100,
                        applies_to: {
                            products: [req.body.product_id], // Replace 'product_id' with the ID of the specific product you want to apply the coupon to
                        },
                        duration: 'repeating',
                        duration_in_months: parseInt(req.body.valid_till),
                        currency: 'inr'
                    });
                    const products = await stripe.products.list({
                        limit: 20,
                    });
                    res.render("add-coupon", { success: true, products: products });
                }
            } else if (req.body.amount_off === undefined) {
                if (req.body.valid_till === '') {
                    const coupon = await stripe.coupons.create({
                        name: req.body.coupon_name,
                        percent_off: req.body.percent_off,
                        applies_to: {
                            products: [req.body.product_id], // Replace 'product_id' with the ID of the specific product you want to apply the coupon to
                        },
                        duration: 'forever',
                        currency: 'inr'
                    });
                    const products = await stripe.products.list({
                        limit: 20,
                    });
                    res.render("add-coupon", { success: true, products: products });
                } else {
                    const coupon = await stripe.coupons.create({
                        name: req.body.coupon_name,
                        percent_off: req.body.percent_off,
                        applies_to: {
                            products: [req.body.product_id], // Replace 'product_id' with the ID of the specific product you want to apply the coupon to
                        },
                        duration: 'repeating',
                        duration_in_months: parseInt(req.body.valid_till),
                        currency: 'inr'
                    });
                    const products = await stripe.products.list({
                        limit: 20,
                    });
                    res.render("add-coupon", { success: true, products: products });
                }
            } else {
                res.redirect('/add-coupon');
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
})

app.get("/delete-coupon", function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            res.render("delete-coupon", { success: false, error: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post("/delete-coupon", async function (req, res) {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "modify")) {
            try {
                const deleted = await stripe.coupons.del(
                    req.body.gotcouponID
                );
                if (deleted.deleted === true) {
                    res.render("delete-coupon", { success: true, error: false });
                } else {
                    res.render("delete-coupon", { success: false, error: true });
                }
            } catch (error) {
                res.render("delete-coupon", { success: false, error: true });
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});


//coupons sub part ends here

app.get("/retrieve-invoice", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect("/unauthorized");
    } else {
        res.redirect("/auth");
    }
});

// Payments part ends here


// Wallet part starts here

app.get("/wallet-transactions", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            res.render("wallet-transactions", { error: false, nf: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post("/found-wallet-txn", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            if (req.user.emp_id === "EMP49143") {
                if (req.body.email === "guestuser@test.com") {
                    User.findOne({ email: req.body.email }, (err, foundUser) => {
                        if (!err) {
                            if (foundUser != null) {
                                WalletTransaction.find({ userID: foundUser._id }, (err, foundTxns) => {
                                    if (!err) {
                                        if (foundTxns.length > 0) {
                                            res.render("found-wallet-transactions", { data: foundTxns, customerEmail: foundUser.email, customerName: foundUser.name })
                                        } else {
                                            res.render("wallet-transactions", { error: false, nf: true });
                                            // no transactions found for this user
                                        }
                                    } else {
                                        res.render("wallet-transactions", { error: true, nf: false });
                                        console.log(err);
                                    }
                                })
                            } else {
                                res.render("wallet-transactions", { error: false, nf: true });
                                // no user found
                            }
                        } else {
                            res.render("wallet-transactions", { error: true, nf: false, });
                            console.log(err);
                        }
                    });
                } else {
                    res.redirect("/unauthorized")
                }
            } else {
                User.findOne({ email: req.body.email }, (err, foundUser) => {
                    if (!err) {
                        if (foundUser != null) {
                            WalletTransaction.find({ userID: foundUser._id }, (err, foundTxns) => {
                                if (!err) {
                                    if (foundTxns.length > 0) {
                                        res.render("found-wallet-transactions", { data: foundTxns, customerEmail: foundUser.email, customerName: foundUser.name })
                                    } else {
                                        res.render("wallet-transactions", { error: false, nf: true });
                                        // no transactions found for this user
                                    }
                                } else {
                                    res.render("wallet-transactions", { error: true, nf: false });
                                    console.log(err);
                                }
                            })
                        } else {
                            res.render("wallet-transactions", { error: false, nf: true });
                            // no user found
                        }
                    } else {
                        res.render("wallet-transactions", { error: true, nf: false, });
                        console.log(err);
                    }
                });
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

// Gift card sub part starts here

app.get("/get-giftcard-txns", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            res.render("giftcards-txn", { error: false, nf: false, mailsent: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
})

app.post("/found-giftcard-txn", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "view")) {
            if (req.user.emp_id === "EMP49143") {
                if (req.body.email === "guestuser@test.com") {
                    User.findOne({ email: req.body.email }, (err, foundUser) => {
                        if (!err) {
                            if (foundUser != null) {
                                GiftCard.find({ userID: foundUser._id }, (err, foundGiftCards) => {
                                    if (!err) {
                                        if (foundGiftCards.length > 0) {
                                            res.render("found-giftcard-txns", { data: foundGiftCards, custName: foundUser.name, custEmail: foundUser.email })
                                        } else {
                                            res.render("giftcards-txn", { error: false, nf: true, mailsent: false });
                                            // no gc's found
                                        }
                                    } else {
                                        res.render("giftcards-txn", { error: true, nf: false, mailsent: false });
                                        console.log(err);
                                    }
                                });
                            } else {
                                res.render("giftcards-txn", { error: false, nf: true, mailsent: false });
                                // no user found
                            }
                        } else {
                            res.render("giftcards-txn", { error: true, nf: false, mailsent: false });
                            console.log(err);
                        }
                    });
                } else {
                    res.redirect("/unauthorized")
                }
            } else {
                User.findOne({ email: req.body.email }, (err, foundUser) => {
                    if (!err) {
                        if (foundUser != null) {
                            GiftCard.find({ userID: foundUser._id }, (err, foundGiftCards) => {
                                if (!err) {
                                    if (foundGiftCards.length > 0) {
                                        res.render("found-giftcard-txns", { data: foundGiftCards, custName: foundUser.name, custEmail: foundUser.email })
                                    } else {
                                        res.render("giftcards-txn", { error: false, nf: true, mailsent: false });
                                        // no gc's found
                                    }
                                } else {
                                    res.render("giftcards-txn", { error: true, nf: false, mailsent: false });
                                    console.log(err);
                                }
                            });
                        } else {
                            res.render("giftcards-txn", { error: false, nf: true, mailsent: false });
                            // no user found
                        }
                    } else {
                        res.render("giftcards-txn", { error: true, nf: false, mailsent: false });
                        console.log(err);
                    }
                });
            }
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post('/resend-giftcard-details', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "finance", "modify")) {
            GiftCard.findOne({ _id: req.body.id }, (err, foundCard) => {
                if (!err) {
                    if (foundCard != null) {
                        const template = fs.readFileSync('email-temps/giftcardtemplate.ejs', 'utf8');
                        const data = {
                            name: foundCard.recName,
                            code: foundCard.cardID,
                            pin: foundCard.cardPin,
                            msg: foundCard.recMsg,
                            faceValue: foundCard.faceValue,
                        };
                        const html = ejs.render(template, data);
                        const mailOptions = {
                            from: process.env.MAIL_ID,
                            to: foundCard.recEmail,
                            subject: 'Re : Gift Voucher Details',
                            html: html
                        };
                        transporter.sendMail(mailOptions, (error, info) => {
                            if (!error) {
                                //mail sent
                                res.render("giftcards-txn", { error: false, nf: false, mailsent: true });

                            } else {
                                console.log(error);
                            }
                        });
                    } else {
                        res.redirect("/");
                    }
                } else {
                    res.render("giftcards-txn", { error: true, nf: false, mailsent: false });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

// Gift card sub part ends here


// Wallet part ends here

//Misc part starts here

app.get('/seat-block', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            res.render("seat-block", { error: false, nf: false, success: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post('/seat-block', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "view")) {
            Service.findOne({ service_no: req.body.service_no, service_date: req.body.d_date }, (err, bus) => {
                if (err) {
                    console.error(err);
                    res.render("seat-block", { error: true, nf: false, success: false });
                    return;
                }
                if (bus != null) {
                    // Extract seat numbers with seat status as "disabled"
                    const disabledSeatNumbers = bus.seat
                        .filter(seat => seat.seat_status === 'disabled')
                        .map(seat => seat.seat_no);
                    res.render("seat-map", { blockedSeats: disabledSeatNumbers, type: bus.type, err: false, sno: req.body.service_no, sdate: req.body.d_date });
                } else {
                    // no bus found
                    res.render("seat-block", { error: false, nf: true, success: false });
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post('/seat-block-confirm', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "bookings", "modify")) {
            const newArray = JSON.parse(req.body.selectedSeats);
            newArray.forEach(function (element) {
                Service.updateOne(
                    { service_no: req.body.service_no, service_date: req.body.d_date, 'seat.seat_no': element },
                    { $set: { 'seat.$.seat_status': 'disabled' } },
                    function (err, count) {
                        if (!err) {
                            res.render("seat-block", { error: false, nf: false, success: true });
                        } else {
                            res.render("seat-block", { error: true, nf: false, success: false });
                            console.log(err);
                        }
                    });
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});



//Misc part ends here

// IAM part starts here

app.get("/admins", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "IAM", "view")) {
            Admin.find({}, (err, foundAdmins) => {
                if (!err) {
                    res.render("admins-list", { data: foundAdmins })
                } else {
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.get("/list-user-permissions", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "IAM", "view")) {
            res.render("admin-permissions", { error: false, nf: false, success: false });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post('/found-user-permissions', (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "IAM", "view")) {
            Admin.findOne({ emp_id: req.body.empID }, (err, foundAdmin) => {
                if (!err) {
                    if (foundAdmin != null) {
                        res.render("found-permissions", { data: foundAdmin });
                    } else {
                        res.render("admin-permissions", { error: false, nf: true, success: false });
                        // no user found
                    }
                } else {
                    res.render("admin-permissions", { error: true, nf: false, success: false });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.get("/modify-permission", (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "IAM", "view")) {
            Admin.findOne({ emp_id: req.query.emp_id }, (err, foundAdmin) => {
                if (!err) {
                    if (foundAdmin != null) {
                        res.render("modify-permission", { data: foundAdmin });
                    } else {
                        res.render("admin-permissions", { error: true, nf: false, success: false });
                        // no user found
                    }
                } else {
                    res.render("admin-permissions", { error: true, nf: false, success: false });
                    console.log(err);
                }
            });
        } else {
            res.redirect('/unauthorized')
        }
    } else {
        res.redirect("/auth");
    }
});

app.post("/modify-permission", async (req, res) => {
    if (req.isAuthenticated()) {
        if (checkPermission(req.user, "IAM", "modify")) {
            try {
                const { emp_id } = req.body;
                const rolesData = req.body;

                // Convert the rolesData into an array of roles
                const updatedRoles = [];

                for (const key in rolesData) {
                    if (key.endsWith('-view') || key.endsWith('-modify')) {
                        const roleName = key.split('-')[0];
                        const action = key.split('-')[1];
                        const permission = rolesData[key] === 'true';

                        // Find or create the role in the updatedRoles array
                        let role = updatedRoles.find(r => r.role_name === roleName);
                        if (!role) {
                            role = { role_name: roleName };
                            updatedRoles.push(role);
                        }

                        // Update the permission in the role object
                        role[action] = permission;
                    }
                }

                const updatedAdmin = await Admin.findOneAndUpdate(
                    { emp_id },
                    { $set: { roles: updatedRoles } },
                    { new: true }
                );

                if (!updatedAdmin) {
                    res.render("admin-permissions", { error: true, nf: false, success: false });
                }

                res.render("admin-permissions", { error: false, nf: false, success: true });
            } catch (error) {
                res.render("admin-permissions", { error: true, nf: false, success: false });
                console.error(error);
            }
        } else {
            if (req.user.emp_id === "EMP49143") {
                if (req.body.emp_id === "EMP66402") {
                    try {
                        const { emp_id } = req.body;
                        const rolesData = req.body;

                        // Convert the rolesData into an array of roles
                        const updatedRoles = [];

                        for (const key in rolesData) {
                            if (key.endsWith('-view') || key.endsWith('-modify')) {
                                const roleName = key.split('-')[0];
                                const action = key.split('-')[1];
                                const permission = rolesData[key] === 'true';

                                // Find or create the role in the updatedRoles array
                                let role = updatedRoles.find(r => r.role_name === roleName);
                                if (!role) {
                                    role = { role_name: roleName };
                                    updatedRoles.push(role);
                                }

                                // Update the permission in the role object
                                role[action] = permission;
                            }
                        }

                        const updatedAdmin = await Admin.findOneAndUpdate(
                            { emp_id },
                            { $set: { roles: updatedRoles } },
                            { new: true }
                        );

                        if (!updatedAdmin) {
                            res.render("admin-permissions", { error: true, nf: false, success: false });
                        }

                        res.render("admin-permissions", { error: false, nf: false, success: true });
                    } catch (error) {
                        res.render("admin-permissions", { error: true, nf: false, success: false });
                        console.error(error);
                    }
                } else {
                    res.redirect('/unauthorized')
                }
            } else {
                res.redirect('/unauthorized')
            }
        }
    } else {
        res.redirect("/auth");
    }
});
// IAM part ends here

//User part starts here

app.get('/profile' , (req,res) => {
    if (req.isAuthenticated()){
        res.render("profile" , {data : req.user});
    } else {
        res.redirect("/auth");
    }
});

//User part ends here


connectDB().then(() => {
    console.log("eazybusDB CONNECTED SUCCESFULLY");
    app.listen(process.env.PORT || 3000, () => {
        console.log("EazyBus-ADMIN Server STARTED on PORT 3000");
    })
});
