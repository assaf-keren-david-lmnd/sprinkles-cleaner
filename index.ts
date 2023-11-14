import { parse, traverse } from "@babel/core";
import fs from "fs";
import util from "util";
import path from "path";
import { CSSAttribute, CSS_ATTRIBUTES } from "./css-attributes.js";

const readFile = util.promisify(fs.readFile);

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(entry);
    else if (d.isFile()) yield entry;
  }
}

async function run(
  code: string,
  found: Partial<Record<CSSAttribute, Set<string>>>
) {
  const result = parse(code, {
    presets: [
      ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
    ],
    filename: "script.ts",
  });

  if (result === null) {
    console.log("result is null");
    return;
  }

  traverse(result, {
    JSXAttribute: (path) => {
      const attributeName = path.node.name.name.toString() as CSSAttribute;
      if (
        path.node.value?.type === "StringLiteral" &&
        CSS_ATTRIBUTES.includes(attributeName)
      ) {
        (found[attributeName] ??= new Set()).add(path.node.value.value);
      }
    },
  });

  return found;
}

const root = process.argv[2];

console.log("root", root);

const found: Partial<Record<CSSAttribute, Set<string>>> = {};

for await (const f of walk(root)) {
  if (f.endsWith(".ts") || f.endsWith(".tsx")) {
    const code = await readFile(f, "utf-8");
    await run(code, found);
  }
}

Object.entries(found).forEach(([key, set]) => {
  found[key as CSSAttribute] = [...set] as any;
});

console.log("sprinkles:", JSON.stringify(found, null, 2));
