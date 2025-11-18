"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  throw new Error("Missing R2 environment variables");
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Delete an object from R2 bucket
export const deleteR2Object = internalAction({
  args: {
    key: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: args.key,
    });

    try {
      await s3Client.send(command);
      console.log(`Deleted R2 object: ${args.key}`);
      return null;
    } catch (error) {
      console.error("Error deleting R2 object:", error);
      throw new Error(`Failed to delete R2 object: ${args.key}`);
    }
  },
});
