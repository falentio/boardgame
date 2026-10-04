export default defineEventHandler(async (event) => {
  const { user } = await requireSession(event);
  return { id: user.id, name: user.name, email: user.email };
});
