/**
 * The code in this file is completely inspired by the great github book
 * Professor Frisby's Mostly Adequate Guide to Functional Programming available at
 * https://github.com/MostlyAdequate/mostly-adequate-guide
 * Except a few lines that I changed, all the code is based off the Appendix A
 * of the book
 */
// always :: a -> b -> a
const always = curry((a, b) => a);
// compose :: ((a -> b), (b -> c),  ..., (y -> z)) -> a -> z
function compose(...fns) {
  const n = fns.length;
  return function $compose(...args) {
    let $args = args;
    for (let i = n - 1; i >= 0; i -= 1) {
      $args = [fns[i].call(null, ...$args)];
    }
    return $args[0];
  };
}
// curry :: ((a, b, ...) -> c) -> a -> b -> ... -> c
function curry(fn) {
  const arity = fn.length;
  return function $curry(...args) {
    if (args.length < arity) {
      return $curry.bind(null, ...args);
    }
    return fn.call(null, ...args);
  };
}
// either :: (a -> c) -> (b -> c) -> Either a b -> c
const either = curry((f, g, e) => {
  if (e.isLeft) {
    return f(e.$value);
  }
  return g(e.$value);
});
// identity :: x -> x
const identity = x => x;
// inspect :: a -> String
function inspect(x) {
  if (x && typeof x.inspect === "function") {
    return x.inspect();
  }
  function inspectFn(f) {
    return f.name ? f.name : f.toString();
  }
  function inspectTerm(t) {
    switch (typeof t) {
      case "string":
        return `'${t}'`;
      case "object": {
        const ts = Object.keys(t).map(k => [k, inspect(t[k])]);
        return `{${ts.map(kv => kv.join(": ")).join(", ")}}`;
      }
      default:
        return String(t);
    }
  }
  function inspectArgs(args) {
    return Array.isArray(args)
      ? `[${args.map(inspect).join(", ")}]`
      : inspectTerm(args);
  }
  return typeof x === "function" ? inspectFn(x) : inspectArgs(x);
}
// left :: a -> Either a b
const left = a => new Left(a);
// liftA2 :: (Applicative f) => (a1 -> a2 -> b) -> f a1 -> f a2 -> f b
const liftA2 = curry((fn, a1, a2) => a1.map(fn).ap(a2));
// liftA3 :: (Applicative f) => (a1 -> a2 -> a3 -> b) -> f a1 -> f a2 -> f a3 -> f b
const liftA3 = curry((fn, a1, a2, a3) =>
  a1
    .map(fn)
    .ap(a2)
    .ap(a3)
);
// maybe :: b -> (a -> b) -> Maybe a -> b
const maybe = curry((v, f, m) => {
  if (m.isNothing) {
    return v;
  }
  return f(m.$value);
});
// nothing :: () -> Maybe a
const nothing = () => Maybe.of(null);
// reject :: a -> Task a b
const reject = a => Task.rejected(a);

//Compose
const createCompose = curry(
  (F, G) =>
    class Compose {
      constructor(x) {
        this.$value = x;
      }
      inspect() {
        return `Compose(${inspect(this.$value)})`;
      }
      // ----- Pointed (Compose F G)
      static of(x) {
        return new Compose(F(G(x)));
      }
      // ----- Functor (Compose F G)
      map(fn) {
        return new Compose(this.$value.map(x => x.map(fn)));
      }
      // ----- Applicative (Compose F G)
      ap(f) {
        return f.map(this.$value);
      }
    }
);
//Either
class Either {
  constructor(x) {
    this.$value = x;
  }
  // ----- Pointed (Either a)
  static of(x) {
    return new Right(x);
  }
}
//Left
class Left extends Either {
  get isLeft() {
    return true;
  }
  get isRight() {
    return false;
  }
  static of(x) {
    throw new Error(
      "`of` called on class Left (value) instead of Either (type)"
    );
  }
  inspect() {
    return `Left(${inspect(this.$value)})`;
  }
  // ----- Functor (Either a)
  map() {
    return this;
  }
  // ----- Applicative (Either a)
  ap() {
    return this;
  }
  // ----- Monad (Either a)
  chain() {
    return this;
  }
  join() {
    return this;
  }
  // ----- Traversable (Either a)
  sequence(of) {
    return of(this);
  }
  traverse(of, fn) {
    return of(this);
  }
}
//Right
class Right extends Either {
  get isLeft() {
    return false;
  }
  get isRight() {
    return true;
  }
  static of(x) {
    throw new Error(
      "`of` called on class Right (value) instead of Either (type)"
    );
  }
  inspect() {
    return `Right(${inspect(this.$value)})`;
  }
  // ----- Functor (Either a)
  map(fn) {
    return Either.of(fn(this.$value));
  }
  // ----- Applicative (Either a)
  ap(f) {
    return f.map(this.$value);
  }
  // ----- Monad (Either a)
  chain(fn) {
    return fn(this.$value);
  }
  join() {
    return this.$value;
  }
  // ----- Traversable (Either a)
  sequence(of) {
    return this.traverse(of, identity);
  }
  traverse(of, fn) {
    fn(this.$value).map(Either.of);
  }
}
//Identity
class Identity {
  constructor(x) {
    this.$value = x;
  }
  inspect() {
    return `Identity(${inspect(this.$value)})`;
  }
  // ----- Pointed Identity
  static of(x) {
    return new Identity(x);
  }
  // ----- Functor Identity
  map(fn) {
    return Identity.of(fn(this.$value));
  }
  // ----- Applicative Identity
  ap(f) {
    return f.map(this.$value);
  }
  // ----- Monad Identity
  chain(fn) {
    return this.map(fn).join();
  }
  join() {
    return this.$value;
  }
  // ----- Traversable Identity
  sequence(of) {
    return this.traverse(of, identity);
  }
  traverse(of, fn) {
    return fn(this.$value).map(Identity.of);
  }
}
//IO
class IO {
  constructor(fn) {
    this.unsafePerformIO = fn;
  }
  inspect() {
    return `IO(?)`;
  }
  // ----- Pointed IO
  static of(x) {
    return new IO(() => x);
  }
  // ----- Functor IO
  map(fn) {
    return new IO(
      compose(
        fn,
        this.unsafePerformIO
      )
    );
  }
  // ----- Applicative IO
  ap(f) {
    return this.chain(fn => f.map(fn));
  }
  // ----- Monad IO
  chain(fn) {
    return this.map(fn).join();
  }
  join() {
    return this.unsafePerformIO();
  }
}
//List
class List {
  constructor(xs) {
    this.$value = xs;
  }
  inspect() {
    return `List(${inspect(this.$value)})`;
  }
  concat(x) {
    return new List(this.$value.concat(x));
  }
  // ----- Pointed List
  static of(x) {
    return new List([x]);
  }
  // ----- Functor List
  map(fn) {
    return new List(this.$value.map(fn));
  }
  // ----- Traversable List
  sequence(of) {
    return this.traverse(of, identity);
  }
  traverse(of, fn) {
    return this.$value.reduce(
      (f, a) =>
        fn(a)
          .map(b => bs => bs.concat(b))
          .ap(f),
      of(new List([]))
    );
  }
  filter(fn) {
    return new List(this.$value.filter(fn));
  }
  forEach(fn) {
    return this.$value.forEach(fn);
  }
}
//Map
class Map {
  constructor(x) {
    this.$value = x;
  }
  inspect() {
    return `Map(${inspect(this.$value)})`;
  }
  insert(k, v) {
    const singleton = {};
    singleton[k] = v;
    //return Map.of(Object.assign({}, this.$value, singleton));
    return new Map(Object.assign({}, this.$value, singleton));
  }
  reduceWithKeys(fn, zero) {
    return Object.keys(this.$value).reduce(
      (acc, k) => fn(acc, this.$value[k], k),
      zero
    );
  }
  // ----- Functor (Map a)
  map(fn) {
    return this.reduceWithKeys((m, v, k) => m.insert(k, fn(v)), new Map({}));
  }
  // ----- Traversable (Map a)
  sequence(of) {
    return this.traverse(of, identity);
  }
  traverse(of, fn) {
    return this.reduceWithKeys(
      (f, a, k) =>
        fn(a)
          .map(b => m => m.insert(k, b))
          .ap(f),
      of(new Map({}))
    );
  }
}
//Maybe
class Maybe {
  get isNothing() {
    return this.$value === null || this.$value === undefined;
  }
  get isJust() {
    return !this.isNothing;
  }
  constructor(x) {
    this.$value = x;
  }
  inspect() {
    return `Maybe(${inspect(this.$value)})`;
  }
  // ----- Pointed Maybe
  static of(x) {
    return new Maybe(x);
  }
  // ----- Functor Maybe
  map(fn) {
    return this.isNothing ? this : Maybe.of(fn(this.$value));
  }
  // ----- Applicative Maybe
  ap(f) {
    return this.isNothing ? this : f.map(this.$value);
  }
  // ----- Monad Maybe
  chain(fn) {
    return this.map(fn).join();
  }
  join() {
    return this.isNothing ? this : this.$value;
  }
  // ----- Traversable Maybe
  sequence(of) {
    this.traverse(of, identity);
  }
  traverse(of, fn) {
    return this.isNothing ? of(this) : fn(this.$value).map(Maybe.of);
  }
}
//Task
class Task {
  constructor(fork) {
    this.fork = fork;
  }
  inspect() {
    return "Task(?)";
  }
  static rejected(x) {
    return new Task((reject, _) => reject(x));
  }
  // ----- Pointed (Task a)
  static of(x) {
    return new Task((_, resolve) => resolve(x));
  }
  // ----- Functor (Task a)
  map(fn) {
    return new Task((reject, resolve) =>
      this.fork(
        reject,
        compose(
          resolve,
          fn
        )
      )
    );
  }
  // ----- Applicative (Task a)
  ap(f) {
    return this.chain(fn => f.map(fn));
  }
  // ----- Monad (Task a)
  chain(fn) {
    return new Task((reject, resolve) =>
      this.fork(reject, x => fn(x).fork(reject, resolve))
    );
  }
  join() {
    return this.chain(identity);
  }
}
//add
// add :: Number -> Number -> Number
const add = curry((a, b) => a + b);
//chain
// chain :: Monad m => (a -> m b) -> m a -> m b
const chain = curry((fn, m) => m.chain(fn));
//concat
// concat :: String -> String -> String
const concat = curry((a, b) => a.concat(b));
//eq
// eq :: Eq a => a -> a -> Boolean
const eq = curry((a, b) => a === b);
//filter
// filter :: (a -> Boolean) -> [a] -> [a]
const filter = curry((fn, xs) => xs.filter(fn));
//flip
// flip :: (a -> b) -> (b -> a)
const flip = curry((fn, a, b) => fn(b, a));
//forEach
// forEach :: (a -> ()) -> [a] -> ()
const forEach = curry((fn, xs) => xs.forEach(fn));
//head
// head :: [a] -> a
const head = xs => xs[0];
//intercalate
// intercalate :: String -> [String] -> String
const intercalate = curry((str, xs) => xs.join(str));
//join
// join :: Monad m => m (m a) -> m a
const join = m => m.join();
//last
// last :: [a] -> a
const last = xs => xs[xs.length - 1];
//map
// map :: Functor f => (a -> b) -> f a -> f b
const map = curry((fn, f) => f.map(fn));
//match
// match :: RegExp -> String -> Boolean
const match = curry((re, str) => re.test(str));
//prop
// prop :: String -> Object -> a
const prop = curry((p, obj) => obj[p]);
//reduce
// reduce :: (b -> a -> b) -> b -> [a] -> b
const reduce = curry((fn, zero, xs) => xs.reduce(fn, zero));
//replace
// replace :: RegExp -> String -> String -> String
const replace = curry((re, rpl, str) => str.replace(re, rpl));
//reverse
// reverse :: [a] -> [a]
const reverse = x =>
  Array.isArray(x)
    ? x.reverse()
    : x
        .split("")
        .reverse()
        .join("");
//safeHead
// safeHead :: [a] -> Maybe a
const safeHead = compose(
  Maybe.of,
  head
);
//safeLast
// safeLast :: [a] -> Maybe a
const safeLast = compose(
  Maybe.of,
  last
);
//safeProp
// safeProp :: String -> Object -> Maybe a
const safeProp = curry((p, obj) =>
  compose(
    Maybe.of,
    prop(p)
  )(obj)
);
//sequence
// sequence :: (Applicative f, Traversable t) => (a -> f a) -> t (f a) -> f (t a)
const sequence = curry((of, f) => f.sequence(of));
//sortBy
// sortBy :: Ord b => (a -> b) -> [a] -> [a]
const sortBy = curry((fn, xs) => {
  return xs.sort((a, b) => {
    if (fn(a) === fn(b)) {
      return 0;
    }
    return fn(a) > fn(b) ? 1 : -1;
  });
});
//split
// split :: String -> String -> [String]
const split = curry((sep, str) => str.split(sep));
//take
// take :: Number -> [a] -> [a]
const take = curry((n, xs) => xs.slice(0, n));
//toLowerCase
// toLowerCase :: String -> String
const toLowerCase = s => s.toLowerCase();
//toString
// toString :: a -> String
const toString = String;
//toUpperCase
// toUpperCase :: String -> String
const toUpperCase = s => s.toUpperCase();
//traverse
// traverse :: (Applicative f, Traversable t) => (a -> f a) -> (a -> f b) -> t a -> f (t b)
const traverse = curry((of, fn, t) => t.traverse(of, fn));
//unsafePerformIO
// unsafePerformIO :: IO a -> a
const unsafePerformIO = io => io.unsafePerformIO();

// idToMaybe :: Identity a -> Maybe a
const idToMaybe = x => Maybe.of(x.$value);
// idToIO :: Identity a -> IO a
const idToIO = x => IO.of(x.$value);
// eitherToTask :: Either a b -> Task a b
const eitherToTask = either(Task.rejected, Task.of);
// ioToTask :: IO a -> Task () a
const ioToTask = x =>
  new Task((reject, resolve) => resolve(x.unsafePerformIO())); // maybeToTask :: Maybe a -> Task () a
const maybeToTask = x => (x.isNothing ? Task.rejected() : Task.of(x.$value));
// arrayToMaybe :: [a] -> Maybe a
const arrayToMaybe = x => Maybe.of(x[0]);

// promiseToTask :: Promise a b -> Task a b
const promiseToTask = x =>
  new Task((reject, resolve) => x.then(resolve).catch(reject));
// taskToPromise :: Task a b -> Promise a b
const taskToPromise = x =>
  new Promise((resolve, reject) => x.fork(reject, resolve));
const convertTaskIOTaskEither2Task = t => {
  return t
    .chain(ioToTask)
    .join()
    .chain(eitherToTask);
};
const convertTaskIOTaskEither2TaskEither = t => {
  return t.chain(ioToTask).join();
};

const convertIOTaskEither2Task = io => {
  return ioToTask(io)
    .join()
    .chain(eitherToTask);
};
module.exports = {
  promiseToTask: promiseToTask,
  maybeToTask: maybeToTask,
  eitherToTask: eitherToTask,
  ioToTask: ioToTask,
  chain: chain,
  map: map,
  compose: compose,
  Maybe: Maybe,
  List: List,
  Either: Either,
  Right: Right,
  Left: Left,
  Task: Task,
  Map: Map,
  List: List,
  IO: IO,
  createCompose: createCompose,
  Identity: Identity,
  curry: curry,
  inspect: inspect,
  join: join,
  convertTaskIOTaskEither2Task: convertTaskIOTaskEither2Task,
  convertTaskIOTaskEither2TaskEither: convertTaskIOTaskEither2TaskEither,
  convertIOTaskEither2Task: convertIOTaskEither2Task,
  tite2t: convertTaskIOTaskEither2Task,
  tite2te: convertTaskIOTaskEither2TaskEither,
  ite2t: convertIOTaskEither2Task,
  concat: concat,
  filter: filter,
  take: take,
  prop: prop,
  traverse: traverse,
  forEach: forEach,
  either: either
};
