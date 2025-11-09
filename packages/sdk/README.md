# @sentinel/sdk

Lightweight client SDK for Sentinel Gate — plug-and-play authorization and decision service.

## Usage

```ts
import { authorize } from "@sentinel/sdk";

const result = await authorize({
  token: process.env.USER_TOKEN,
  action: "padron:edit",
  resource: { type: "padron", uaId: "FCEyN", status: "OPEN" },
});

console.log(result.allow);
```

---

## ⚡ 8️⃣ Agregar al `turbo.json` raíz

Asegurate de que tu `turbo.json` incluya el SDK para builds:

```json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false
    }
  }
}
```
