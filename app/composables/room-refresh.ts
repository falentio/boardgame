export interface RoomRefresherOptions<T> {
  readonly fetchRoom: () => Promise<T>;
  readonly onRoom: (room: T) => void;
  readonly schedule?: (task: () => void) => void;
}

export const createRoomRefresher = <T>(options: RoomRefresherOptions<T>): (() => void) => {
  const schedule = options.schedule ?? ((task) => void task());
  let inFlight = false;
  let pending = false;

  const run = async (): Promise<void> => {
    inFlight = true;
    try {
      options.onRoom(await options.fetchRoom());
    } catch {
      // A failed refetch leaves the last good room in place; the next signal retries.
    } finally {
      inFlight = false;
      if (pending) {
        pending = false;
        schedule(() => void run());
      }
    }
  };

  return () => {
    if (inFlight) {
      pending = true;
      return;
    }
    void run();
  };
};
