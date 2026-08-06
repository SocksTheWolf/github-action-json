import {
  endGroup,
  getBooleanInput,
  getInput,
  info,
  setFailed,
  setOutput,
  startGroup,
} from "@actions/core";
import has from "just-has";
import isEmpty from "just-is-empty";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { clone, equals, mergeDeepRight } from "ramda";
import unset from "unset-value";

type UnknownObject = Record<string, any>;

type TryParseObjectOptionalProps = { defaultValue?: UnknownObject };

const tryParseObject = (
  data: string,
  { defaultValue = {} }: TryParseObjectOptionalProps = {}
): UnknownObject => {
  try {
    const parsed = JSON.parse(data);

    return parsed || defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

(async () => {
  try {
    const pathInputParam = getInput("path");
    const replaceInputParam = getInput("replaceWith");
    const removeKeysParam = getInput("removeKeys");
    const dryRun = getBooleanInput("dryRun");
    const resolvePath = path.resolve(process.cwd(), pathInputParam);

    if (!existsSync(resolvePath)) {
      setFailed(`File \x1b[31;1m${resolvePath}\x1b[0m does not exist!`);
      return;
    }

    const packageJsonAsString = await (
      await readFile(resolvePath)
    ).toString();

    let packageJson = tryParseObject(packageJsonAsString);
    // if we should write to the file or not
    let doesNeedFileChanges: boolean = false;

    // check to see if we have input to add
    if (!isEmpty(replaceInputParam)) {
      const newPackageValues = tryParseObject(replaceInputParam);
      // Check to see if we parsed the new json properly
      if (!isEmpty(newPackageValues)) {
        // if we did, create a cloned version of the original package object
        // so we can check if the merge was successful (we could also do this earlier, but w/e)
        const clonedJson = clone(packageJson);
        packageJson = mergeDeepRight(packageJson, newPackageValues);

        // if changes were made, then flag we need to write out the file
        if (!equals(packageJson, clonedJson))
          doesNeedFileChanges = true;
      }
    }

    // remove keys from a list
    if (!isEmpty(removeKeysParam)) {
      removeKeysParam.split(",").forEach((item) => {
        const trimmedItem = item.trim();
        // only modify the package if we had the path
        if (has(packageJson, trimmedItem)) {
          info(`\x1b[32;1m removed key\x1b[0m ${trimmedItem}`);
          unset(packageJson, trimmedItem);
          doesNeedFileChanges = true;
        }
      });
    }

    const shouldWriteToFile: boolean = (dryRun != true && doesNeedFileChanges);
    if (shouldWriteToFile) {
      await writeFile(
        resolvePath,
        JSON.stringify(packageJson, null, 2)
      );
    }
    info(`Made file changes: ${shouldWriteToFile}`);

    // print out the content of the file for debug
    startGroup(`\x1b[32;1m ${pathInputParam}\x1b[0m content: `);
      info(`${JSON.stringify(packageJson, null, 2)}`);
    endGroup();

    // dump the entire object to gh output
    Object.keys(packageJson).forEach((keyname) => {
      const value = packageJson[keyname];
      setOutput(keyname, JSON.stringify(value));
    });
  } catch (error: any) {
    setFailed(error.message);
  }
})();
