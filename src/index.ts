import {
  endGroup,
  getBooleanInput,
  getInput,
  info,
  setFailed,
  setOutput,
  startGroup,
} from "@actions/core";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { isEmpty, mergeDeepRight } from "ramda";
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
    let doesNeedFileChanges: boolean = false;

    if (!isEmpty(replaceInputParam)) {
      const newPackageValues = tryParseObject(replaceInputParam);
      // Check to see if we parsed the new json properly
      if (!isEmpty(newPackageValues)) {
        packageJson = mergeDeepRight(packageJson, newPackageValues);
        doesNeedFileChanges = true;
      }
    }

    if (!isEmpty(removeKeysParam)) {
      removeKeysParam.split(",").forEach((item) => {
        const trimmedItem = item.trim();
        startGroup(`\x1b[32;1m removing key\x1b[0m ${trimmedItem}: `);
          unset(packageJson, trimmedItem);
        endGroup();
      });
      doesNeedFileChanges = true;
    }

    if (dryRun != true && doesNeedFileChanges) {
      await writeFile(
        resolvePath,
        JSON.stringify(packageJson, null, 2)
      );
    }

    startGroup(`\x1b[32;1m package.json\x1b[0m content: `);
    info(`${JSON.stringify(packageJson, null, 2)}`);
    endGroup();

    Object.keys(packageJson).forEach((keyname) => {
      const value = packageJson[keyname];
      setOutput(keyname, JSON.stringify(value));
    });
  } catch (error: any) {
    setFailed(error.message);
  }
})();
