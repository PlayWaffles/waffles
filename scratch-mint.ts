import { SignJWT } from "jose";

const secret = process.env.AUTH_SECRET!;
const userId = process.env.MINT_USER_ID!;
const token = await new SignJWT({ type: "session", userId, platform: "MINIPAY" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(secret));
console.log(token);
