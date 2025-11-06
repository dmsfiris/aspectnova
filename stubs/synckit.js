// Minimal browser stub to avoid bundling Node worker code on web
module.exports = new Proxy(
  {},
  {
    get() {
      throw new Error("synckit is not available in the browser");
    }
  }
);
