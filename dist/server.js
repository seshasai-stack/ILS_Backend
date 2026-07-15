"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_js_1 = require("./app.js");
const port = Number(process.env.PORT) || 5000;
app_js_1.app.listen(port, "0.0.0.0", () => {
    console.log(`Backend running on port ${port}`);
});
