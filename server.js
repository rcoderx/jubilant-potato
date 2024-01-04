const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { Parser } = require('json2csv');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: 'https://legendary-memory-rose.vercel.app' // Your frontend domain
}));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    twitterUsername: String,
    ETHAddress: { type: String, unique: true },
    referralCount: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.post('/submit', async (req, res) => {
    try {
        const { twitterUsername, userAddress, refereeAddress } = req.body;

        // Check if user already exists with any of the provided details
        console.log('Checking for existing user...');
        console.log('userAddress:', userAddress);
        console.log('twitterUsername:', twitterUsername);
        
        const existingUser = await User.findOne({
            $or: [
                { ETHAddress: userAddress },
                { twitterUsername: twitterUsername },
                
            ]
        });
        
        console.log('Existing user:', existingUser);
        
        if (existingUser) {
            console.log('User already exists with provided details');
            return res.status(400).send('User already exists with provided details');
        }

        // Create new user
        const newUser = new User({
            twitterUsername,
            ETHAddress: userAddress,
            referralCount: 0
        });
        await newUser.save();

        // Update referee's referral count, if provided
        if (refereeAddress) {
            await User.findOneAndUpdate({ ETHAddress: refereeAddress }, { $inc: { referralCount: 1 } });
        }

        res.status(200).send('Registration successful');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error during registration');
    }
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
app.get('/referrals/:userAddress', async (req, res) => {
    try {
        const userAddress = req.params.userAddress;
        const user = await User.findOne({ ETHAddress: userAddress });
        
        if (user) {
            res.json({ referralCount: user.referralCount });
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Define the CSV file header
const csvHeader = [
    { id: 'twitterUsername', title: 'Twitter Username' },
    { id: 'ETHAddress', title: 'Solana Address' },
    { id: 'referralCount', title: 'Referral Count' }
];

const path = require('path');

// Specify the absolute path to your CSV file
const csvFilePath = path.join(__dirname, 'user_data.csv');

// Create a CSV writer
const csvWriter = createCsvWriter({
    path: csvFilePath, // Use the absolute file path
    header: csvHeader
});

// Your route for exporting data to CSV
app.get('/export-csv', async (req, res) => {
    console.log('Export CSV request received');
    try {
        console.log('Fetching user data from database');
        const userData = await User.find({}, { _id: 0, __v: 0 });
        console.log('Fetched user data:', userData);

        if (userData.length) {
            console.log('Converting user data to CSV format');
            const json2csvParser = new Parser({ header: true });
            const csvData = json2csvParser.parse(userData);
            console.log('CSV data created');

            console.log('Sending CSV data in response');
            res.setHeader('Content-disposition', 'attachment; filename=users.csv');
            res.set('Content-Type', 'text/csv');
            res.status(200).send(csvData);
            console.log('CSV file sent in response');
        } else {
            console.log('No user data available to export');
            res.send('No data available to export');
        }
    } catch (error) {
        console.error('Error during CSV export:', error);
        res.status(500).send('Error exporting CSV');
    }
});

