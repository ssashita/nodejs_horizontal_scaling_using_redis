var redis = require("../redisConnect");
var expect = require("chai").expect;
var cp = require("child_process");
var routers = require("../routers");
var { Task } = require("../essentials");

describe("redis connection testing", () => {
  let redisConnectionResource1;
  beforeEach(done => {
    redisConnectionResource1 = redis.connect("resource1");
    redis.setInstanceId("test");
    redisConnectionResource1.unreserveAll().fork(
      err => {
        console.log(err);
        done();
      },
      resp => {
        console.log(resp);
        done();
      }
    );
  });
  it("connect to redis", done => {
    console.log("Mocha test suite - redis connect");
    expect(
      redisConnectionResource1,
      "Non falsey redisConnectionResource1 object"
    ).to.exist;
    done();
  });
  it("reserve one resource", done => {
    console.log("reserve one resource");
    expect(redisConnectionResource1.reserve("rid1").inspect()).to.equal(
      "Task(?)"
    );
    redisConnectionResource1.reserve("rid1").fork(
      err => {
        console.log(err);
        done(new Error("failed"));
      },
      resp => {
        console.log("reserve succeeded with return value", resp);
        done();
      }
    );
  });
  it("reserve one resource, then another instance reserves same", done => {
    redisConnectionResource1
      .reserve("rid1")
      .chain(() => {
        redis.setInstanceId("test2");
        return redisConnectionResource1.reserve("rid1");
      })
      .fork(
        err => {
          console.log(err);
          done(new Error("Failed:" + err));
        },
        resp => {
          console.log("reserve should have failed but succeeded", resp);
          if (resp) {
            done(
              new Error(
                "Reserve of same resource by different instance succeeded"
              )
            );
          } else {
            done();
          }
        }
      );
  });
  it("reserve many resources", done => {
    redisConnectionResource1.reserveMultiple(...["rid1", "rid2", "rid3"]).fork(
      err => {
        console.log(err);
        done(new Error("failed"));
      },
      resp => {
        console.log("reserveMultiple succeeded with return value", resp);
        done();
      }
    );
  });
  it("get the owner (reserver) instanceid of a resource", done => {
    redisConnectionResource1
      .reserve("rid1")
      .chain(() => {
        return redisConnectionResource1.getReserver("rid1");
      })
      .fork(
        err => {
          done(new Error(err));
        },
        resp => {
          expect(resp).to.equal("test");
          done();
        }
      );
  });
  it("broadcast a message to the self same instance withe two handlers", done => {
    redis.onBroadcastMessage(obj => {
      console.log("Received broadcast message is", obj);
    });
    redis.onBroadcastMessage(obj => {
      console.log("Processing broadcast message with yet another handler", obj);
      done();
    }, true);
    redis.broadcast({ cakes: 16, pastries: 64 });
  });
  it("Send a message to self", done => {
    let nTimes = 0;
    redis.onMessage(
      obj => {
        ++nTimes;
        console.log("Received  message is", obj, "nTimes is", nTimes);
      },
      redis.INTERNAL_CHANNEL,
      true
    ); //true means unlink handler after one execution
    redis.sendMessage("test", redis.INTERNAL_CHANNEL, {
      cakes: 9,
      pastries: 27
    });
    redis.sendMessage("test", redis.INTERNAL_CHANNEL, {
      cakes: 9,
      pastries: 27
    }); //This should get ignored
    setTimeout(() => {
      expect(nTimes).to.equal(1);
      done();
    }, 1000);
  });

  it("Test communication for horizontal scaling - THIS NEEDS A SERVER TO BE STARTED (type on command line 'PORT=3001 INSTANCE_ID=test2 node routers.js')", done => {
    redis.setInstanceId("test2");
    return redisConnectionResource1
      .reserve("rid2")
      .chain(() => {
        redis.setInstanceId("test");
        return routers.testInfra("rid2", "testInfraChannel", {
          status: code => console.log("status is ", code),
          send: obj => {
            console.log("sending response", obj);
            expect(obj.status).to.equal(200);
          }
        });
      })
      .fork(
        err => {
          console.log("test end with ERROR", err);
          setTimeout(done, 4000);
        },
        requestHandledLocally => {
          if (requestHandledLocally) {
            console.log("test end");
          } else {
            console.log("test end for remote");
          }
          expect(requestHandledLocally).to.be.false;
          setTimeout(done, 2000);
        }
      );
  }).timeout(4000);
  /*
  it("Test communication between two server instances", done => {
    //Only reserve rid2 for instance test2 for one of the tests
    redis.setInstanceId("test2");
    redisConnectionResource1
      .reserve("rid2")
      .chain(() => {
        redis.setInstanceId("test");
        let childProc = cp.spawn("node", ["routers.js"], {
          env: { PORT: 3001, INSTANCE_ID: "test2" },
          cwd: "/home/ssashita/nodejs_horizontal_scaling_using_redis"
        });

        childProc.stdout.on("data", chunk => {
          console.log("From child proc-stdout");
          var str = Buffer.from(chunk, "UTF8").toString();
          console.log(str);
          if (str.indexOf("connected for redisChatPublisherConnection") > 0) {
            routers
              .testInfra("rid2", {
                status: code => console.log("status is ", code),
                send: obj => {
                  console.log("sending response", obj);
                }
              })
              .fork(
                err => {
                  setTimeout(done, 4000);
                },
                reply => {
                  setTimeout(done, 4000);
                }
              );
          }
        });

        childProc.stderr.on("data", chunk => {
          console.log("From child proc-stderr");
          console.log(Buffer.from(chunk, "UTF8").toString());
        });

        return Task.of(true);
      })
      .fork(
        err => {
          console.log(err);
        },
        reply => {
          console.log("test end");
        }
      );
  }).timeout(10000);
  */
});
