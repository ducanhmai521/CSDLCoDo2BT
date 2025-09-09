import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { api } from "./_generated/api";
import { VIOLATION_CATEGORIES } from "./violationPoints";

// Get the full list of violation names
const ALL_VIOLATIONS = VIOLATION_CATEGORIES.flatMap(
  (category) => category.violations
);

export const parseViolationsWithAI = action({
  args: {
    rawText: v.string(),
  },
  handler: async (ctx, { rawText }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing GEMINI_API_KEY environment variable. Please add it to your .env.local file."
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `
      You are an assistant for a school's disciplinary system. Your task is to parse a raw text input containing a list of student or class violations and convert it into a structured JSON format.

      Here is the list of all possible violation types:
      ${ALL_VIOLATIONS.join(", ")}

      Now, parse the following raw text. For each entry, identify the student's name (or null if it's a class-level violation), their class, and the violation.
      - If an entry is for a class (e.g., "10a8 vệ sinh muộn"), the student name should be null, and the violatingClass should be the class name.
      - The violation must be one of the exact strings from the provided list. Map common abbreviations or descriptions to the correct violation type (e.g., "sai dp" or "dép lê" should be "Sai đồng phục/đầu tóc,...").
      - Return the student name as it appears in the text. Do not try to find the full name.
      - Class names should be normalized to uppercase (e.g., "11a8" -> "11A8").

      Raw text:
      "${rawText}"

      Return a JSON array of objects, where each object has the following structure:
      {
        "studentName": "string | null",
        "violatingClass": "string",
        "violationType": "string"
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean the response to get only the JSON part
      const jsonString = text.substring(text.indexOf("["), text.lastIndexOf("]") + 1);
      const parsedData = JSON.parse(jsonString);
      
      return parsedData;

    } catch (error) {
      console.error("Error calling Gemini API:", error);
      throw new Error("Failed to parse violations using AI.");
    }
  },
});