require('dotenv').config();

const config = require('./config.json');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const upload = require('./multer');
const fs = require('fs');
const path = require('path');

const { authenticateToken } = require('./utilties');

const User = require('./module/user.module');
const TravelStory = require('./module/travelStory.module');


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

//Route to handle image upload
app.post('/image-upload', upload.single("image"),async (req, res) => {
    try{
        if (!req.file) {
            return res
            .status(400)
            .json({error: true, message: 'Image is required'});
        }

        const imageUrl = `http://localhost:8000/uploads/${req.file.filename}`;

        res.status(201).json({imageUrl});
    }
    catch (error) {
        res.status(500).json({error: true, message: error.message});
    }
});

//Delete an image from the uploads directory
app.delete('/delete-image', async (req, res) => {
    const {imageUrl} = req.body;

    if(!imageUrl) {
        return res
        .status(400)
        .json({error: true, message: 'Image URL is required'});
    }

    try {
        // Extrat the file name from the imageURL
        const filename = path.basename(imageUrl);

        //delete the file from the uploads directory
        const filePath = path.join(__dirname, 'uploads', filename);

        //check if the file exists
        if(fs.existsSync(filePath)){
            //delete the file
            fs.unlinkSync(filePath);
            res.status(200).json({message: 'Image deleted successfully'});
        }
        else {
            res.status(404).json({error: true, message: 'Image not found'});
        }

    } catch (error) {
        res.status(500).json({error: true, message: error.message});
    }

});

//Serve static files from the uploads and assets directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

//Add Travel Story
app.post('/add-travel-story', authenticateToken ,async (req, res) => {
    const {title, story, visibleLocation, ImageUrl, visitedDate} = req.body;
    const {userId} = req.user;

    //validate required fields
    if(!title || !story || !visibleLocation || !ImageUrl || !visitedDate) {
        return res.status(400).json({error: true, message: 'All fields are required'});
    }

    //convert visibleDate from miliseconds to date object
    const parsedVisibledDate = new Date(parseInt(visitedDate));

    try {
        const travelStory = new TravelStory({
            title,
            story,
            visibleLocation,
            userId,
            ImageUrl,
            visitedDate: parsedVisibledDate,
        });

        await travelStory.save();
        res.status(201).json({story: travelStory, message: 'Travel story added successfully'});
        
    } catch (error) {
        res.status(400).json({error: true, message: error.message});
    }

});

//Get all Travel Story
app.get('/get-all-stories', authenticateToken ,async (req, res) => {
    const {userId} = req.user;

    try{
        const travelStories = await TravelStory.find({userId}).sort({isFavorite: -1, createdOn: -1});
        res.status(200).json({stories: travelStories});
    }
    catch (error) {
        res.status(500).json({error: true, message: error.message});
    }
});

//Edit Travel Story
app.put('/edit-story/:id', authenticateToken ,async (req, res) => {
    const {id} = req.params;
    const {title, story, visibleLocation, ImageUrl, visitedDate} = req.body;
    const {userId} = req.user;

    //validate required fields
    if(!title || !story || !visibleLocation || !ImageUrl || !visitedDate) {
        return res.status(400).json({error: true, message: 'All fields are required'});
    }

    //convert visibleDate from miliseconds to date object
    const parsedVisibledDate = new Date(parseInt(visitedDate));

    try {
        // Find the travel story by id and ensure it belongs to the user
        const travelStory = await TravelStory.findOne({_id: id, userId: userId});

        if(!travelStory) {
            return res.status(404).json({error: true, message: 'Travel story not found'});
        }

        const placeholderImageUrl = 'http://localhost:8000/assets/placeholder.jpg';

        travelStory.title = title;
        travelStory.story = story;
        travelStory.visibleLocation = visibleLocation;
        travelStory.ImageUrl = ImageUrl || placeholderImageUrl;
        travelStory.visitedDate = parsedVisibledDate;

        await travelStory.save();
        res.status(200).json({story: travelStory, message: 'Travel story updated successfully'});
    } catch (error) {
        res.status(500).json({error: true, message: error.message});
    }
});

//Delete Travel Story
app.delete('/delete-story/:id', authenticateToken ,async (req, res) => {
    const {id} = req.params;
    const {userId} = req.user;

    try {
        // Find the travel story by id and ensure it belongs to the user
        const travelStory = await TravelStory.findOne({_id: id, userId: userId});

        if(!travelStory) {
            return res.status(404).json({error: true, message: 'Travel story not found'});
        }

        //delete the travel story
        await travelStory.deleteOne({_id: id, userId: userId});

        //extract the file name from the imageURL
        const imageUrl = travelStory.ImageUrl;
        const filename = path.basename(imageUrl);

        //Define the file path
        const filePath = path.join(__dirname, 'uploads', filename);

        //Delete the file from the uploads directory
        fs.unlinkSync(filePath, (err) => {
            if(err) {
                console.error("Failed to delete file", err);
            }
        });

        res.status(200).json({message: 'Travel story deleted successfully'});
       
    } catch (error) {
        res.status(500).json({error: true, message: error.message});
    }
});

//Update Favorite Status
app.put('/update-is-favorite/:id', authenticateToken ,async (req, res) => {
    const {id} = req.params;
    const {isFavorite} = req.body;
    const {userId} = req.user;

    try {
        // Find the travel story by id and ensure it belongs to the user
        const travelStory = await TravelStory.findOne({_id: id, userId: userId});

        if(!travelStory) {
            return res.status(404).json({error: true, message: 'Travel story not found'});
        }

        travelStory.isFavorite = isFavorite;
        await travelStory.save();
        res.status(200).json({story: travelStory, message: 'Favorite status updated successfully'});
    } catch (error) {
        res.status(500).json({error: true, message: error.message});
    }
});

// Search Travel Story
app.get('/search', authenticateToken ,async (req, res) => {
    const {query} = req.query;
    const {userId} = req.user;

    if (!query) {
        return res.status(404).json({error: true, message: 'Query is required'});
    }
    try {
        const searchResults = await TravelStory.find({
            userId: userId,
            $or: [
                {title: {$regex: query, $options: 'i'}},
                {story: {$regex: query, $options: 'i'}},
                {visibleLocation: {$regex: query, $options: 'i'}},
            ]
        }).sort({isFavorite: -1});

        res.status(200).json({stories: searchResults});

    } catch (error) {
        res.status(500).json({error: true, message: error.message});
    }
});

// Filter Travel Story by Date
app.get('/travel-stories/filter', authenticateToken ,async (req, res) => {
    const {startDate, endDate} = req.query;
    const {userId} = req.user;

    try{
        //convert startDate and endDate from miliseconds to date object
        const start = new Date(parseInt(startDate));
        const end = new Date(parseInt(endDate));

        //find travel stories that fall within the date range
        const travelStories = await TravelStory.find({
            userId: userId,
            visitedDate: {
                $gte: start,
                $lte: end,
            }
        }).sort({isFavorite: -1});

        res.status(200).json({stories: travelStories});
    }
    catch (error) {
        res.status(500).json({error: true, message: error.message});
    }
});

app.listen(8000);
module.exports = app;