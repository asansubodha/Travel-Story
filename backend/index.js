require('dotenv').config();

const config = require('./config.json');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const User = require('./module/user.module');
const { authenticateToken } = require('./utilties');

mongoose.connect(config.connectionString);


const app = express();
app.use(express.json());
app.use(cors({origin:"*"}));

// Create Account
app.post('/create-account', async (req, res) => {
    const {fullName, email, password} = req.body;

    if(!fullName || !email || !password) {
        return res
        .status(400)
        .json({error: true, message: 'All fields are required'});
    }
    const isUser = await User.findOne({email});
    if(isUser) {
        return res
        .status(400)
        .json({error: true, message: 'Email already exists'});
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
        fullName,
        email,
        password: hashedPassword
    });

    await user.save();

    const accessToken = jwt.sign(
        {userId: user._id},
        process.env.ACCESS_TOKEN_SECRET,
        {expiresIn: '72h'}
    );

    return res.status(201).json({
        error: false,
        user: {fullName: user.fullName, email: user.email},
        message: 'Account created successfully',
        accessToken
    });

});

// Login
app.post('/login', async (req, res) => {
    const {email, password} = req.body;

    if(!email || !password) {
        return res
        .status(400)
        .json({error: true, message: 'All fields are required'});
    }

    const user = await User.findOne({email});

    if(!user) {
        return res
        .status(400)
        .json({error: true, message: 'User not found'});
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if(!isPasswordValid) {
        return res
        .status(400)
        .json({error: true, message: 'Invalid password'});
    }

    const accessToken = jwt.sign(
        {userId: user._id},
        process.env.ACCESS_TOKEN_SECRET,
        {expiresIn: '72h'}
    );

    return res.json({
        error: false,
        user: {fullName: user.fullName, email: user.email},
        message: 'Login successful',
        accessToken
    });

});

// Get User
app.get('/get-user', authenticateToken ,async (req, res) => {
    const {userId} = req.user;

    const isUser = await User.findById(userId);

    if(!isUser) {
        return res.sendStatus(401);
    }

    return res.json({
        user: isUser,
        message: "",
    });
});

app.listen(8000);
module.exports = app;