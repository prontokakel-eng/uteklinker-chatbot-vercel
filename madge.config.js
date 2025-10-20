export default {
  fileExtensions: ["js", "mjs"],
  excludeRegExp: [
    "node_modules",
    "^tests/_archive/.*",
    "^lib/_archive/.*",
    "^coverage/.*"
  ],
  detectiveOptions: {
    es6: { mixedImports: true }
  }
};
