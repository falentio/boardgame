export default defineEventHandler((event) =>
  getAuth(event).handler(toWebRequest(event)),
);
