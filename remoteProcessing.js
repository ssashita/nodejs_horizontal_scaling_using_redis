const redis = require("./redisConnect");
const { curry, Task } = require("./essentials");

console.log(process.env);

redis.setInstanceId(process.env.INSTANCE_ID || "instance 1");

//const instanceId = redis.getInstanceId();

const doProcessingForResource = curry((
  redisConnectorForResource, //Resource connector
  rid, //resource id
  action, //id of message action
  responseAction, //id of message response action
  obj, // input object for doing the processing
  localProcessingfunction, //the local processing function
  resp, // The http response object is needed in the remote response callback handler
  isReserved //Is the resource rid reserved by this instance?
) => {
  console.log(
    "rid is",
    rid,
    "action",
    action,
    "responseAction",
    responseAction,
    "doProcessingForResource called with isReserved value",
    isReserved,
    "and instanceId is",
    redis.getInstanceId()
  );
  var obj_ = Object.assign(
    { rid: rid },
    { action: action, response: resp },
    obj
  );
  if (!isReserved) {
    console.log("Not reserved");

    const remoteResponseCallback = respObj => {
      console.log("Great news - remoteResponseCallback");
      if (
        respObj.toInstance !== redis.getInstanceId() ||
        respObj.action !== responseAction
      ) {
        //This handler not meant for this instance or this action
        return;
      }
      remoteProcessingResponseHandler(resp, respObj);
    };

    return redisConnectorForResource.getReserver(rid).chain(toInstanceId => {
      console.log("getReserver returned", toInstanceId, "for rid", rid);
      //This isnstance could not reserve the resource, so send message to the owning
      //instance, toInstanceId, to process it
      redis.sendMessage(toInstanceId, obj_);
      //Register a callback for processing the response from the owner instance
      if (!remoteResponseCallbacks[responseAction]) {
        redis.onMessage(remoteResponseCallback);
        remoteResponseCallbacks[responseAction] = true;
      }
      return Task.of(false);
    });
  } else {
    console.log("Reserved by local server");
    return localProcessingfunction(obj_);
  }
});

const remoteProcessingHandler = curry(
  (action, responseAction, localProcessingfunction, obj) => {
    console.log(
      "remoteProcessingHandler called for instanceId",
      redis.getInstanceId(),
      "action is",
      action,
      "responseAction is",
      responseAction
    );
    if (obj.toInstance !== redis.getInstanceId() || obj.action !== action) {
      //This handler not meant for this instance or this action
      return;
    }
    var respObj;
    localProcessingfunction(obj)
      .chain(result => {
        //Do whatever is required with obj, and form a response to be sent back
        // and set respObj
        respObj = Object.assign(
          {
            status: 200,
            action: responseAction
          },
          respObj
        );
        return Task.of(respObj);
      })
      .fork(
        err => {
          console.log("Sending ERROR message to", obj.fromInstance);

          redis.sendMessage(obj.fromInstance, {
            error: { code: 400, msg: "Save error" }
          });
        },
        result => {
          console.log("Sending message to", obj.fromInstance);
          //send the respObj as a message for the original instance
          redis.sendMessage(obj.fromInstance, respObj);
        }
      );
  }
);

const remoteProcessingResponseHandler = curry((resp, obj) => {
  resp.status(obj.status);
  resp.send(obj);
});

//Message Action ids
const SAVE_RESOURCE = "saveResource";
const SAVE_RESOURCE_RESPONSE = "saveResourceResponse";
const TEST_INFRA = "testInfra";
const TEST_INFRA_RESPONSE = "testInfraResponse";
//...
//...

//Register Callback handlers
const registerCallbackHandler = (
  action,
  responseAction,
  localProcessingfunction
) => {
  console.log(
    "registerCallbackHandler for action",
    action,
    "responseAction",
    responseAction
  );
  redis.onMessage(
    remoteProcessingHandler(action, responseAction, localProcessingfunction)
  );
};

//Already registered Response Callback handlers
const remoteResponseCallbacks = {};

module.exports = {
  doProcessingForResource: doProcessingForResource,
  actionIds: {
    SAVE_RESOURCE,
    SAVE_RESOURCE_RESPONSE,
    TEST_INFRA,
    TEST_INFRA_RESPONSE
  },
  registerCallbackHandler: registerCallbackHandler
};
