import {app} from './app';
import {v2 as cloudinary} from  'cloudinary';
require("dotenv").config()

import connectDB from './utils/db';



//cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_SECRET_KEY,
})


const PORT = process.env.PORT || 8000;
app.listen(PORT,'0.0.0.0',()=>{
    console.log(`Server is connected on ${process.env.PORT}`);
    connectDB();
})
