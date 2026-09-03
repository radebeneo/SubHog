import tailwindcss from "@tailwindcss/postcss";

const cleanForReactNative = () => {
  return {
    postcssPlugin: "clean-for-react-native",
    Rule(rule) {
      if (rule.selector && rule.selector.includes(":host")) {
        rule.selector = rule.selector.replace(/,?\s*:host/g, "");
      }
    },
    AtRule(atRule) {
      if (atRule.name === "supports" || atRule.name === "property") {
        atRule.remove();
      }
      if (atRule.name === "layer" && atRule.params === "base") {
        atRule.remove();
      }
      if (atRule.name === "media" && (atRule.params === "ios" || atRule.params === "android")) {
        atRule.remove();
      }
    },
    Declaration(decl) {
      if (decl.value.includes("2147483647")) {
        decl.value = decl.value.replace(/2147483647/g, "9999");
      }
      if (decl.value.includes("2147483648")) {
        decl.value = decl.value.replace(/2147483648/g, "9999");
      }
      if (decl.value.includes("infinity")) {
        decl.value = decl.value.replace(/calc\(infinity\s*\*\s*1px\)/g, "9999px").replace(/infinity/g, "9999");
      }
      if (decl.value.includes("var(--tw-border-style)")) {
        decl.value = decl.value.replace(/var\(--tw-border-style\)/g, "solid");
      }
      if (decl.value.includes("var(--tw-leading,")) {
        decl.value = decl.value.replace(/var\(--tw-leading,\s*(var\([^)]+\))\)/g, "$1");
      }
      if (decl.prop === "box-shadow" && decl.value.includes("var(--tw-")) {
        decl.remove();
      }
    },
  };
};
cleanForReactNative.postcss = true;

export default {
  plugins: [tailwindcss(), cleanForReactNative()],
};