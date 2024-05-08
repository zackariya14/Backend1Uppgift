const express = require("express");
const cors = require("cors");
const app = express();
const bcrypt = require('bcrypt');
const mongoose = require("mongoose");
const User = require("./models/user");
const Post = require("./models/post");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' })
const fs = require('fs');


const saltRounds = 10;
const secret = 'asdasasdas'

app.use(cors({credentials: true, origin: 'http://localhost:3000'}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'))
mongoose.connect(
  "mongodb+srv://Zackariya:Blog@cluster0.qjqgtms.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({ 
        username, 
        password:bcrypt.hashSync(password, saltRounds) 
    });
    res.json(userDoc);
  } catch (err) {
    res.status(400).json(err);
  }
});

app.post('/login', async (req, res) => {
    const { username, password} = req.body;
    const userDoc = await User.findOne({username});
    const passOk = bcrypt.compareSync(password, userDoc.password); // true
    if (passOk) {
        //logged in
        jwt.sign({ username,id: userDoc._id}, secret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token).json({
                id:userDoc._id,
                username,
            });
        })
    } else {
        res.status(400).json('wrong password');
    }
})

app.get('/profile', (req, res) => {
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        res.json(info)
    })
})

app.post('/logout', (req, res) => {
    res.cookie('token', '').json('ok');
})

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
    const {originalname,path} = req.file
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path+'.'+ext
    fs.renameSync(path, newPath)
 
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async(err, info) => {
        if (err) throw err;
        const {title,summary,content} = req.body
        const postDoc = await Post.create({
             title,
             summary,
             content,
             cover: newPath,
             author: info.id
         })
         res.json({postDoc})
        })

})

app.put('/post',uploadMiddleware.single('file'), async (req, res) => {
    let newPath = null;
    if (req.file){
        const {originalname,path} = req.file
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path+'.'+ext
        fs.renameSync(path, newPath)
    }

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async(err, info) => {
        if (err) throw err;
        const {id,title,summary,content} = req.body
        const postDoc = await Post.findById(id)
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id)
        if (!isAuthor) {
           return res.status(400).json('you are not the author')
        }
        await postDoc.updateOne({title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
        })
        
         res.json(postDoc)
        })

})

app.get('/post', async (req, res) => { 
    const posts = await Post.find()
        .populate('author', ['username'])
        .sort({createdAt: -1})
        .limit(20);
    
    res.json(posts);
});

app.get('/post/:id', async (req, res) => {
    const {id} = req.params
    const postDoc = await Post.findById(id).populate('author', ['username'])
    res.json(postDoc)
})

app.listen(4000);
