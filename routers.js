const express = require("express");
const app = express();
const redis = require("./redisConnect");
const {
  actionIds,
  remoteProcessingHandler,
  doProcessingForResource
} = require("./remoteProcessing");

redis.setInstanceId("instance 1");

app.use(express.static("public"));
const bodyParser = require("body-parser");
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  // res.header("Content-Type", "application/json");
  res.header("Accept-Encoding", "gzip");

  next();
});

app.get("/some_path", function(req, resp) {});

app.post("/save_resource/:rid", (req, resp) => {
  var rid = req.params.rid;
  var body = req.body;
  var obj = Object.assign({}, req.body);
  //...
  const redisConnectorForResource1 = redis.connect("Resource1");
  redisConnectorForResource1
    .reserve(rid)
    .chain(
      doProcessingForResource(
        //Could be remote or local processing based on if rid could be reserved
        redisConnectorForResource1,
        rid,
        actionIds.SAVE_RESOURCE,
        actionIds.SAVE_RESOURCE_RESPONSE,
        obj,
        saveResource,
        resp
      )
    )
    .fork(
      err => {
        resp.status(400);
        resp.send({});
      },
      requestHandledInThisInstance => {
        if (requestHandledInThisInstance) {
          resp.status(200);
          resp.send({ result: "success" });
        }
      }
    );
});

//saveResource::o->Task e
const saveResource = obj => {
  //Actual saving of the resource
  //..
  return Task.of(true);
};

app.get("/", function(req, resp) {});

var PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Node/Express server connected on port", PORT);
});
