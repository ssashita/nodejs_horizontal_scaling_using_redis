/**
 * Created by ssashita on 10/07/19.
 */

redis = require("./redisConnect");

// I am not going to code this class Resource fully but just give an outline
// Each kind of resource is treated conceptually like an RDBMS relation (table) or a
// 
MongoBD collection.Unfortunately redis has just one key store per database
// and I am not going to go the way of multiple redis databases, since that is
// overkill. A way around this is to prepend the keys with a namespace string that
// signifies the collection. This is done inside the methods of the RedisConnector class
// that this Resource class creates on instantiation
//

class Resource {
  constructor(namespaceKey, newRedisClient = false) {
    this.redisConnector = new RedisConnector(namespaceKey, newRedisClient);
  }
  create(obj, id = null) {
    //...
    //return this.redisConnector.store(obj,id)
  }
  update(resourceId, updateObj) {
    //...
    // return Task.of(this.get.bind(this))
    //   .ap(Task.of(resourceId))
    //   .map(functionToMassageTheOldResourceObj)
    //   .chain(
    //     curry((id, obj) => {
    //      ...
    //      return this.redisConnector.store(obj, id);
    //    })(resourceId)
    //  );
  }
  delete(resourceId) {
    //...
    //return this.redisConnector.delete(resourceId)
  }
  get(resourceId) {
    //...
    //return this.redisConnector.get(resourceId)
  }
}
