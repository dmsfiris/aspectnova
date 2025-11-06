// stubs/zustand-middleware.web.js
function passthrough(fn /*, options */) {
  return (set, get, api) => fn(set, get, api);
}
module.exports = {
  devtools: passthrough // no-op on web to avoid import.meta
  // (optionally re-export other middlewares if you need them)
};
