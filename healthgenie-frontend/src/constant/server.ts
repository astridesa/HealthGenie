export const SERVER_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5001"
    : "https://health-mate-server-653725443729.us-central1.run.app";
// export const SERVER_URL = "https://health-mate-server-653725443729.us-central1.run.app"