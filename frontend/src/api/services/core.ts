import apiClient from "../client";

export async function getHealth() {
  try {
    const res = await apiClient.get("/health");
    return res;
  } catch (error) {
    console.error("Health check failed:", error);
    throw new Error("Health check failed", { cause: error });
  }
}

export async function finance() {
  try {
    const res = await apiClient.post("/financing");
    return res;
  } catch (error) {
    console.log("Error financing occur", error);
    throw new Error("Error financing occur", { cause: error });
  }
}
