// .eslintrc.js
/* eslint-env node */
const path = require("path");

const isCI = process.env.CI === "true";

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,

  extends: [
    "universe/native",
    "plugin:react-hooks/recommended",
    "plugin:react-native/all",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "prettier"
  ],

  plugins: ["react", "react-native", "react-hooks", "import", "@typescript-eslint"],

  // Base (espree) — do NOT put `project` here
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: { jsx: true }
  },

  env: { es2021: true, node: true, browser: true },

  settings: {
    "import/internal-regex": "^@(/|$)",
    "import/resolver": {
      // Point the TS resolver at the typed-linting project file
      typescript: { project: path.join(__dirname, "tsconfig.eslint.json") },
      alias: {
        map: [
          ["@", "./src"],
          ["@app", "./app"],
          ["@api", "./src/api/index.ts"]
        ],
        extensions: [".js", ".jsx", ".ts", ".tsx"]
      },
      node: { extensions: [".js", ".jsx", ".ts", ".tsx"] }
    }
  },

  rules: {
    // --- General hygiene ---
    "no-console": [isCI ? "error" : "warn", { allow: ["warn", "error"] }],
    "prefer-const": "warn",

    // --- React / RN ---
    "react/prop-types": "off",
    "react/jsx-no-useless-fragment": "warn",
    "react-native/no-inline-styles": "off",
    "react-native/no-color-literals": "off",
    "react-native/sort-styles": "off",
    "react-native/no-raw-text": "off",

    // --- Hooks ---
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // --- Imports ---
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true }
      }
    ],
    "import/newline-after-import": "warn",
    "import/no-duplicates": "warn",
    "import/no-useless-path-segments": "warn",
    "import/first": "warn",
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: [
          "**/*.test.{ts,tsx,js,jsx}",
          "**/*.spec.{ts,tsx,js,jsx}",
          "**/setupTests.{ts,tsx,js,jsx}",
          "**/*.config.{js,ts}",
          "babel.config.js"
        ],
        optionalDependencies: false
      }
    ],

    // Keep these relaxed for RN ergonomics
    "import/no-relative-parent-imports": "off",
    "import/no-named-as-default-member": "off"
  },

  overrides: [
    // ---------- TypeScript app/source files (typed linting) ----------
    {
      files: ["**/*.ts", "**/*.tsx"],
      excludedFiles: [
        // exclude config files from this typed block
        "app.config.ts",
        "*.config.ts",
        "metro.config.ts",
        "vite.config.ts",
        "vitest.config.ts",
        "jest.config.ts",
        "tailwind.config.ts"
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: path.join(__dirname, "tsconfig.eslint.json"),
        tsconfigRootDir: __dirname,
        ecmaVersion: 2021,
        sourceType: "module"
      },
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking"
      ],
      rules: {
        "@typescript-eslint/consistent-type-imports": [
          "warn",
          {
            prefer: "type-imports",
            fixStyle: "inline-type-imports",
            disallowTypeAnnotations: false
          }
        ],
        "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
        "@typescript-eslint/no-unused-vars": [
          "warn",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_"
          }
        ],
        // RN-friendly tweak: allow async handlers in JSX
        "@typescript-eslint/no-misused-promises": [
          "error",
          { checksVoidReturn: { attributes: false } }
        ]
      }
    },

    // ---------- TS config files (no typed project; avoid the error) ----------
    {
      files: [
        "app.config.ts",
        "*.config.ts",
        "metro.config.ts",
        "vite.config.ts",
        "vitest.config.ts",
        "jest.config.ts",
        "tailwind.config.ts"
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: null, // <- critical: disable typed-linting here
        tsconfigRootDir: __dirname,
        ecmaVersion: 2021,
        sourceType: "module"
      },
      rules: {
        "@typescript-eslint/consistent-type-imports": "off",
        "@typescript-eslint/no-unused-vars": "off"
      }
    },

    // ---------- Plain JS config files ----------
    {
      files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
      rules: {
        "@typescript-eslint/consistent-type-imports": "off"
      }
    }
  ],

  ignorePatterns: [
    "node_modules/",
    "dist/",
    "build/",
    ".expo/",
    ".expo-shared/",
    "android/",
    "ios/"
  ]
};
