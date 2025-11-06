// Stub: if some tooling accidentally gets bundled on web
module.exports = {
  minify() {
    throw new Error("terser should not run in the browser bundle");
  }
};
