const dotenv = require("dotenv");
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

dotenv.config();
const app = express();

// Middleware
app.use(bodyParser.json());
// app.use(cors({
//     origin: 'https://qr-scanner-frontend.vercel.app',
// }));

// frontend url (only for requests coming from netlify or render)
const allowedOriginsDynamic = [
    'https://mioc-client.onrender.com',
    'https://mioc.netlify.app',
    "https://qr-scanner-frontend.vercel.app",
    'https://mioc.org.om',
    "https://qr-scanner-frontend.onrender.com",
    'http://localhost:5173',
];

// else
const allowedOriginsStatic = [
    'http://localhost:5000',
    'http://localhost:5173',
    "http://192.168.66.62:5173",
    "https://qr-scanner-frontend.vercel.app",
    "https://toolsbox.om",
];

app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Check if the origin is from Render or Netlify (dynamic origins)
    if (allowedOriginsDynamic.includes(origin)) {
        cors({
            origin: function (origin, callback) {
                if (!origin) return callback(null, true);
                if (allowedOriginsDynamic.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'PUT', 'POST', 'DELETE'],
            allowedHeaders: ['Content-Type'],
            credentials: true // Allow cookies to be sent
        })(req, res, next);
    } else {
        // Apply the static CORS config for other origins
        cors({
            origin: allowedOriginsStatic,
            methods: ['GET', 'PUT', 'POST', 'DELETE'],
            allowedHeaders: ['Content-Type'],
            credentials: true // Allow cookies to be sent
        })(req, res, next);
    }
});
// MongoDB connection
mongoose.connect(process.env.MONGODB_URL + "/QR-registration", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// Mongoose Schemas

// Registration schema for user data
const registrationSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    mobileNumber: { type: String, required: true, unique: true },
    groupSize: { type: Number, default: 1 },
    timestamp: { type: Date, default: Date.now }, // Add this field
});

const Registration = mongoose.model('Registration', registrationSchema);

// Visits schema for recording user visits
const visitsSchema = new mongoose.Schema({
    mobileNumber: { type: String, required: true }, // Reference to user mobile number
    name: { type: String, required: true }, // Full name of the user
    entryTime: { type: Date, default: Date.now }, // Timestamp of the visit
});

const Visits = mongoose.model('Visits', visitsSchema);

// Routes
app.get('/', (req, res) => {
    res.json({ message: "hello from Api" })
})

// New Registration
app.post('/register', async (req, res) => {
    const { firstName, lastName, mobileNumber, groupSize } = req.body;

    // Validate input
    if (!firstName || !lastName || !mobileNumber) {
        return res.status(400).json({ message: 'First name, last name, and mobile number are required' });
    }

    const fullName = `${firstName} ${lastName}`;

    try {
        // Check if the user is already registered
        const existingUser = await Registration.findOne({ mobileNumber });
        if (existingUser) {
            return res.status(400).json({ message: 'Mobile number already registered' });
        }

        // Save the user in the Registration collection
        const registration = new Registration({ fullName, mobileNumber, groupSize });
        await registration.save();

        res.status(201).json({ message: 'Registration successful', mobileNumber });
    } catch (error) {
        console.error('Error in /register route:', error.message);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

// Fetch User by Mobile Number
app.get('/fetch-by-mobile/:mobileNumber', async (req, res) => {
    try {
        const { mobileNumber } = req.params;

        if (!mobileNumber) {
            return res.status(400).json({ message: 'Mobile number is required' });
        }

        const user = await Registration.findOne({ mobileNumber });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error in /fetch-by-mobile route:', error.message);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

// Record Visit
app.post('/entry', async (req, res) => {
    try {
        const { mobileNumber } = req.body;

        if (!mobileNumber) {
            return res.status(400).json({ message: 'Mobile number is required' });
        }

        // Find the user in the Registration collection
        const user = await Registration.findOne({ mobileNumber });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Log the visit in the Visits collection
        const visit = new Visits({
            mobileNumber,
            name: user.fullName,
        });

        await visit.save();

        res.status(201).json({ message: 'Visit logged successfully', visit });
    } catch (error) {
        console.error('Error in /entry route:', error.message);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});




////////////////////////////////////

// Generic function to fetch documents within a time range
async function getDocumentsWithinTimeRange(model, timeField, startTimeUTC, endTimeUTC) {
    try {
        const startTime = new Date(startTimeUTC);
        const endTime = new Date(endTimeUTC);

        // Query the model using Mongoose
        const documents = await model.find({
            [timeField]: {
                $gte: startTime,
                $lt: endTime,
            },
        }).lean(); // Use `.lean()` to return plain JavaScript objects instead of Mongoose documents

        // Convert timestamps to Oman time
        return documents.map(doc => ({
            ...doc,
            // [timeField]: convertToOmanTime(new Date(doc[timeField])),
        }));
    } catch (error) {
        console.error("Error fetching documents:", error);
        throw new Error("Failed to fetch documents");
    }
}


// Route handler
app.post("/get-report", async (req, res) => {
    // console.log("rout hit")
    const { startTime, endTime } = req.body;
    // console.log(startTime, endTime);

    if (!startTime || !endTime) {
        return res.status(400).json({ error: "startTime and endTime are required" });
    }

    try {
        // Convert Oman time (UTC+4) input to UTC for querying the database
        // const startTimeUTC = new Date(new Date(startTime).getTime() - 4 * 60 * 60 * 1000).toISOString(); // Subtract 4 hours
        // const endTimeUTC = new Date(new Date(endTime).getTime() - 4 * 60 * 60 * 1000).toISOString(); // Subtract 4 hours

        // Fetch registrations
        const registrations = await getDocumentsWithinTimeRange(
            Registration,
            "timestamp",
            startTime,
            endTime
        );

        // Fetch visits
        const visits = await getDocumentsWithinTimeRange(
            Visits,
            "entryTime",
            startTime,
            endTime
        );

        // Return combined report
        return res.json({
            registrations,
            visits,
        });
    } catch (error) {
        console.error("Error in /get-report route:", error.message);
        return res.status(500).json({ error: "Internal server error", message: error.message });
    }
});




// Start Server
const PORT = process.env.PORT || 5000; // Use the PORT environment variable or fallback to 5000
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
