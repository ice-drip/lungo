# @kaffee/lungo

A based ssh upload package

## Installation

Install with npm

```bash
  npm install --dev @kaffee/lungo
```

Install with yarn

```bash
  yarn add --dev @kaffee/lungo
```

Install with pnpm

```bash
  pnpm add -D @kaffee/lungo
```

## Usage/Examples

Examples Config

```typescript
{
  "production": {
    "serverDir": "/home/nginx/web/dev",
    "host": "192.168.1.1",
    "port": 22,
    "username": "username",
    "password": "password",
    "project": "kaffee-lungo",
    "dist":"dist",
    "forward":{
      "host": "192.168.1.2",
      "port": 22,
      "username": "username",
      "password": "password",
    }
  }
}
```

Example command

```bash
yarn lungo --env production
npx lungo --env production
pnpm lungo --env production
```

The config upload your dist folder to `serverDir + project`

## License

[GPL](https://choosealicense.com/licenses/gpl-3.0/)

## Contributors

<a href="https://github.com/Muromi-Rikka" >
  <img style="border-radius:200px;" src="https://github.com/Muromi-Rikka.png?size=50">
</a>
