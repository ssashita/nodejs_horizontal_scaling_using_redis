var redis = require("../redisConnect");
var expect = require("chai").expect;

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
    redis.onMessage(obj => {
      ++nTimes;
      console.log("Received broadcast message is", obj, "nTimes is", nTimes);
    }, true); //true means unlink handler after one execution
    redis.sendMessage("test", { cakes: 9, pastries: 27 });
    redis.sendMessage("test", { cakes: 9, pastries: 27 }); //This should get ignored
    setTimeout(() => {
      expect(nTimes).to.equal(1);
      done();
    }, 1000);
  });
});
