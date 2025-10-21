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

      Now, parse the following raw text.
      1.  **Extract Violations**: For each entry, identify the student's name (or null if it's a class-level violation), their class, the violation type, and specific details. If a single line contains multiple student names, create a separate violation entry for each student, ensuring all other details (class, violation type, details, originalText) are correctly associated with each student.  If a single line contains multiple violation/student, create a separate violation entry for each violation with same student name, ensuring all other details (class, violation type, details, originalText) are correctly associated with each entry.
          - If an entry is for a class (e.g., "10a8 vệ sinh muộn"), the student name should be null.
          - **violationType**: This MUST be one of the exact strings from the provided list. Map common abbreviations or descriptions to the correct violation type (e.g., "sai dp", "dép lê", or "đeo khuyên tai" should all be mapped to "Sai đồng phục/đầu tóc,...").
          - **details**: This should be the specific detail of the violation mentioned in the text. For example, if the input is "bùi hiếu 11a7 đeo khuyên tai", the detail is "Đeo khuyên tai". If the input is just "10a8 vệ sinh muộn" with no extra detail, this field should be an empty string. Make sure to standardize the detail to make it look professional if needed (e.g: captial characters, use of words like "vs muộn" to "Vệ sinh muộn"; "tóc" to "Đầu tóc"; "khuyên tai" to "Đeo khuyên tai")
          - **originalText**: The exact original line from the raw text that this violation was parsed from.
          - Return the student name as it appears in the text. Do not try to find the full name.
          - Class names should be normalized to uppercase (e.g., "11a8" -> "11A8").
          - Each student can only violate 1 error type at once (no duplicate entry for same student with same error, one student still can violate mutiple error if they are different in type.)
          - If user dont mention whether a student's "Nghỉ học", "Đi muộn" is "Có phép" or not, choose "Có phép". If user said something general like "vắng", choose "Nghỉ có phép."

      2.  **Extract Checked Classes**: Look for a line starting with "ktra:", "ktr:", "check:", or similar keywords, which indicates a list of classes that were checked. Extract these class names.
          - The classes might be comma-separated and some might be partial (e.g., "12a1,2,3,6"). You need to expand them based on the first class mentioned (e.g., "12a1,2,3,6" becomes "12A1", "12A2", "12A3", "12A6").
          - Normalize all class names to uppercase.

      Raw text:
      "${rawText}"

      Return a single JSON object with the following structure:
      {
        "violations": [
          {
            "studentName": "string | null",
            "violatingClass": "string",
            "violationType": "string",
            "details": "string",
            "originalText": "string"
          }
        ],
        "checkedClasses": ["string"]
      }
      If no checked classes are found, return an empty array for "checkedClasses".
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Clean the response to get only the JSON part
      if (text.includes("```json")) {
        text = text.substring(
          text.indexOf("```json") + 7,
          text.lastIndexOf("```")
        );
      } else if (text.includes("```")) {
        text = text.substring(text.indexOf("```") + 3, text.lastIndexOf("```"));
      }

      const parsedData = JSON.parse(text);

      // Handle cases where the AI might return the old array format
      if (Array.isArray(parsedData)) {
        return { violations: parsedData, checkedClasses: [] };
      }

      // Ensure the new structure is correct, with defaults
      return {
        violations: parsedData.violations || [],
        checkedClasses: parsedData.checkedClasses || [],
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      throw new Error("Failed to parse violations using AI.");
    }
  },

});
