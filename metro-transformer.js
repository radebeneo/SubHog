const path = require("path");
const fs = require("fs");
const reactNativeCssTransformerPath = path.join(
  __dirname,
  "node_modules/react-native-css/dist/commonjs/metro/metro-transformer.js"
);
const reactNativeCssTransformer = require(reactNativeCssTransformerPath);
const compiler = require("react-native-css/compiler");

const originalCompile = compiler.compile;

function cleanCssForReactNative(css) {
  if (typeof css !== "string") return css;
  return css
    .replace(/@supports\s*\([^{]+\)\s*\{[\s\S]*?\}\s*\}/g, "")
    .replace(/@property\s+[^{]+\{[\s\S]*?\}/g, "")
    .replace(/@layer\s+base\s*\{[\s\S]*?\n\}/g, "")
    .replace(/calc\(infinity\s*\*\s*1px\)/g, "9999px")
    .replace(/calc\(infinity\s*\*\s*1rem\)/g, "9999px")
    .replace(/2147483648/g, "9999")
    .replace(/infinity/g, "9999")
    .replace(/var\(--tw-border-style\)/g, "solid")
    .replace(/var\(--tw-leading,\s*(var\([^)]+\))\)/g, "$1")
    .replace(/box-shadow:\s*var\(--tw-[^;]+;/g, "");
}

compiler.compile = function (css, options) {
  const sanitized = cleanCssForReactNative(css);
  try {
    fs.writeFileSync(path.join(__dirname, "debug-metro-output.css"), sanitized);
  } catch(e) {}
  return originalCompile.call(this, sanitized, options);
};

module.exports = reactNativeCssTransformer;
