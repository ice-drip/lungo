/*
 * @Author: Rikka
 * @Date: 2022-05-11 10:22:38
 * @LastEditTime: 2022-05-11 17:52:33
 * @LastEditors: Rikka
 * @Description:
 * @FilePath: \faw-operate-plateform-workspace\apps\tools\upload\src\bin.ts
 */
import chalk from "chalk";
import { Table } from "console-table-printer";
import dayjs from "dayjs";
import minimist from "minimist";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { concatMap, map, tap } from "rxjs";
import { Client } from "ssh2";

import { Config } from "./config/config.interface";
import { sftp$ } from "./ftp";
import { exec$, ssh$ } from "./ssh";

const env = minimist(process.argv.slice(2)).env;

if (!env) {
  throw new Error("参数env不存在");
}

const filepath = resolve(process.cwd(), "lungo.config.json");
if (!existsSync(filepath)) {
  throw new Error("配置文件不存在,请创建lungo.config.json文件");
}

const config_file: Record<string, Config> = JSON.parse(
  readFileSync(resolve(process.cwd(), "lungo.config.json")).toString()
);
if (!config_file[env]) {
  throw new Error(`配置文件${env}不存在`);
}
const useConfg = config_file[env];

const keyList = new Set(Object.keys(useConfg));

["serverDir", "host", "port", "username", "password", "project", "dist"].some(
  (item) => {
    if (!keyList.has(item)) {
      throw new Error("配置文件缺少" + item);
    }
  }
);

interface CommonFile {
  filename: string;
  date: string;
}

let client: Client | null = null;
let delCommand = "echo no file delete";
const bin$ = (config: Config) =>
  ssh$(config).pipe(
    tap((conn) => {
      client = conn;
    }),
    concatMap((conn) =>
      exec$(conn, `ls ${config.serverDir}`).pipe(
        map((item) => item.split("\n"))
      )
    ),
    map((lsDir) => {
      const bakFileRegex = new RegExp(`${config.project}.bak.([0-9]{13})`);
      const backFile: CommonFile[] = lsDir
        .filter((item) => item.indexOf(config.project + ".bak") === 0)
        .map((item) => {
          const matchTime = item.match(bakFileRegex);
          return {
            filename: item,
            date: matchTime
              ? dayjs(Number(matchTime[1])).format("YYYY-MM-DD HH:mm:ss")
              : ""
          };
        })
        .sort((x, y) => Number(x.date < y.date));
      console.log(chalk.green(`共存在${backFile.length}份备份;`));
      if (config["timeout"]) {
        //
        const timeout = config.timeout;
        const delTime = backFile
          .filter(({ date }) => dayjs().subtract(timeout, "day").isAfter(date))
          .map(({ filename }) => {
            const matchTime = filename.match(bakFileRegex) as RegExpMatchArray;
            return matchTime[1];
          });
        delCommand = `rm -r ${config.serverDir}/${
          config.project
        }.bak.{${delTime.join(",")}}`;
        console.log(chalk.green(`共需要删除${delTime.length}份备份`));
      }
      if (backFile.length > 0) {
        const backTable = new Table({
          columns: [
            { name: "index", alignment: "right", color: "green" },
            { name: "filename", color: "green" },
            { name: "date", color: "green" }
          ]
        });
        backTable.addRows(
          backFile.map((item, index) => {
            return {
              index: index + 1,
              filename: item.filename,
              date: item.date
            };
          })
        );
        backTable.printTable();
      }

      let backCommand = `mv -v ${config.serverDir}/${config.project} ${
        config.serverDir
      }/${config.project}.bak.${Date.now()}`;
      if (!lsDir.includes(config.project)) {
        // eslint-disable-next-line quotes
        backCommand = 'echo "success"';
      }
      return backCommand;
    }),
    concatMap((command) => exec$(client as Client, command)),
    concatMap(() =>
      sftp$(config, client as Client, process.cwd(), config.dist)
    ),
    concatMap((command) =>
      exec$(client as Client, command.command).pipe(map((_) => command))
    ),
    map((command) => {
      return command.del;
    }),
    concatMap((command) => exec$(client as Client, command)),
    concatMap(() => exec$(client as Client, delCommand))
  );
bin$(useConfg).subscribe((_res) => {
  console.log(chalk.green("上传成功"));
  if (client) {
    client.end();
  }
});
