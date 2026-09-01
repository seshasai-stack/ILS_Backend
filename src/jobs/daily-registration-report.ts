import "dotenv/config";

import { sendPreviousDayRegistrationReport } from "../services/daily-registration-report.service.js";

async function main() {
  try {
    const result = await sendPreviousDayRegistrationReport();
    console.log("Daily registration report completed", result);
  } catch (error) {
    console.error("Daily registration report failed", error);
    process.exitCode = 1;
  }
}

void main();
