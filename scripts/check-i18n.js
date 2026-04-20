const fs = require("fs");
const path = require("path");

const messagesDir = path.join(__dirname, "../messages");

const base = JSON.parse(
  fs.readFileSync(path.join(messagesDir, "en.json"), "utf-8")
);

const files = fs.readdirSync(messagesDir).filter((f) => f !== "en.json");

function findMissing(baseObj, targetObj, prefix = "") {
  const missing = [];

  for (const key in baseObj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (!(key in targetObj)) {
      missing.push(fullKey);
    } else if (
      typeof baseObj[key] === "object" &&
      typeof targetObj[key] === "object"
    ) {
      missing.push(
        ...findMissing(baseObj[key], targetObj[key], fullKey)
      );
    }
  }

  return missing;
}

files.forEach((file) => {
  const target = JSON.parse(
    fs.readFileSync(path.join(messagesDir, file), "utf-8")
  );

  const missing = findMissing(base, target);

  if (missing.length > 0) {
    console.log(`\n❌ ${file} missing keys:`);
    missing.forEach((k) => console.log("   -", k));
  } else {
    console.log(`\n✅ ${file} OK`);
  }
});
