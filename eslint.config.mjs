// eslint.config.mjs
export default [
  {
    files: ["lib/**/*.js", "scripts/**/*.js"],
    ignores: [
  "node_modules/**",
  "coverage/**",
  "tests/**",
  "lib/_archive/**",
  ".vercel/**",
  "lib/withTimeout.js",
  "lib/utils/withTimeout.js"
],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly"

      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  }
];
