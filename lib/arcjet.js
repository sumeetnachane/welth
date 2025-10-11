import arcjet, { tokenBucket } from "@arcjet/next";

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  characteristics: ["userId"], //track based on Clerk userId
  rules: [
    // for the rate limiting
    tokenBucket({
      mode: "LIVE",
      refillRate: 2,
      interval: 3600,
      capacity: 2, // max 10 request make
    }),
  ],
});

export default aj;
