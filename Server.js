//importing stuff
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import GridFsStorage from "multer-gridfs-storage";
import Grid from "gridfs-stream";
import bodyParser from "body-parser";
import path from "path";
import Pusher from "pusher";
import mongoPosts from "./mongoPosts.js";


Grid.mongo = mongoose.mongo;

//app config
const app = express();
const port = process.env.PORT || 9000;
const mongoURI = "mongodb+srv://Admin:sarvesh@cluster0.sxkka.mongodb.net/fbdb?retryWrites=true&w=majority";

const pusher = new Pusher({
    appId: "1105128",
    key: "1e28d49b2ddf777a7081",
    secret: "1fbc6d3aaa5e900034f2",
    cluster: "ap2",
    useTLS: true
});



//middleware
app.use(bodyParser.json());
app.use(cors());


//db config

const conn = mongoose.createConnection(mongoURI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
});


mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
});

mongoose.connection.once("open", () => {
    console.log("DB connect");

    const changeStream = mongoose.connection.collection("posts").watch()

    changeStream.on("change", (change) => {
        console.log(change)

        if (change.operationType === "insert") {
            console.log("Trigger pusher")

            pusher.trigger("posts", "inserted", {
                change: change
            })
        } else {
            console.log("Error triggering Pusher")
        }
    })
})

let gfs

conn.once("open", () => {
    console.log("DB connect");
    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection("images")

})

const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            {
                const filename = 'image-' + Date.now() + path.extname(file.originalname);

                const fileInfo = {
                    filename: filename,
                    bucketName: "images"
                }
                resolve(fileInfo )
            }})
    }
})

const upload = multer({ storage })

//api routes
app.get("/", (req, res) => res.status(200).send("Hello World"));

app.post("/upload/image", upload.single("file"), (req, res) => {
    res.status(201).send(req.file)
})

app.post("/upload/post", (req, res) => {
    const dbPost = req.body

    console.log(dbPost)

    mongoPosts.create(dbPost, (err, file) => {
        if (err) {
            res.status(500).send(err)
        } else {
            res.status(201).send(file)
        }

    })
})

app.get("/retrive/image/single", (req, res) => {
    gfs.files.findOne({ filename: req.query.name }, (err, file) => {
        if (err) {
            res.status(500).send(err)
        } else {
            if (!file || file.length === 0) {
                res.status(404).json({ err: "file not found" })
            } else {
                const readstream = gfs.createReadStream(file.filename);
                readstream.pipe(res);
            }
        }
    })
})

app.get("/retrive/posts", (req, res) => {
    mongoPosts.find((err, data) => {
        if (err) {
            res.status(500).send(err)
        } else {
            data.sort((b, a) => {

                return a.timestamp - b.timestamp;
            })
            res.status(200).send(data)
        }

    })

})

//listen

app.listen(port, () => console.log("Listening to localhost:" + port));