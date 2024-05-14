const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;



// middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://skills-sphere-efc98.web.app',
        'https://skills-sphere-efc98.firebaseapp.com'
    ],
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zudvrkg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// middleware 2
const logger = (req, res, next) => {
    console.log('log: info', req.method, req.url);
    next();
}

// token verification
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    // console.log('token from verifyToken', token);

    // no token
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    // if token have
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded;
        next();
    })
}

// cookie config for deploy
const cookeOption = {
    httpOnly: true,

    secure: process.env.NODE_ENV === "production" ? true : false,

    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
}




async function run() {
    try {
        const jobsCollection = client.db('skillsphere').collection('jobs')
        // applicant collection
        const applicantsCollection = client.db('skillsphere').collection('applicants')


        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            // console.log('user for token', user)

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            res.cookie('token', token, cookeOption)
                .send({ success: true });
        })



        // logout cookie
        app.post('/logOut', async (req, res) => {
            const user = req.body
            // console.log('logging out user', user)
            res.clearCookie('token', { ...cookeOption, maxAge: 0 }).send({ success: true })
        })


        // services related api start
        // add job post
        app.post('/jobs', async (req, res) => {
            const jobsData = req.body
            // console.log(jobsData)
            const result = await jobsCollection.insertOne(jobsData)
            res.send(result)
        })


        // get all jobs data from db
        app.get('/jobs', async (req, res) => {
            const result = await jobsCollection.find().toArray()
            res.send(result)
        })


        // get a single job data 
        app.get('/singleJob/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.findOne(query);
            res.send(result)
        })


        // my jobs with secure jwt logger
        app.get('/myJobs/:email', logger, verifyToken, async (req, res) => {
            // console.log(req.params.email);
            // console.log('token owner info', req.user)

            if (req.user.email !== req.params.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const result = await jobsCollection.find({ email: req.params.email }).toArray();
            res.send(result)
        });


        // applicant data
        app.post('/applicant', async (req, res) => {
            const applicantData = req.body
            // console.log(applicantData)
            const result = await applicantsCollection.insertOne(applicantData)
            // console.log(result)
            res.send(result)
        })

        // get applicant data with jwt logger
        app.get('/apJobs/:email', logger, verifyToken, async (req, res) => {
            const email = req.params.email

            if (req.user.email !== req.params.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { userEmail: email }
            const result = await applicantsCollection.find(query).toArray()
            res.send(result)
        })


        // delete posted job
        app.delete('/Job/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }

            const result = await jobsCollection.deleteOne(query)
            res.send(result)
        })


        // update posted job
        app.put('/job/:id', async (req, res) => {
            const id = req.params.id
            const jobsData = req.body
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }

            const updateDoc = {
                $set: {
                    ...jobsData,
                },
            }
            const result = await jobsCollection.updateOne(query, updateDoc, options)

            res.send(result)
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('skillsphere is running')
})

app.listen(port, () => {
    console.log(`skillsphere server is running on port ${port}`)
})