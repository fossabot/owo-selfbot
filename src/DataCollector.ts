import fs from "node:fs";
import {
  InquirerInputQuestion,
  InquirerCheckboxQuestion,
  InquirerListQuestion,
  Configuration,
  resolveData,
} from "./lib/class.js";
import { Client } from "discord.js-selfbot-v13";
import { accountCheck, accountRemove, checkUpdate } from "./Extension.js";
import { getResult, trueFalse, log } from "./Console.js";
import { global } from "../index.js";

const document = `Copyright 2023 © Eternity_VN x aiko-chan-ai and upgrade by Sunaookami Shiroko. All rights reserved.\nFrom Github with ❤️\nBy using this module, you agree to our Terms of Use and accept any associated risks.\nPlease note that we do not take any responsibility for accounts being banned due to the use of our tools.`;

let client: Client<boolean>,
  guildID: string,
  channelID: string[],
  waynotify: string[],
  webhookURL: string,
  autoPray: string,
  autoPrayUser: string,
  usernotify: string,
  musicPath: string,
  solveCaptcha: number,
  apiuser: string,
  apikey: string,
  botPrefix: string,
  cmdPrefix: string,
  addMoreUser: boolean,
  trustUser: string,
  apilink: string,
  otherCmd: string,
  autogem: number,
  gemType: string[],
  useSpecialGem: boolean = false,
  autoCrate: boolean = false,
  autoQuote: boolean,
  autoOwO: boolean = true,
  autoReload: boolean,
  autoSleep: boolean,
  autoResume: boolean,
  autoDaily: boolean,
  autoSell: string[],
  autoHunt: boolean,
  upgradetrait: number,
  autoSac: string[];

const listAccount = (data: { [key: string]: Configuration }) => {
  return new InquirerListQuestion<{ answer: string }>({
    type: "list",
    message: "Select an accout to login",
    choices: [
      ...new Set(Object.keys(data).map((user) => ({ name: data[user].tag, value: user }))),
      { name: "New Account (Sign In With Token)", value: "0" },
      { name: "New Account (Sign In With QR Code)", value: "1" },
      { name: "New Account (Sign In With Password - MFA Required)", value: "2" },
      { name: "About Us", value: "3", disabled: true },
    ],
  });
};

const getToken = () => {
  return new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter Your Token",
    validate: (token: string) => {
      return token.split(".").length === 3 ? true : "Invalid Token";
    },
  });
};

const getAccount = () => {
  const username = new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter Your Email/Phone Number: ",
    validate(ans: string) {
      return ans.match(
        /^((\+?\d{1,2}\s?)?(\d{3}\s?\d{3}\s?\d{4}|\d{10}))|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/
      )
        ? true
        : "Invalid Email/Phone Number";
    },
  });
  const password = new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter Your Password: ",
    validate(ans: string) {
      return ans.match(/^.+$/) ? true : "Invalid Input";
    },
  });
  const mfaCode = new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter Your 2FA/Backup Code: ",
    validate: (ans: string) => {
      return ans.match(/^([0-9]{6}|[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4})$/) ? true : "Invalid 2FA/Backup Code";
    },
  });
  return [username, password, mfaCode];
};

const listGuild = (cache?: string) => {
  return new InquirerListQuestion<{ answer: string }>({
    type: "list",
    message: "Select a guild to farm",
    choices: client.guilds.cache.map((guild) => ({ name: guild.name, value: guild.id })),
    default: cache,
  });
};

const listChannel = (cache?: string[]) => {
  const guild = client.guilds.cache.get(guildID)!;
  return new InquirerCheckboxQuestion<{ answer: string[] }>({
    type: "checkbox",
    message: "Select channels to farm (Farming Channel will be changed randomly if multiple channels are selected)",
    choices: guild.channels.cache
      .filter(
        (cnl) =>
          (cnl.type == "GUILD_NEWS" || cnl.type == "GUILD_TEXT") &&
          cnl.permissionsFor(guild.members.me!).has(["VIEW_CHANNEL", "SEND_MESSAGES"])
      )
      .map((ch) => ({ name: ch.name, value: ch.id })),
    validate: (answer: string[]) => {
      return answer.length > 0 ? true : "Please Choose At Least One Channel";
    },
    default: cache,
  });
};

const wayNotify = (cache?: string[]) => {
  return new InquirerCheckboxQuestion<{ answer: string[] }>({
    type: "checkbox",
    message: "Select how you want to be notified when selfbot receives a captcha",
    choices: [
      { name: "Direct Message (Friends Only)", value: "DMs" },
      { name: "Windows/Mac Notify", value: "notify" },
    ],
    default: cache,
  });
};

const userNotify = (cache?: string) => {
  return new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter user ID you want to be notified via Webhook/Call/Direct Message",
    validate: async (answer: string) => {
      if (waynotify.includes("DMs") && /^\d{17,19}$/.test(answer)) {
        if (answer == client.user?.id) return "Selfbot ID is not valid for Call/DMs option";
        const target = client.users.cache.get(answer);
        if (!target) return "User not found!";
        switch (target.relationships.toString()) {
          case "FRIEND":
            return true;
          case "PENDING_INCOMING":
            try {
              await target.setFriend();
              return true;
            } catch (error) {
              return "Could not accept user's friend request!";
            }
          case "PENDING_OUTGOING":
            return "Please accept selfbot's friend request!";
          default:
            try {
              await target.sendFriendRequest();
              return "Please accept selfbot's friend request!";
            } catch (error) {
              return "Could not send friend request to user!";
            }
        }
      }
      return /^(\d{17,19}|)$/.test(answer) ? true : "Invalid User ID";
    },
    default: cache,
  });
};

const captchaAPI = (cache?: number) => {
  return new InquirerListQuestion<{ answer: number }>({
    type: "list",
    message: "Select a captcha solving service (Selfbot will try once)",
    choices: [
      { name: "Skip", value: 0 },
      { name: "TrueCaptcha (100 images - Free)", value: 1 },
      { name: "2Captcha (image and link - Paid)", value: 2 },
      { name: "Selfbot API [Coming Soon]", disabled: true },
    ],
    default: cache,
  });
};

const apiUser = (cache?: string) => {
  return new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter your API User ID",
    validate: (answer: string) => {
      return /^\S+$/.test(answer) ? true : "Invalid User ID";
    },
    default: cache,
  });
};

const apiKey = (cache?: string) => {
  return new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter your API Key",
    validate: (answer: string) => {
      return /^\S+$/.test(answer) ? true : "Invalid API Key";
    },
    default: cache,
  });
};

const owoPrefix = (cache?: string) => {
  return new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter your OwO prefix: ",
    validate: (answer: string) => {
      if (!answer) return true;
      return /^[^0-9\s]{1,5}$/.test(answer) ? true : "Invalid Prefix";
    },
    default: cache ?? "owo",
  });
};

const userPrefix = (cache?: string) => {
  return new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: 'Enter your Selfbot Prefix [type: "prefix + help"] to get more infomation!, empty to skip',
    default: cache,
  });
};

const getTrustUser = (cache?: string) => {
  return new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter user ID you want to be use selfbot command",
    validate: async (answer: string) => {
      if (answer && answer == client.user?.id) return "Accounts using selfbot have this feature set by default!";
      const target = client.users.cache.get(answer);
      if (!target) return "User not found!";
      return /^(\d{17,19}|)$/.test(answer) ? true : "Invalid User ID";
    },
    default: cache,
  });
};

const otherCommand = (cache?: string) => {
  return new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter other command you want to send, Empty to skip",
    default: cache,
  });
};

const gemOrder = (cache?: number) => {
  return new InquirerListQuestion<{ answer: number }>({
    type: "list",
    message: "Select your gem usage order",
    choices: [
      { name: "Skip", value: 0 },
      { name: "Best to Worst", value: 1 },
      { name: "Worst to Best", value: 2 },
    ],
    default: cache,
  });
};

const prayCurse = (cache?: string) => {
  return new InquirerListQuestion<{ answer: string }>({
    type: "list",
    message: "Select to pray or curse (user)",
    choices: [
      { name: "Skip", value: `skip` },
      { name: "Pray", value: `pray` },
      { name: "Curse", value: `curse` },
    ],
    default: cache,
  });
};

const prayCurseUser = (cache?: string) => {
  return new InquirerInputQuestion<{ answer: string }>({
    type: "input",
    message: "Enter your friend you want to pray/curse, empty to pray/curse your self",
    validate: async (answer: string) => {
      if (!answer) return true;
      if (answer == client.user?.id) return "Selfbot ID is not valid for Call/DMs option";
      const target = client.users.cache.get(answer);
      if (!target) return "User not found!";
      switch (target.relationships.toString()) {
        case "FRIEND":
          return true;
        case "PENDING_INCOMING":
          try {
            await target.setFriend();
            return true;
          } catch (error) {
            return "Could not accept user's friend request!";
          }
        case "PENDING_OUTGOING":
          return "Please accept selfbot's friend request!";
        default:
          try {
            await target.sendFriendRequest();
            return "Please accept selfbot's friend request!";
          } catch (error) {
            return "Could not send friend request to user!";
          }
      }
    },
    default: cache,
  });
};

const huntBot = (cache?: number) => {
  return new InquirerListQuestion<{ answer: number }>({
    type: "list",
    message: "Select which huntbot trait to upgrade",
    choices: [
      { name: "Skip", value: 0 },
      { name: "Efficiency", value: 1 },
      { name: "Duration", value: 2 },
      { name: "Cost", value: 3 },
      { name: "Gain", value: 4 },
      { name: "Experience", value: 5 },
      { name: "Radar", value: 6 },
    ],
    default: cache,
  });
};

const rate = (msg?: string, cache?: string[], isPet: boolean = false, isRequire: boolean = false) => {
  return new InquirerCheckboxQuestion<{ answer: string[] }>({
    type: "checkbox",
    message: msg + (!isRequire ? ", empty to skip" : ""),
    choices: [
      { name: "Common", value: "common" },
      { name: "Uncommon", value: "uncommon" },
      { name: "Rare", value: "rare" },
      { name: "Epic", value: "epic" },
      { name: "Mythical", value: "mythical" },
      { name: "Legendary", value: "legendary" },
      { name: "Fabled", value: "fabled" },
      ...(isPet
        ? [
            { name: "Special", value: "special" },
            { name: "Gem", value: "gem" },
            { name: "Distorted", value: "distorted" },
            { name: "Patreon", value: "patreon" },
            { name: "Cpatreon", value: "cpatreon" },
          ]
        : []),
    ],
    validate: (answer: string[]) => {
      if (!isRequire) return true;
      else return answer.length === 0 ? "You need to select at least one value" : true;
    },
    default: cache,
  });
};

export const collectData = async (data: { [key: string]: Configuration }) => {
  console.clear();
  await checkUpdate();
  if (JSON.stringify(data) == "{}") {
    const res = await getResult(trueFalse("Do You Want To Countinue", false), document);
    if (!res) process.exit(1);
  }
  let account: string, loginMethod: string | string[] | undefined, cache: Configuration | undefined;
  while (!client) {
    account = await getResult(listAccount(data));
    switch (account) {
      case "0":
        loginMethod = await getResult(getToken());
        break;
      case "1":
        break;
      case "2":
        loginMethod = [];
        for (const prof of getAccount()) loginMethod.push(await getResult(prof));
        break;
      default:
        const obj = data[account];
        cache = obj;
        loginMethod = obj.token;
        break;
    }
    log("Checking Account...", "i");
    try {
      client = await accountCheck(loginMethod);
    } catch (error) {
      log(`${error}`, "e");
      if (data[account]) accountRemove(data, account);
      process.exit(1);
    }
  }
  guildID = await getResult(listGuild(cache?.guildID));
  channelID = await getResult(listChannel(cache?.channelID));
  waynotify = await getResult(wayNotify(cache?.wayNotify));
  if (waynotify.includes("DMs")) usernotify = await getResult(userNotify(cache?.userNotify));
  solveCaptcha = await getResult(captchaAPI(cache?.captchaAPI));
  if (solveCaptcha === 1) {
    apiuser = await getResult(
      apiUser(cache?.apiUser),
      'Head To This Website And SignUp/SignIn. Then Copy The \x1b[1m"userid"\x1b[0m Value On [API Tab] And Paste It Here\nLink: https://truecaptcha.org/api.html'
    );
    apikey = await getResult(
      apiKey(cache?.apiKey),
      'Head To This Website And SignUp/SignIn. Then Copy The \x1b[1m"apikey"\x1b[0m Value On [API Tab] And Paste It Here\nLink: https://truecaptcha.org/api.html'
    );
  } else if (solveCaptcha === 2)
    apikey = await getResult(
      apiKey(cache?.apiKey),
      'Head To This Website And SignUp/SignIn. Then Copy The \x1b[1m"API Key"\x1b[0m Value in Account Settings On [Dashboard Tab] And Paste It Here\nLink: https://2captcha.com/enterpage'
    );
  botPrefix = await getResult(owoPrefix(cache?.botPrefix));
  cmdPrefix = await getResult(userPrefix(cache?.cmdPrefix));
  if (cmdPrefix) {
    addMoreUser = await getResult(trueFalse("Do you want to add user to use selfbot command", cache?.addMoreUser));
    if (addMoreUser) {
      trustUser = await getResult(getTrustUser(cache?.trustUser));
    }
  }
  otherCmd = await getResult(otherCommand(cache?.otherCmd));
  autoPray = await getResult(prayCurse(cache?.autoPray));
  if (autoPray !== "skip") autoPrayUser = await getResult(prayCurseUser(cache?.autoPrayUser));
  autogem = await getResult(gemOrder(cache?.autoGem));
  if (autogem > 0) {
    gemType = await getResult(rate("Select which gem you want to use", cache?.gemType, false, true));
    useSpecialGem = await getResult(trueFalse("Toggle Automatically use Special Gem", cache?.useSpecialGem));
    autoCrate = await getResult(trueFalse("Toggle Automatically Use Lootbox", cache?.autoCrate));
  }
  if (solveCaptcha != 0)
    // autoHunt = await getResult(trueFalse("Toggle Automatically send/receive AutoHunt/Huntbot", cache?.autoHunt));
    autoHunt = false;
  if (autoHunt) upgradetrait = await getResult(huntBot(cache?.upgradeTrait));
  if (autoHunt && upgradetrait !== 0)
    autoSac = await getResult(rate("Select which type of pet(s) you want to sacrifice", cache?.autoSac, true));
  autoQuote = await getResult(trueFalse("Toggle Automatically send quotes to level up", cache?.autoQuote));
  autoOwO = await getResult(trueFalse("Toggle Automatically send owo/uwu to level up", cache?.autoOwO));
  autoDaily = await getResult(trueFalse("Toggle Automatically claim daily reward", cache?.autoDaily));
  autoSell = await getResult(
    rate("Select which pet(s) you want to sell when run out of cowoncy", cache?.autoSell, true)
  );
  autoSleep = await getResult(
    trueFalse("Toggle Automatically pause after times (RECOMMEND turn on!!)", cache?.autoSleep)
  );
  autoReload = await getResult(trueFalse("Toggle Automatically reload configuration on new day", cache?.autoReload));
  autoResume = await getResult(trueFalse("Toggle Automatically resume after captcha is solved", cache?.autoResume));
  const conf = resolveData(
    `${client.user?.displayName}`,
    client.token!,
    guildID,
    channelID,
    waynotify,
    musicPath,
    webhookURL,
    usernotify,
    solveCaptcha,
    apiuser,
    apikey,
    apilink,
    botPrefix,
    cmdPrefix,
    addMoreUser,
    trustUser,
    autoPray,
    autoPrayUser,
    autogem,
    gemType,
    useSpecialGem,
    autoCrate,
    autoHunt,
    upgradetrait,
    autoSac,
    autoQuote,
    autoOwO,
    autoDaily,
    autoSell,
    otherCmd,
    autoSleep,
    autoReload,
    autoResume
  );
  data[`${client.user?.id}`] = conf;
  fs.writeFileSync(global.DataPath, JSON.stringify(data));
  log(`Data Saved To: ${global.DataPath}`, "i");
  return { client, conf };
};
