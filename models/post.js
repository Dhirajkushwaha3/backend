const { json } = require('body-parser');
const { JsonWebTokenError } = require('jsonwebtoken');
const mongoose = require('mongoose');
const { type } = require('os');
const { ref } = require('process');


const postSchema = mongoose.Schema({
   user:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  date: {
    type: Date,
    default: Date.now
  },
  content: String,
  likes: [{
    type: mongoose.Schema.Types.ObjectId, ref: "user"
  }],

    
});

module.exports = mongoose.model('post', postSchema);