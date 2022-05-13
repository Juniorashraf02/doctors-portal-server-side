const express = require('express');
const app = express();
const port = process.env.PORT || 5000;


// middleware
const cors = require('cors');
app.use(cors());
app.use(express.json());
require('dotenv').config();



// application connec

const { MongoClient, ServerApiVersion } = require('mongodb');
const res = require('express/lib/response');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d0pnn.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function  run(){
    try{
        await client.connect();
        const servicesCollection = client.db('doctors_portal').collection('services');

        app.get('/services', async (req,res)=>{
            const query = {};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

    }
    finally{}
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('Hello World!')
  })
  
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })