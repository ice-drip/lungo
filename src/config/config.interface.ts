/*
 * @Author: Rikka
 * @Date: 2022-05-11 10:23:59
 * @LastEditTime: 2022-05-11 10:24:12
 * @LastEditors: Rikka
 * @Description:
 * @FilePath: \faw-operate-plateform-workspace\apps\tools\upload\src\config\config.interface.ts
 */
export interface Config {
  serverDir: string;
  host: string;
  port: number;
  username: string;
  password: string;
  project: string;
  dist: string;
  timeout?:number;
}
