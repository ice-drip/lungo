/*
 * @Author: Rikka
 * @Date: 2022-05-11 11:03:18
 * @LastEditTime: 2022-05-11 17:50:02
 * @LastEditors: Rikka
 * @Description:
 * @FilePath: \faw-operate-plateform-workspace\apps\tools\upload\src\ssh.ts
 */

import { Observable } from "rxjs";
import { Client } from "ssh2";

import { Config } from "./config/config.interface";
const ssh$ = (config: Config) =>
  new Observable<Client>((observer) => {
    const conn = new Client();
    if (config.forward) {
      const forward = new Client();
      forward
        .on("ready", () => {
          forward.forwardOut(
            "127.0.0.1",
            8797,
            config.host,
            config.port,
            (err, stream) => {
              if (err) {
                console.log("FIRST :: exec error: " + err);
                return forward.end();
              }
              conn
                .on("ready", () => {
                  observer.next(conn);
                })
                .on("close", () => {
                  observer.complete();
                })
                .connect({
                  sock: stream,
                  host: config.host,
                  port: config.port,
                  username: config.username,
                  password: config.password,
                });
            }
          );
        })
        .connect(config.forward);
    } else {
      conn
        .on("ready", () => {
          observer.next(conn);
        })
        .on("close", () => {
          observer.complete();
        })
        .connect({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
        });
    }
  });
const exec$ = (client: Client, command: string) =>
  new Observable<string>((observer) => {
    client.exec(command, (err, stream) => {
      if (err) {
        throw err;
      }
      let _data: string = "";
      stream.on("data", (data: string) => {
        _data = data.toString();
      });
      stream.on("close", () => {
        observer.next(_data);
        observer.complete();
        stream.destroy();
      });
    });
  });

export { exec$, ssh$ };
