import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Your R2 public URL

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
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

// Generate a presigned URL for uploading to R2
export const generateR2UploadUrl = mutation({
  args: {
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const key = `evidence/${Date.now()}-${args.fileName}`;
    
    const commandParams: any = {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: args.contentType,
    };

    if (args.contentType.startsWith("video/")) {
      commandParams.ContentDisposition = "inline";
    }
    
    const command = new PutObjectCommand(commandParams);

    try {
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return { uploadUrl, key };
    } catch (error) {
      console.error("Error generating R2 upload URL:", error);
      throw new Error("Failed to generate upload URL");
    }
  },
});

// Get a presigned URL for viewing/downloading from R2
export const getR2ViewUrl = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: args.key,
    });

    try {
      const viewUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return viewUrl;
    } catch (error) {
      console.error("Error generating R2 view URL:", error);
      return null;
    }
  },
});

// Get public URL for R2 object (if you have public access configured)
export const getR2PublicUrl = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    return `${R2_PUBLIC_URL}/${args.key}`;
  },
});
