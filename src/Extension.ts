import discord from "discord.js-selfbot-v13";
import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { execSync, spawn } from "node:child_process";
import admZip from "adm-zip";
import os from "node:os";

import { global } from "../index.js";
import { Configuration } from "./lib/class.js";
import { getResult, trueFalse, log } from "./Console.js";

const ranInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};

const mapInt = (number: number, fromMIN: number, fromMAX: number, toMIN: number, toMAX: number) => {
  return Math.floor(((number - fromMIN) / (fromMAX - fromMIN)) * (toMAX - toMIN) + toMIN);
};

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const timeHandler = (startTime: number, endTime: number, removeDay = false) => {
  const ms = Math.abs(startTime - endTime);
  const sc = Math.round((((ms % 86400000) % 3600000) % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  const mn = Math.floor(((ms % 86400000) % 3600000) / 60000)
    .toString()
    .padStart(2, "0");
  const hr = Math.floor((ms % 86400000) / 3600000)
    .toString()
    .padStart(2, "0");
  const dy = Math.floor(ms / 86400000);
  return (removeDay ? "" : dy + (dy > 1 ? " days " : " day ")) + hr + ":" + mn + ":" + sc;
};

const consoleNotify = async () => {
  console.log("\n");
  console.log("\x1b[92mTotal battle(s) sent: \x1b[0m" + global.totalbattle);
  console.log("\x1b[92mTotal hunt(s) sent: \x1b[0m" + global.totalhunt);
  console.log("\x1b[92mTotal owo(s)/uwu(s) sent: \x1b[0m" + global.totalowo);
  console.log("\x1b[92mTotal quote(s) sent: \x1b[0m" + global.totaltxt);
  console.log("\x1b[92mTotal other command(s) sent: \x1b[0m" + global.totalOtherCmd);
  console.log(
    `\x1b[92mTotal pray(s)/curse(s) ${global.config.autoPrayUser ?? "your self"} sent: \x1b[0m` + global.totalpraycurse
  );
  console.log("\x1b[92mTotal active time: \x1b[0m" + timeHandler(global.startTime, Date.now()));
  console.log("\x1b[36mSELFBOT HAS BEEN TERMINATED!\x1b[0m");
};

const send = async (str: string, type: "normalCommand" | "quote" | "non-prefix" = "normalCommand") => {
  if (global.captchaDetected) return;
  try {
    global.channel.sendTyping();
    await sleep(ranInt(120, 3700));
    switch (type) {
      case "quote":
        global.channel.send(str);
        global.totaltxt++;
        log(str.slice(0, 25) + "...", "s");
        break;
      case "normalCommand":
        const cmd = global.config.botPrefix + str;
        global.channel.send(cmd);
        log(cmd);
        break;
      case "non-prefix":
        await global.channel.send(str);
        log(str.slice(0, 25), "s");
        break;
    }
  } catch (error) {
    const typeError =
      type == "normalCommand"
        ? "Failed To Send OwO Command"
        : type == "non-prefix"
        ? "Failed To Send Non Prefix Command"
        : "Failed To Send Quote";
    global.error = [...global.error, typeError];
  }
};

const copyDirectory = (sourceDir: string, destDir: string) => {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const files = fs.readdirSync(sourceDir);
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);
    if (fs.statSync(sourcePath).isDirectory()) copyDirectory(sourcePath, destPath);
    else fs.copyFileSync(sourcePath, destPath);
  }
};

const shuffleArray = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const accountCheck = (input?: string | string[]): Promise<discord.Client> => {
  const client = new discord.Client({
    checkUpdate: false,
    patchVoice: true,
    autoRedeemNitro: false,
    syncStatus: false,
  });
  return new Promise(async (resolve, reject) => {
    client.once("ready", () => resolve(client));
    try {
      if (typeof input == "string") await client.login(input);
      else if (typeof input == "object") await client.normalLogin(input[0], input[1], input[2]);
      else client.QRLogin();
    } catch (error) {
      reject("Invalid Data, Please Login Again.");
    }
  });
};

const accountRemove = (data: { [keys: string]: Configuration }, id: string) => {
  delete data[id];
  fs.writeFileSync(global.DataPath, JSON.stringify(data));
};

const reloadPresence = (client: discord.Client) => {
  // const activity = new discord.RichPresence()
  //   .setApplicationId("1188482072197738557")
  //   .setType("STREAMING")
  //   .setName("Online but don't reply=))")
  //   .setDetails("Sleeping or studying...")
  //   .setStartTimestamp(new Date(global.startTime))
  //   .setAssetsLargeImage(client.user?.bannerURL())
  //   .setAssetsLargeText("Do you love me?")
  //   .setAssetsSmallImage(client.user?.avatarURL({ format: "png", size: 1024 }))
  //   .setAssetsSmallText("Frontend Coder from Viet Nam")
  //   .addButton("Github", "https://github.com/sunaookamishirokodev")
  //   .addButton("Facebook", "https://www.facebook.com/sunaookamishirokodev");
  // client.user?.setActivity(activity.toJSON());
  // client.user?.setStatus("dnd");
};

async function imageURLtoBase64(image_url = "") {
  return new Promise((resolve, reject) => {
    axios
      .get(image_url, { responseType: "arraybuffer" })
      .then((res) => {
        resolve(Buffer.from(res.data).toString("base64"));
      })
      .catch(reject);
  });
}

const solveCaptcha = async (url?: string, callback?: any) => {
  const imageBase64 = await imageURLtoBase64(url);
  if (imageBase64) {
    if (global.config.captchaAPI === 1) {
      const params = {
        userid: global.config.apiUser,
        apikey: global.config.apiKey,
        data: imageBase64,
      };
      const api = "https://api.apitruecaptcha.org/one/gettext";

      axios
        .post(api, params, {
          headers: { "Content-Type": "application/json" },
          responseType: "json",
        })
        .then((res) => callback(res.data));
    } else if (global.config.captchaAPI === 2) {
    }
  }
};

const gitUpdate = () => {
  try {
    execSync("git stash");
    execSync("git pull --force");
    console.log("Git pull successful.");
    console.log("Resetting local changes...");
    execSync("git reset --hard");
  } catch (error: any) {
    console.error("Error updating project from Git:", error);
  }
};

const manualUpdate = async () => {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537",
    };
    const res = await axios.get(`https://github.com/sunaookamishirokodev/owo-selfbot/archive/master.zip`, {
      responseType: "arraybuffer",
      headers,
    });
    const updatePath = path.resolve("/", "updateCache.zip");
    fs.writeFileSync(updatePath, res.data);

    const zip = new admZip(updatePath);
    const zipEntries = zip.getEntries();
    zip.extractAllTo(os.tmpdir(), true);
    const updatefolder = path.join(os.tmpdir(), zipEntries[0].entryName);
    if (!fs.existsSync(updatefolder)) throw new Error("Failed To Extract Files");
    copyDirectory(updatefolder, process.cwd());
  } catch (error: any) {
    console.error("Error updating project from GitHub:", error);
  }
};

const checkUpdate = async () => {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537",
    };
    const response = await axios.get(
      `https://raw.githubusercontent.com/sunaookamishirokodev/owo-selfbot/main/package.json`,
      {
        headers,
      }
    );
    const ghVersion = response.data.version;
    const version = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8")).version;
    if (ghVersion > version) {
      const confirm = await getResult(trueFalse("Newer Version Detected, Do You Want To Update"));
      if (confirm) {
        log("Please Be Patient While We Are Updating The Client.", "i");
        await sleep(2000);
        if (fs.existsSync(".git")) {
          try {
            execSync("git --version");
            log("Updating with Git...", "i");
            gitUpdate();
          } catch (error) {
            log("Git is not installed on this device. Updating files individually...", "i");
            await manualUpdate();
          }
        } else await manualUpdate();
        log("Update Completed, Attempting To Install Libraries", "i");
        try {
          execSync("npm install");
          log("Libraries Installed, Restarting Selfbot", "i");
          await sleep(5000);
          const child_process = spawn("node .", [process.cwd()], {
            shell: true,
            detached: true,
            stdio: "ignore",
          });
          child_process.unref();
          process.exit(1);
        } catch (error) {
          log("Failed To Install Libraries", "e");
        }
      } else log("Update Cancelled", "i");
    } else log("No Update Found", "i");
  } catch (error) {
    console.log(error);
    log("Failed To Check For Update", "e");
  }
};

export {
  timeHandler,
  consoleNotify,
  accountCheck,
  accountRemove,
  reloadPresence,
  checkUpdate,
  solveCaptcha,
  mapInt,
  send,
  sleep,
  shuffleArray,
  ranInt,
};
