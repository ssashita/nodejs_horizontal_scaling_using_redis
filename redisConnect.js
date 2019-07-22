/**
 * Created by ssashita on 10/07/19.
 */
var redis = require("redis");
var {
  promiseToTask,
  maybeToTask,
  eitherToTask,
  ioToTask,
  chain,
  map,
  compose,
  Maybe,
  List,
  Either,
  Right,
  Left,
  Task,
  Map,
  List,
  IO,
  createCompose,
  Identity,
  curry,
  inspect,
  join,
  tite2t,
  tite2te,
  ite2t,
  concat,
  filter,
  take,
  prop,
  traverse,
  forEach,
  either,
  createCompose
} = require("./essentials");

//The redis channel for internal communication between server instances
const INTERNAL_CHANNEL = "InternalChannel";

//redisConnect:: Create a new redis client connection
const redisConnect = () => {
  let redisClient;
  if (process.env.node_env == "production") {
  } else if (
    process.env.node_env == "dev" ||
    process.env.node_env == "development"
  ) {
  } else {
    redisClient = redis.createClient(6379, "127.0.0.1");
  }
  return redisClient;
};

//Common redis client connection for all key-value CRUD and record reserving functionality
var redisCommonConnection = redisConnect();

//Messaging subscriber client
var redisChatSubscriberConnection = redisConnect();

//Messaging Publisher client
var redisChatPublisherConnection = redisConnect();

//Map to store all redis connector objects
var redisConnections = {};

var instanceId;

redisCommonConnection.on("connect", resp => {
  console.log("RedisMessage server connected for redisCommonConnection");
});

redisChatSubscriberConnection.on("connect", resp => {
  console.log(
    "RedisMessage server connected for redisChatSubscriberConnection"
  );
  redisChatSubscriberConnection.subscribe(INTERNAL_CHANNEL);
});

redisChatPublisherConnection.on("connect", resp => {
  console.log("RedisMessage server connected for redisChatPublisherConnection");
});

const subscribeChannel = channel => {
  redisChatSubscriberConnection.subscribe(channel);
};
/**
 * Return, creating if necessary, a connection object per namespaceKey,
 * stored in a global Javascript object, redisConnections.
 * @param {*} namespaceKey
 */
const connect = (namespaceKey, newRedisClient) => {
  if (!(namespaceKey in redisConnections)) {
    redisConnections[namespaceKey] = new RedisConnector(
      namespaceKey,
      newRedisClient
    );
  }
  return redisConnections[namespaceKey];
};
//getOwner::r->k->Task o
const getOwner = (redisClient, key) => {
  return new Task((fail, succ) => {
    redisClient.get(key, function(err, owner) {
      if (err) {
        console.log("iAmOwner - redis Error", err);
        fail(err);
        return;
      }
      if (owner) {
        succ(owner);
      } else {
        succ(null);
      }
    });
  });
};
//iAmOwner::r->k-> Task e
const iAmOwner = (redisClient, key) => {
  return new Task((fail, succ) => {
    const instId = getInstanceId();
    redisClient.get(key, function(err, owner) {
      if (err) {
        console.log("iAmOwner - redis Error", err);
        fail(err);
        return;
      }
      if (owner) {
        if (!instId) {
          console.log("Error - Unset Instanceid");
          fail("Unset instanceId");
        } else if (owner == instId) {
          console.log(
            "Attempting to Lock on",
            key,
            "for instanceId",
            instId,
            "belongs to instanceId (myself)",
            owner
          );
          succ(true);
        } else {
          console.log(
            "Attempting to Lock on",
            key,
            "for instanceId",
            instId,
            "belongs to other instanceId",
            owner
          );
          succ(false);
        }
      } else {
        console.log(
          "Attempting to Lock on",
          key,
          "for instanceId",
          instId,
          "belongs to none !"
        );
        succ(false);
      }
    });
  });
};

class RedisConnector {
  constructor(namespaceKey, newRedisClient) {
    this.key = namespaceKey;
    this.connection = newRedisClient ? redisConnect() : redisCommonConnection;
    if (newRedisClient) {
      this.connection.on("connect", resp => {
        console.log(
          "RedisMessage server connected for custom redis client connection"
        );
      });
    }
  }
  //reserveMultiple::rids-> Task List e
  reserveMultiple(...resourceIds) {
    return new List(resourceIds).traverse(Task.of, this.reserve.bind(this));
  }
  //reserve:: r->Task e
  reserve(resourceId) {
    const instId = getInstanceId();
    const key = "Lock$" + this.key + "$" + resourceId;
    const redisClient = this.connection;
    console.log("reserving key", key, "for instance", instId);
    return new Task(reserveTaskFork(key, redisClient, instId)).join();
  }
  //keys:: p-> Task List k
  keys(pattern) {
    const redisClient = this.connection;
    return new Task((fail, succ) => {
      redisClient.keys(pattern, (err, keys) => {
        if (err) {
          fail(err);
        } else {
          succ(new List(keys));
        }
      });
    });
  }
  //unreserveAll::()->Task List e
  unreserveAll() {
    const redisClient = this.connection;
    return this.keys("Lock$" + this.key + "*").chain(removeAll(redisClient));
  }
  //getReserver::
  getReserver(resourceId) {
    return getOwner(this.connection, "Lock$" + this.key + "$" + resourceId);
  }

  //Other CRUD methods called in class Resource
  //
  // store(obj,id){
  //   id = this.key+"$"+ (id || generateUUID());
  //   ...
  //   return Task.of(this.redisClient.put(id, obj, (err, resp) => {
  //
  //   })
  // }
  // get(resourceId){
  //   let id = this.key+"$"+resourceId;
  //   return Task.of(this.redisClient.get(id,(err,resp)=>{
  //     .....
  //   }))
  // }
  // delete(resourceId){
  //   let id = this.key+"$"+resourceId;
  //   ....
  //   return Task.of(this.redisClient.del(id,(err,resp)=>{
  //
  //   })
  // }
  // ...
}

//reserveTaskFork::k->redis->r->(fail->succ->Task Task t)
const reserveTaskFork = (key, redisClient, instId) => (fail, succ) => {
  redisClient.set(key, instId, "NX", function(err, response) {
    if (err) {
      fail(Task.rejected(err));
      return;
    }
    console.log(
      "reserveTaskFork: response is",
      response,
      "instanceId is",
      getInstanceId()
    );

    if (!response) {
      // this could mean that lock already belongs to other instance or to me
      succ(iAmOwner(redisClient, key));
    } else {
      succ(Task.of(true));
    }
  });
};
//remove:: cl->id-> Task e
const remove = curry((redisClient, id) => {
  return new Task((fail, succ) => {
    redisClient.del(id, (err, resp) => {
      if (err) {
        fail(err);
      } else {
        succ(true);
      }
    });
  });
});
//removeAll:: cl->List -> Task List e
const removeAll = curry((redisClient, keys) => {
  return keys.traverse(Task.of, remove(redisClient));
});

const broadcast = obj => {
  var wrapperObj = Object.assign({ fromInstance: instanceId }, obj);
  redisChatPublisherConnection.publish(
    INTERNAL_CHANNEL,
    JSON.stringify(wrapperObj)
  );
};
const sendMessage = (to, channel, obj) => {
  if (!to) {
    throw new Error(
      "sendMessage needs a target instance id specified as first arg"
    );
  }
  var wrapperObj = Object.assign(
    { fromInstance: instanceId, toInstance: to },
    obj
  );
  redisChatPublisherConnection.publish(channel, JSON.stringify(wrapperObj));
};
const onMessage = (func, channelOfInterest, removeFinally) => {
  let wrapperFunc = (channel, message) => {
    if (channel != channelOfInterest) {
      console.log("channel", channel, "channelOfInterest", channelOfInterest);
      return;
    }
    var instId = getInstanceId();
    console.log("onMessage:", message, "instanceid is", instId);
    var obj = JSON.parse(message);
    var to = obj.toInstance; //If toInstance is falsey then this is a broadcast message
    if (!to) {
      //This is a broadcast message
      return;
    }
    try {
      if (instId === to) {
        func.call(null, obj);
      } else {
        console.log("onMessage: Not meant for this instance");
      }
    } finally {
      if (removeFinally) {
        redisChatSubscriberConnection.removeListener("message", wrapperFunc);
      }
    }
  };
  redisChatSubscriberConnection.addListener("message", wrapperFunc);
};
const onBroadcastMessage = (func, removeFinally) => {
  let wrapperFunc = (channel, message) => {
    if (channel != INTERNAL_CHANNEL) {
      return;
    }
    var obj = JSON.parse(message);
    var to = obj.toInstance; //If toInstance is falsey then this is a broadcast message
    if (to) {
      //This is a point-to-point message
      return;
    }
    try {
      func.call(null, obj);
    } finally {
      if (removeFinally) {
        redisChatSubscriberConnection.removeListener("message", wrapperFunc);
      }
    }
  };
  redisChatSubscriberConnection.addListener("message", wrapperFunc);
};

const getInstanceId = () => instanceId;

module.exports = {
  setInstanceId: id => {
    instanceId = id;
  },
  getInstanceId: getInstanceId,
  connect: connect,
  broadcast: broadcast,
  sendMessage: sendMessage,
  onMessage: onMessage,
  onBroadcastMessage: onBroadcastMessage,
  INTERNAL_CHANNEL: INTERNAL_CHANNEL,
  subscribeChannel: subscribeChannel
};
