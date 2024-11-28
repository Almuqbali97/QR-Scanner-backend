const dotenv = require("dotenv");
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

dotenv.config();
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

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

// Start Server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
