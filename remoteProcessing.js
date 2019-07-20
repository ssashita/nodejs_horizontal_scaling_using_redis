const redis = require("./redisConnect");

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
  var obj_ = Object.assign(
    { rid: rid },
    { action: action, response: resp },
    obj
  );
  if (!isReserved) {
    const remoteResponseCallback = respObj => {
      if (
        respObj.toInstance !== instanceId ||
        respObj.action !== responseAction
      ) {
        //This handler not meant for this instance or this action
        return;
      }
      remoteProcessingResponseHandler(resp, respObj);
    };
    return redisConnectorForResource.getReserver(rid).chain(toInstanceId => {
      //This isnstance could not reserve the resource, so send message to the owning
      //instance, toInstanceId, to process it
      redis.sendMessage(toInstanceId, obj_);
      //Register a callback for processing the response from the owner instance
      redis.onMessage(remoteResponseCallback, true); //The registering is anulled after first invocation of the callback
      return Task.of(false);
    });
  } else {
    return localProcessingfunction(obj_);
  }
});

const remoteProcessingHandler = curry(
  (action, responseAction, localProcessingfunction, obj) => {
    if (obj.toInstance !== instanceId || obj.action !== action) {
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
        return respObj;
      })
      .fork(
        err => {
          redis.sendMessage(obj.fromInstance, {
            error: { code: 400, msg: "Save error" }
          });
        },
        result => {
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
//...
//...

//Callback handlers
redis.onMessage(
  remoteProcessingHandler(SAVE_RESOURCE, SAVE_RESOURCE_RESPONSE, saveResource)
);
//...
//...

module.exports = {
  doProcessingForResource: doProcessingForResource,
  remoteProcessingHandler: remoteProcessingHandler,
  actionIds: { SAVE_RESOURCE, SAVE_RESOURCE_RESPONSE }
};
